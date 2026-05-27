# SRAMS Assessment Cancellation Audit Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-05-26
**Report Type:** Technical Implementation & Process Flow Documentation
**Version:** 1.0

---

## Executive Summary

The SRAMS assessment cancellation feature provides an all-or-nothing financial reversal control that allows Admin and Finance Officers to cancel an outstanding assessment. The operation runs as a single atomic database transaction: if any step fails, every change is rolled back. Cancellation reverses dependent ledger entities (balance-forward transfers, BFX receipts, linked discount requests), reverts the enrollment to a re-assessable state, and preserves a complete audit trail. No record is hard-deleted; cancelled assessments and their line items are retained for historical accuracy.

The system enforces a strict rule borrowed from sound accounting practice: **no partial cancellation**. Partial reversals are how ledgers become inconsistent, so cancellation is intentionally atomic and complete.

---

## 1. System Architecture Overview

### 1.1 Database Tables Touched

Cancellation coordinates writes across five tables in one transaction:

| Table | Role in Cancellation | Key Fields |
|-------|----------------------|------------|
| `assessments` | Marked cancelled; source assessments restored on BFX reversal | `billingStatus`, `cancelledAt`, `cancelledBy`, `balance`, `transferredAt` |
| `assessmentItems` | Balance-forward line items deleted; fee/discount items preserved | `sourceAssessmentId`, `isDiscount`, `amount` |
| `payments` | BFX (balance-forward) receipts deleted on reversal | `kind`, `status`, `referenceNumber` |
| `discountRequests` | Linked requests auto-rejected | `status`, `decidedBy`, `decidedAt`, `decisionRemarks` |
| `enrollments` | Reverted `assessed` → `pending` | `status` |

### 1.2 Cancellation-Related Columns (`assessments`)

| Field | Purpose |
|-------|---------|
| `billingStatus` | Lifecycle status; set to `cancelled` |
| `cancelledAt` | Timestamp of cancellation |
| `cancelledBy` | User who performed the cancellation |
| `balance` / `totalAmount` / `totalPaid` | Preserved as-is (totals not zeroed) |

### 1.3 Enumeration Types

**Assessment Billing Status (`assessment_billing_status`):**
- `outstanding` — Active, has a payable balance (the only cancellable state)
- `fully_paid` — Settled; cannot be cancelled
- `cancelled` — Reversed via this workflow (terminal)
- `balance_forwarded` — Balance carried to a newer school year; cannot be cancelled

---

## 2. Process Flow

### 2.1 Cancellation Flow

```
┌────────────────────────────────────────────────────────────────┐
│  ADMIN / FINANCE OFFICER                                         │
├────────────────────────────────────────────────────────────────┤
│  1. Open assessment ledger                                       │
│     → Cancel button shown only when all gates pass               │
│                                                                  │
│  2. Submit cancellation                                          │
│     → Cancellation reason REQUIRED (1–500 chars)                 │
│                                                                  │
│  3. Server validates (permission + 5 gates)                      │
│                                                                  │
│  4. Atomic transaction:                                          │
│     a. Reverse balance-forward items                             │
│        → Delete BFX receipts                                     │
│        → Restore source assessment balance + status              │
│     b. Auto-reject linked discount requests                      │
│     c. Mark assessment as CANCELLED                              │
│     d. Revert enrollment: ASSESSED → PENDING                     │
│     e. Write audit log entry                                     │
│                                                                  │
│  5. Commit (or full rollback on any failure)                     │
│     → Enrollment is now re-assessable                            │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Validation Gates

| Validation | Rule | Error Handling |
|------------|------|----------------|
| Permission | Actor must hold `assessments:cancel` | Blocked with message |
| Assessment Exists | Assessment ID must resolve | Blocked |
| Cancellation Reason | `remarks` required, 1–500 chars | Zod field error |
| Billing Status | Must be `outstanding` (not cancelled / fully paid / balance_forwarded) | Blocked with status-specific message |
| Enrollment Status | Linked enrollment must be `assessed` | Blocked |
| Posted Payments | Hard block — `totalPaid` must be ≤ `OUTSTANDING_PAYMENT_EPSILON` (0.009). No admin override. | Void payments first, then cancel |

---

## 3. Transaction Steps (Reversal Logic)

The cancellation executes inside `db.transaction(...)`. All steps succeed together or roll back together.

### 3.1 Step A — Reverse Balance-Forward Items

For each `assessmentItem` carrying a `sourceAssessmentId` (a "Balance Forward" line):
1. Find and **delete** the BFX receipt(s) on the source assessment (`kind = 'balance_forward'`, `status = 'balance_forward'`).
2. **Restore** the source assessment: re-apply the transferred amount to `balance`, set `billingStatus = 'outstanding'`, and null all transfer-tracking fields (`transferredAt`, `transferredBy`, `transferredToAssessmentId`, `transferRemarks`).
3. After processing, **delete** the balance-forward line items from the cancelled assessment.

### 3.2 Step B — Auto-Reject Linked Discount Requests

All `discountRequests` linked to this assessment that are not already `rejected` are set to `rejected` with `decisionRemarks = "Auto-rejected: linked assessment was cancelled"`. Already-rejected rows are skipped so prior rejection metadata is preserved. This keeps cancelled-assessment discounts out of discount reports and the available pool.

### 3.3 Step C — Mark Assessment Cancelled

`billingStatus` → `cancelled`, `cancelledAt` / `cancelledBy` set. Totals (`totalAmount`, `totalPaid`, `balance`, `totalDiscounts`) and non-balance-forward line items are **preserved as-is** for historical accuracy.

### 3.4 Step D — Revert Enrollment

The linked enrollment is moved `assessed` → `pending` (guarded by a `WHERE status = 'assessed'` clause), making the student eligible for a fresh assessment.

### 3.5 Step E — Audit Log

A single `assessment_cancelled` audit entry captures the new state. Steps A and B emit their own entries (`bfx_receipt_deleted`, `assessment_transfer_reversed`) so the reversal is fully traceable.

> **No partial cancellation — rollback everything on failure.**

---

## 4. Audit Controls

### 4.1 Preservation (No Hard Delete)

| Aspect | Behavior |
|--------|----------|
| Cancelled assessment | Retained, marked `cancelled` (not deleted) |
| Fee & discount line items | Preserved under the cancelled assessment |
| Totals | Left intact (not zeroed) for reconstruction |
| Balance-forward line items | Deleted only after source restoration is recorded |
| BFX receipts | Deleted, but deletion is audit-logged with the BFX number |

### 4.2 Unique Index Behavior

The partial unique index `assessments_enrollment_id_uidx ON (enrollment_id) WHERE cancelled_at IS NULL` ensures only **one active** assessment per enrollment. Because cancelled rows have a non-null `cancelledAt`, they fall outside the index — allowing a new assessment to be created for the same enrollment after cancellation (reassessment).

### 4.3 Audit Log Entries

| Action | Logged Data |
|--------|-------------|
| `assessment_cancelled` | Billing status, `cancelledAt`, remarks, enrollment-reverted flag, balance-forwards reversed count, discounts-rejected flag |
| `assessment_transfer_reversed` | Restored balance, reversed-from assessment ID, reason, deleted BFX count |
| `bfx_receipt_deleted` | BFX number, reason, source assessment ID, cancelled assessment ID |

All entries are written with `throwOnFail: true`, so a failed audit write aborts the entire cancellation.

---

## 5. Role-Based Access Control

### 5.1 Permission Matrix

| Permission | Super Admin | Admin | Finance Officer | Registrar | Cashier | Student/Parent |
|------------|-------------|-------|-----------------|-----------|---------|----------------|
| `assessments:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (own) |
| `assessments:create` | ✓ | ✓ | ✓ | ✓ | | |
| `assessments:cancel` | ✓ | ✓ | ✓ | | | |
| `assessments:reverse_transfer` | ✓ | ✓ | | | | |

> `assessments:cancel_with_balance` exists in the permission set but the cancellation action enforces a **hard payment block** regardless — any posted payment must be voided before cancellation.

### 5.2 Enforcement Levels

1. **Route Guard:** `proxy.ts` validates role before page access
2. **Server Action Validation:** `hasPermission(session.role, "assessments:cancel")` at action start
3. **UI Gating:** Cancel button hidden unless `canCancel && isOutstanding && isEnrollmentAssessed && !hasPostedPayments` (display only — not security)
4. **Audit Logging:** Every operation logged with actor information

---

## 6. Technical Implementation Details

### 6.1 File Locations

```
src/features/assessments/
├── assessments.actions.ts     # cancelAssessmentAction (~lines 746–1038)
│                              # reverseBalanceTransferAction (admin-only)
├── assessments.schema.ts      # CancelAssessmentSchema, CancelAssessmentFormState
└── assessments.queries.ts     # fee schedule resolution

src/features/payments/components/
└── AssessmentLedgerRegister.tsx  # Cancel modal + button gating

src/lib/db/schema.ts            # assessments, assessmentItems, billing status enum
src/lib/rbac/permissions.ts     # assessments:cancel permission
docs/ASSESSMENT/CANCELLATION.md # Canonical specification
```

### 6.2 Key Server Action

| Action | Purpose | Permission |
|--------|---------|------------|
| `cancelAssessmentAction` | Atomically cancel an outstanding assessment with full reversal | `assessments:cancel` |
| `reverseBalanceTransferAction` | Reverse a balance transfer (no cancellation) | `assessments:reverse_transfer` |

**Signature:** `cancelAssessmentAction(_prevState, formData) → CancelAssessmentFormState`
**Input (Zod `CancelAssessmentSchema`):** `assessmentId` (uuid), `remarks` (required, trimmed, 1–500 chars)

### 6.3 Validation Order

1. Permission check (`assessments:cancel`)
2. Schema parse (required cancellation reason)
3. Assessment fetch (with enrollment)
4. Billing status checks (cancelled → fully_paid → balance_forwarded → must be `outstanding`)
5. Enrollment status must be `assessed`
6. Hard payment block (`totalPaid > OUTSTANDING_PAYMENT_EPSILON`)
7. Transactional reversal

### 6.4 Cache Revalidation

On success: `revalidatePath` for assessments, the assessment detail, student detail, enrollments (+ detail), and discount-requests; `forceUpdateTag(ENROLLMENTS)` (read-your-own-writes) and `invalidateTag(DASHBOARD)`.

---

## 7. Current Limitations

1. **Hard Payment Block:** An assessment with any posted payment cannot be cancelled; payments must be voided first. There is no admin override path.
2. **No Partial Cancellation:** Cancellation is all-or-nothing by design.
3. **Status Restrictions:** Fully paid and balance-forwarded assessments cannot be cancelled.
4. **Discount Handling Is One-Way:** Linked discount requests are auto-rejected, not restored, on cancellation.
5. **Schema Provenance:** `cancelled_at` / `cancelled_by` columns were applied via the idempotent repair script `scripts/apply-assessment-cancel-columns.ts` rather than a numbered drizzle migration.

---

## 8. Compliance Checklist

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Audit trail for all cancellation operations | ✓ | `assessment_cancelled` + reversal audit entries |
| Immutable historical records | ✓ | Cancelled assessment + items preserved (no hard delete) |
| Role-based access control | ✓ | 3-level enforcement (`assessments:cancel`) |
| Mandatory justification | ✓ | Cancellation reason required (1–500 chars) |
| Atomic rollback on failure | ✓ | Single `db.transaction` wraps all steps |
| Double-entry reversal (balance forward) | ✓ | Source restored + BFX receipt deletion logged |
| Financial integrity guard | ✓ | Hard block on assessments with posted payments |
| Reassessment support | ✓ | Partial unique index excludes cancelled rows |

---

## 9. Recommendations for Future Enhancement

1. **Promote Schema to Migration:** Move the `cancelled_at` / `cancelled_by` repair script into a numbered drizzle migration for traceability.
2. **Surface Cancellation Metadata in UI:** Display `cancelledBy`, `cancelledAt`, and the cancellation reason on the ledger view for cancelled assessments.
3. **Cancellation Reporting:** Build reports of cancelled assessments by school year, grade level, and actor.
4. **Optional Payment-Aware Path:** Evaluate a controlled `assessments:cancel_with_balance` workflow (with refund/void orchestration) if business needs require cancelling assessments with payments.
5. **Discount Restoration Option:** Consider an option to restore (rather than reject) linked discount requests when an enrollment is re-assessed.

---

## Appendix A: Sample Cancellation Scenarios

### Scenario 1: Simple Outstanding Assessment
- **State:** `outstanding`, enrollment `assessed`, no payments, no balance forward
- **Result:** Assessment marked `cancelled`, enrollment reverted to `pending`, single audit entry

### Scenario 2: Assessment With Forwarded Balance
- **State:** `outstanding` with a "Balance Forward" line from a prior year
- **Result:** BFX receipt deleted, source assessment balance restored to `outstanding`, balance-forward line removed, then cancelled — all audit-logged

### Scenario 3: Assessment With Approved Discounts
- **State:** `outstanding` with linked discount requests
- **Result:** Discount requests auto-rejected, assessment cancelled, discounts excluded from reports

### Scenario 4: Blocked — Posted Payment Exists
- **State:** `outstanding` but `totalPaid > 0`
- **Result:** Blocked. Cashier/finance must void payments before cancellation is permitted

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
