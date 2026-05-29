# SRAMS Enrollment Cancellation Feature Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-05-29
**Report Type:** Feature Implementation Documentation
**Version:** 1.0

---

## Executive Summary

The Enrollment Cancellation feature provides a formal, auditable process for cancelling enrollments that have active assessments and/or payments. Unlike the simple assessment cancellation (which requires zero payments), this feature handles the complex scenario where parents/guardians request withdrawal after partial or full payment.

The system implements a **request-based workflow** with Finance Officer approval, automatic refund calculation, and comprehensive audit trails. All operations are blocked during pending cancellation requests to prevent race conditions and maintain ledger integrity.

---

## 1. Business Problem Addressed

### 1.1 The Gap

Prior to this feature, SRAMS had no formal process for:
- Parents requesting enrollment withdrawal after payment
- Calculating refunds based on refundable vs non-refundable fees
- Tracking cancellation request status through approval workflow
- Preventing concurrent modifications during cancellation processing

### 1.2 Solution Overview

A three-phase workflow:
1. **Request Phase**: Parent/registrar submits cancellation request with reason
2. **Review Phase**: Finance officer reviews, sees auto-calculated refund, approves/rejects
3. **Execution Phase**: On approval, system atomically cancels assessment, marks payments, updates enrollment

---

## 2. Database Schema

### 2.1 New Table: `enrollment_cancellation_requests`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid | Primary key |
| `enrollment_id` | uuid (FK) | Link to enrollment being cancelled |
| `assessment_id` | uuid (FK) | Link to assessment (for refund calculation) |
| `status` | enum | `pending` / `approved` / `rejected` / `withdrawn` |
| `reason` | text | Required cancellation reason (10-1000 chars) |
| `total_paid` | decimal | Snapshot of payments at request time |
| `refundable_amount` | decimal | Auto-calculated refundable portion |
| `non_refundable_amount` | decimal | Auto-calculated non-refundable portion |
| `requested_by` | uuid (FK) | User who submitted request |
| `requested_at` | timestamp | Request submission time |
| `reviewed_by` | uuid (FK) | Finance officer who reviewed |
| `reviewed_at` | timestamp | Review decision time |
| `review_remarks` | text | Optional reviewer notes |
| `executed_at` | timestamp | When cancellation was executed |
| `executed_by` | uuid (FK) | User who executed (usually same as reviewer) |
| `created_at` / `updated_at` | timestamp | Standard audit fields |

### 2.2 Related Schema Changes

**`assessments` table additions:**
- `cancellation_request_id` - Links to active cancellation request

**Unique Constraint:**
- `enrollment_cancellation_requests_enrollment_pending_uidx` - Only one pending request per enrollment

---

## 3. Refund Calculation Logic

### 3.1 Algorithm

```
For each assessment_item:
  if item.isDiscount:
    skip (discounts don't affect refund)
  else if item.isRefundable:
    refundableTotal += item.amount
  else:
    nonRefundableTotal += item.amount

refundableAmount = min(totalPaid, refundableTotal)
nonRefundableAmount = totalPaid - refundableAmount
```

### 3.2 Fee Item Refundability

Fee item types have an `isRefundable` flag set during configuration:

| Fee Type | Typically Refundable |
|----------|---------------------|
| Tuition | Yes |
| Miscellaneous | Yes |
| Registration Fee | No |
| Assessment Fee | No |
| ID Fee | No |
| Books/Materials | No (once issued) |

### 3.3 Implementation

```typescript
// src/lib/utils/refund-calculation.ts
export function calculateRefundBreakdown(
  assessmentItems: AssessmentItemForRefund[],
  totalPaid: number
): RefundBreakdown {
  let refundableTotal = 0;
  let nonRefundableTotal = 0;

  for (const item of assessmentItems) {
    if (item.isDiscount) continue;
    const amount = Number(item.amount);
    if (item.isRefundable) {
      refundableTotal += amount;
    } else {
      nonRefundableTotal += amount;
    }
  }

  const refundableAmount = Math.min(totalPaid, refundableTotal);
  const nonRefundableAmount = totalPaid - refundableAmount;

  return {
    refundableAmount: Math.max(0, refundableAmount),
    nonRefundableAmount: Math.max(0, nonRefundableAmount),
    refundableTotal,
    nonRefundableTotal,
  };
}
```

---

## 4. Request Workflow

### 4.1 State Machine

```
                    ┌─────────────┐
                    │   (none)    │
                    └──────┬──────┘
                           │ createCancellationRequest
                           ▼
                    ┌─────────────┐
          ┌────────│   pending   │────────┐
          │        └──────┬──────┘        │
          │               │               │
     withdraw        approve          reject
          │               │               │
          ▼               ▼               ▼
   ┌───────────┐   ┌───────────┐   ┌───────────┐
   │ withdrawn │   │ approved  │   │ rejected  │
   └───────────┘   └─────┬─────┘   └───────────┘
                         │
                    (auto-execute)
                         │
                         ▼
                  ┌─────────────┐
                  │  executed   │
                  │ (terminal)  │
                  └─────────────┘
```

### 4.2 Blocking Behavior

While a cancellation request is `pending`:
- **Payments**: Blocked (`assertNoPendingCancellation`)
- **Void Payments**: Blocked
- **Apply Discounts**: Blocked
- **Reverse Discounts**: Blocked
- **Cancel Assessment**: Blocked (use the request workflow instead)

This prevents race conditions where financial modifications occur during review.

---

## 5. Server Actions

### 5.1 Action Summary

| Action | Permission | Purpose |
|--------|------------|---------|
| `createCancellationRequestAction` | `enrollments:cancel` | Submit new cancellation request |
| `approveCancellationRequestAction` | `enrollments:approve_cancellation` | Approve and execute cancellation |
| `rejectCancellationRequestAction` | `enrollments:approve_cancellation` | Reject with remarks |
| `withdrawCancellationRequestAction` | `enrollments:cancel` | Requester withdraws own request |

### 5.2 Create Request Flow

```typescript
// Validation gates:
1. Permission check (enrollments:cancel)
2. Schema validation (reason: 10-1000 chars)
3. Enrollment exists and is not already cancelled
4. No existing pending request for this enrollment
5. Assessment exists (if enrolled status)

// On success:
- Create cancellation_request with status='pending'
- Snapshot totalPaid, calculate refund breakdown
- Link assessment to request
- Audit log entry
```

### 5.3 Approve Request Flow (Atomic Transaction)

```typescript
// Inside db.transaction():
1. Lock and validate request (must be 'pending')
2. Re-verify no concurrent modifications
3. Mark all posted payments as 'cancelled_enrollment'
4. Cancel the assessment (billingStatus='cancelled')
5. Cancel the enrollment (status='cancelled')
6. Update request: status='approved', executed_at=now()
7. Audit log entries for each step
// Commit or full rollback
```

---

## 6. File Structure

```
src/features/enrollments/
├── enrollment-cancellation.actions.ts   # Server actions (5 actions)
├── enrollment-cancellation.queries.ts   # Query functions + guards
├── enrollment-cancellation.schema.ts    # Zod schemas + form states
└── components/
    ├── CancellationRequestForm.tsx      # Request submission form
    ├── CancellationRequestReview.tsx    # Finance review panel
    └── CancellationRequestStatus.tsx    # Status badge/display

src/lib/utils/
├── refund-calculation.ts                # Refund breakdown logic
└── tx-helpers.ts                        # Added lockCancellationRequest()

src/lib/db/schema.ts
└── enrollmentCancellationRequests       # Table definition
```

---

## 7. Permission Matrix

| Permission | Super Admin | Admin | Finance | Registrar | Cashier |
|------------|-------------|-------|---------|-----------|---------|
| `enrollments:cancel` (create request) | Y | Y | Y | Y | |
| `enrollments:approve_cancellation` | Y | Y | Y | | |
| `enrollments:view_cancellation_requests` | Y | Y | Y | Y | Y |

---

## 8. Audit Trail

### 8.1 Logged Actions

| Action | Target Entity | Logged Data |
|--------|---------------|-------------|
| `cancellation_request_created` | `enrollment_cancellation_requests` | reason, refund breakdown, enrollment/assessment IDs |
| `cancellation_request_approved` | `enrollment_cancellation_requests` | review remarks, executor |
| `cancellation_request_rejected` | `enrollment_cancellation_requests` | review remarks, reason |
| `cancellation_request_withdrawn` | `enrollment_cancellation_requests` | withdrawn by |
| `enrollment_cancelled_via_request` | `enrollments` | request ID, final status |
| `assessment_cancelled_via_request` | `assessments` | request ID, refund amounts |
| `payments_marked_cancelled` | `payments` | count, request ID |

### 8.2 Immutability

- Cancellation requests are never deleted
- All state transitions are logged
- Payment records retain `cancelled_enrollment` status (not deleted)
- Assessment and enrollment records retained with cancelled status

---

## 9. Guard Functions

### 9.1 `assertNoPendingCancellation`

Used in payment, void, and discount actions to block operations:

```typescript
export async function assertNoPendingCancellation(
  enrollmentId: string | null | undefined,
  operationDescription: string
): Promise<void> {
  if (!enrollmentId) return;

  const pending = await hasPendingCancellationRequest(enrollmentId);
  if (pending) {
    throw new Error(
      `CANCELLATION_PENDING: Cannot ${operationDescription} while a ` +
      `cancellation request is pending for this enrollment.`
    );
  }
}
```

### 9.2 Integration Points

The guard is called in:
- `postPaymentAction` (payments.actions.ts)
- `voidPaymentAction` (payments.actions.ts)
- `reverseDiscountAction` (discounts.actions.ts)
- `applyApprovedDiscountToExistingAssessment` (discounts.actions.ts)

---

## 10. UI Components

### 10.1 Request Form

- Displays current enrollment/assessment details
- Shows refund breakdown preview
- Requires cancellation reason (10-1000 chars)
- Submit button triggers `createCancellationRequestAction`

### 10.2 Review Panel (Finance)

- Shows request details and requester info
- Displays refund calculation breakdown
- Approve/Reject buttons with optional remarks
- Read-only view of assessment ledger

### 10.3 Status Display

- Badge showing current request status
- Timeline of status changes
- Links to audit log entries

---

## 11. Edge Cases Handled

| Scenario | Handling |
|----------|----------|
| No payments made | Refund = 0, still requires approval |
| All fees non-refundable | Refund = 0, non-refundable = totalPaid |
| Partial payment | Refund capped at min(paid, refundable fees) |
| Concurrent request attempt | Blocked by unique constraint |
| Payment during pending | Blocked by guard function |
| Requester withdraws | Status → withdrawn, enrollment unaffected |

---

## 12. Testing Verification

### 12.1 Build Status
```
Compiled successfully
TypeScript: No errors
```

### 12.2 Test Status
```
Test Files: 3 passed (3)
Tests: 38 passed (38)
```

### 12.3 Manual Testing Scenarios

1. Create request with various payment states
2. Approve request and verify atomic execution
3. Reject request and verify enrollment unchanged
4. Withdraw request and verify resubmission allowed
5. Attempt payment during pending (should block)
6. Concurrent request creation (should block second)

---

## 13. Future Enhancements

1. **Refund Processing Integration**: Connect to actual refund disbursement workflow
2. **Email Notifications**: Notify parent when request is approved/rejected
3. **Cancellation Reports**: Dashboard showing cancellation trends by period
4. **Configurable Refund Rules**: Admin-configurable refund percentages by timing
5. **Bulk Cancellation**: Handle class/section-wide cancellations

---

## 14. Migration Notes

### 14.1 Database Migration

Run the migration to create the new table:
```bash
npm run db:migrate
```

### 14.2 Seed Data

The cancellation request status enum values are defined in schema:
- `pending`, `approved`, `rejected`, `withdrawn`

No additional seed data required.

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
