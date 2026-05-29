@Updated: 5-28-2026

# Enrollment Cancellation Feature - Implementation Plan

## Overview

Implement a conditional approval workflow for enrollment cancellations:

- **Direct cancellation** (no approval) for `pending` enrollments (no assessment exists)
- **Direct cancellation** (no approval) for `assessed` enrollments (applies refund policy)
- **Approval required** for `enrolled` status enrollments (admin approval + refund policy)

## Requirements Summary

| Aspect                   | Decision                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| Workflow                 | Conditional approval (enrolled requires approval)                         |
| Approval trigger         | When enrollment status = `enrolled`                                       |
| Approvers                | Admin/Super Admin only                                                    |
| Cancellation reasons     | **Predefined dropdown + optional remarks** (remarks required for "Other") |
| Self-cancel              | Requester can withdraw pending request                                    |
| UI Location              | Staff dashboard notifications + dedicated inbox                           |
| **Payment handling**     | **Partial refund based on item refundability** (per-item calculation)     |
| Refund config level      | Per assessment item (refundability flag)                                  |
| Time factor              | **Configurable cutoff from enrollment date** (2 tiers: full/none)         |
| Cutoff behavior          | Within X days: full refund of refundable items. After X days: no refund   |
| **Transaction blocking** | **All transactions blocked** while cancellation request is pending        |
| **Outstanding balance**  | Admin can approve cancellation with balance; creates clearance record     |
| **Document release**     | Blocked until clearance is approved (balance settled or written off)      |

## Cancellation Reasons (Predefined)

| Code             | Label                      | Description                               |
| ---------------- | -------------------------- | ----------------------------------------- |
| `transfer`       | Transfer to another school | Student moving to a different institution |
| `financial`      | Financial difficulties     | Family unable to continue payments        |
| `medical`        | Medical/Health reasons     | Health issues preventing attendance       |
| `relocation`     | Relocation                 | Family moving to different area           |
| `personal`       | Personal/Family reasons    | Private matters (catch-all)               |
| `administrative` | Administrative correction  | Enrollment created in error               |
| `non_compliance` | Non-compliance             | Failed to submit required documents       |
| `disciplinary`   | Disciplinary               | Behavioral issues (admin-initiated)       |
| `other`          | Other                      | Requires remarks field to be filled       |

### Constants Definition

```typescript
// src/lib/constants/cancellation-reasons.ts
export const CANCELLATION_REASONS = [
  "transfer",
  "financial",
  "medical",
  "relocation",
  "personal",
  "administrative",
  "non_compliance",
  "disciplinary",
  "other",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  transfer: "Transfer to another school",
  financial: "Financial difficulties",
  medical: "Medical/Health reasons",
  relocation: "Relocation",
  personal: "Personal/Family reasons",
  administrative: "Administrative correction",
  non_compliance: "Non-compliance",
  disciplinary: "Disciplinary",
  other: "Other",
};
```

## Refund Policy (Per-Item Calculation)

### Refundability Rules

| Item Type         | Default Refundable | Notes                          |
| ----------------- | ------------------ | ------------------------------ |
| Tuition Fee       | ✅ Yes             | Primary educational fee        |
| Miscellaneous Fee | ✅ Yes             | General fees                   |
| Books/Materials   | ❌ No              | Already consumed/ordered       |
| Uniform Fee       | ❌ No              | Already ordered/issued         |
| Insurance/ID Fees | ❌ No              | Administrative processing done |
| Registration Fee  | ❌ No              | One-time enrollment processing |

### Schema Changes

**1. Add `isRefundable` to `fee_item_types` (master definition):**

```sql
ALTER TABLE fee_item_types ADD COLUMN is_refundable BOOLEAN NOT NULL DEFAULT true;
```

**2. Add `isRefundable` to `assessment_items` (snapshot at assessment time):**

```sql
ALTER TABLE assessment_items ADD COLUMN is_refundable BOOLEAN NOT NULL DEFAULT true;
```

**Default logic during assessment creation:**

- Copy `isRefundable` from `feeItemTypes` via `feeTemplateItem.feeItemTypeId`
- Same pattern as existing `isDiscount` field
- Admin can override per-student if needed (future enhancement)

### Time Factor: Fixed Cutoff Date

**System Settings:** (stored in `systemSettings` table)

- `refund_cutoff_start_date` — Reference start date (e.g., "2026-05-01" = start of SY)
- `refund_cutoff_days` — Number of days from start date (default: 30)

**Calculation:**

```
cutoffDate = refund_cutoff_start_date + refund_cutoff_days
           = "2026-05-01" + 30 days
           = "2026-05-31"

If today <= cutoffDate:
  → ELIGIBLE for refund (refundable items get reversed)
Else:
  → NOT eligible (all payments forfeited, no reversals)
```

**Example:**

- Settings: `refund_cutoff_start_date = "2026-05-01"`, `refund_cutoff_days = 30`
- Cutoff date = May 31, 2026
- Student A enrolls May 15, cancels May 25 → ✅ Eligible (May 25 < May 31)
- Student B enrolls May 15, cancels June 10 → ❌ Not eligible (June 10 > May 31)
- Student C enrolls June 1, cancels June 5 → ❌ Not eligible (June 5 > May 31)

**Note:** The cutoff applies to ALL students equally based on the school calendar, not individual enrollment dates.

### Refund Calculation Formula

```
IF within cutoff period:
  Refundable Amount = SUM(payments allocated to refundable items)
  Non-Refundable Amount = SUM(payments allocated to non-refundable items)

  On cancellation approval:
  - Refundable portion → Reversed (creates negative payment entries)
  - Non-refundable portion → Stays as "collected" (no reversal)

ELSE (past cutoff period):
  All payments forfeited → No reversals created
  totalPaid remains unchanged (collected)
```

### Example Scenarios

**Scenario A: Within Cutoff (e.g., Day 15 of 30-day cutoff)**

| Item      | Amount  | Paid    | Refundable | On Cancel            |
| --------- | ------- | ------- | ---------- | -------------------- |
| Tuition   | ₱20,000 | ₱10,000 | ✅         | **Reversed**         |
| Books     | ₱2,000  | ₱2,000  | ❌         | Kept                 |
| Uniform   | ₱1,500  | ₱1,500  | ❌         | Kept                 |
| **Total** | ₱23,500 | ₱13,500 | —          | **₱10,000 refunded** |

**Scenario B: Past Cutoff (e.g., Day 45 of 30-day cutoff)**

| Item      | Amount  | Paid    | Refundable | On Cancel                       |
| --------- | ------- | ------- | ---------- | ------------------------------- |
| Tuition   | ₱20,000 | ₱10,000 | ✅         | **Forfeited**                   |
| Books     | ₱2,000  | ₱2,000  | ❌         | Kept                            |
| Uniform   | ₱1,500  | ₱1,500  | ❌         | Kept                            |
| **Total** | ₱23,500 | ₱13,500 | —          | **₱0 refunded (all forfeited)** |

---

## Clearance System (Comprehensive)

### Clearance Types

| Type                    | Code                      | Trigger                             | Auto-Generate           |
| ----------------------- | ------------------------- | ----------------------------------- | ----------------------- |
| End-of-Year             | `end_of_year`             | School year closing                 | ✅ Yes (batch) + manual |
| Enrollment Cancellation | `enrollment_cancellation` | Enrollment cancelled with balance   | ✅ Yes (auto)           |
| Transfer Out            | `transfer_out`            | Student transfers to another school | Manual                  |
| Graduation              | `graduation`              | Student graduates                   | ✅ Yes (batch)          |
| Other                   | `other`                   | Custom/special cases                | Manual                  |

### Clearance Status Logic

| Balance                | Status    | Can Release Documents? |
| ---------------------- | --------- | ---------------------- |
| `<= 0` (paid/overpaid) | `cleared` | ✅ Yes                 |
| `> 0` (has balance)    | `pending` | ❌ No (until settled)  |

### Clearance Record Structure

```sql
CREATE TABLE student_clearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id),
  enrollment_id UUID REFERENCES enrollments(id),
  school_year_id UUID REFERENCES school_years(id),
  clearance_type clearance_type_enum NOT NULL,
  outstanding_amount NUMERIC(12, 2) NOT NULL,  -- Snapshot at creation
  status clearance_status_enum NOT NULL DEFAULT 'pending',
  -- For pending clearances (balance > 0)
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_type resolution_type_enum,  -- 'paid', 'waived', 'written_off'
  resolution_remarks TEXT,
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);

CREATE TYPE clearance_type_enum AS ENUM (
  'end_of_year', 'enrollment_cancellation', 'transfer_out', 'graduation', 'other'
);
CREATE TYPE clearance_status_enum AS ENUM ('cleared', 'pending', 'waived');
CREATE TYPE resolution_type_enum AS ENUM ('paid', 'waived', 'written_off');
```

### End-of-Year Clearance Generation

**Auto-generation (at SY close):**

```typescript
// When school year status changes to 'closed'
async function generateEndOfYearClearances(schoolYearId: string) {
  const activeEnrollments = await getActiveEnrollments(schoolYearId);

  for (const enrollment of activeEnrollments) {
    const balance = await getAssessmentBalance(enrollment.assessmentId);

    await db.insert(studentClearances).values({
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      schoolYearId,
      clearanceType: "end_of_year",
      outstandingAmount: balance,
      status: balance <= 0 ? "cleared" : "pending",
    });
  }
}
```

**Manual generation (individual):**

- Staff can generate clearance for specific student anytime
- Useful for early requests or special cases

### Clearance Resolution Options

| Resolution      | Description                             | When to Use                          |
| --------------- | --------------------------------------- | ------------------------------------ |
| **Paid**        | Student has settled balance via payment | Balance now ₱0                       |
| **Waived**      | Admin forgives the balance              | Scholarship, hardship, special cases |
| **Written Off** | Balance recorded as uncollectible       | After extended non-payment           |

### Scenario: Cancellation with Outstanding Balance

When an enrollment is cancelled (either direct or via approval) with an **unpaid balance**:

1. **Cancellation proceeds** (admin can override balance check)
2. **Clearance record created** automatically (type: `enrollment_cancellation`)
3. **Document requests blocked** until clearance is resolved

### Document Release Check

Before releasing any document (transcript, Form 137, good moral, etc.):

```typescript
// In document request processing
const pendingClearances = await getPendingClearances(studentId);
if (pendingClearances.length > 0) {
  return {
    error:
      "Student has pending clearances. Please resolve before releasing documents.",
  };
}
```

### Example Flow

```
Student owes ₱5,000 → Admin approves cancellation (past cutoff, no refund) →
  ↓
Clearance record created: { type: 'enrollment_cancellation', amount: ₱5,000, status: 'pending' }
  ↓
Student requests transcript → BLOCKED (pending clearance)
  ↓
Option A: Student pays ₱5,000 → Admin approves clearance → Transcript released
Option B: Admin waives balance (with reason) → Clearance status = 'waived' → Transcript released
```

### Late Settlement (Even Years Later)

**Critical:** Clearance records are **permanent** and can be settled at any time:

```
2026: Student cancels enrollment (past cutoff, owes ₱5,000)
  → Clearance created, enrollment cancelled, assessment cancelled

2030: Student returns to request transcript
  → System checks: "Pending clearance found (₱5,000)"
  → Student pays ₱5,000
  → Admin approves clearance
  → Transcript released
```

**Implementation Notes:**

1. **Clearance records persist indefinitely** (no expiration, soft delete only)
2. **Late payment creates new payment record** linked to the cancelled assessment
3. **Assessment remains cancelled** but payment can be recorded against it
4. **Audit trail preserved:** Original cancellation + late payment both logged

### Payment to Cancelled Assessment

When a student pays to settle a clearance:

```typescript
// Special payment type for settled clearances
const payment = await recordPayment({
  assessmentId: clearance.assessmentId, // References the cancelled assessment
  amount: clearance.outstandingAmount,
  paymentType: "clearance_settlement", // New payment type
  referenceNumber: orNumber,
  remarks: `Settlement for cancelled enrollment clearance #${clearance.id}`,
});

// Update clearance status
await approveClearance(clearanceId, {
  approvedBy: session.userId,
  remarks: `Settled via payment OR# ${orNumber}`,
});
```

### Key Guarantees

| Aspect               | Behavior                             |
| -------------------- | ------------------------------------ |
| Clearance expiration | None - persists forever              |
| Balance visibility   | Always visible in student record     |
| Payment acceptance   | Yes - can pay cancelled assessment   |
| Assessment status    | Stays "cancelled" even after payment |
| Clearance status     | Updates to "approved" after payment  |
| Document release     | Unblocked after clearance approved   |

---

## Transaction Blocking (During Pending Cancellation)

When an enrollment has a **pending cancellation request**, the following transactions are **blocked**:

| Transaction       | Blocked? | Error Message                                                             |
| ----------------- | -------- | ------------------------------------------------------------------------- |
| Record payment    | ✅ Yes   | "Cannot record payment: enrollment has a pending cancellation request"    |
| Void payment      | ✅ Yes   | "Cannot void payment: enrollment has a pending cancellation request"      |
| Apply discount    | ✅ Yes   | "Cannot apply discount: enrollment has a pending cancellation request"    |
| Modify assessment | ✅ Yes   | "Cannot modify assessment: enrollment has a pending cancellation request" |
| Encode grades     | ❌ No    | Grades can still be recorded (academic record)                            |

### Implementation

Add a helper function to check for pending cancellation:

```typescript
// src/features/enrollments/enrollment-cancellation.queries.ts
export async function hasPendingCancellationRequest(
  enrollmentId: string,
): Promise<boolean> {
  const request = await db.query.enrollmentCancellationRequests.findFirst({
    where: and(
      eq(enrollmentCancellationRequests.enrollmentId, enrollmentId),
      eq(enrollmentCancellationRequests.status, "pending"),
      isNull(enrollmentCancellationRequests.deletedAt),
    ),
  });
  return !!request;
}
```

### Files to Update with Blocking Check

| File                                              | Action to Block            |
| ------------------------------------------------- | -------------------------- |
| `src/features/payments/payments.actions.ts`       | `recordPaymentAction`      |
| `src/features/payments/void-requests.actions.ts`  | `requestPaymentVoidAction` |
| `src/features/assessments/assessments.actions.ts` | `updateAssessmentAction`   |
| `src/features/discounts/discounts.actions.ts`     | `applyDiscountAction`      |

---

## Payment Rollback Behavior (Critical)

When an **enrolled** enrollment is cancelled with existing payments:

1. **Calculate refundable amount** (sum of payments allocated to refundable items)
2. **Only refundable portions are reversed** (non-refundable stays collected)
3. **Reversal payment entries created** with negative amounts (for refundable only)
4. **Assessment balance recalculated** (non-refundable remains as "paid")
5. **Assessment marked cancelled** (`billingStatus = 'cancelled'`)
6. **Enrollment marked cancelled** (`status = 'cancelled'`)

### Rollback Transaction Steps (in `approveEnrollmentCancellationAction`)

```typescript
await db.transaction(async (tx) => {
  // 1. Lock enrollment
  // 2. Lock assessment
  // 3. Get all assessment items with refundability flag
  // 4. Get all payment allocations
  // 5. Calculate refundable vs non-refundable amounts
  // 6. For refundable allocations:
  //    - Mark original payment allocation as 'reversed'
  //    - Create reversal entry (negative amount)
  // 7. Update assessment:
  //    - totalPaid = non-refundable amount only
  //    - billingStatus = 'cancelled'
  // 8. Mark enrollment as cancelled
  // 9. Update cancellation request as approved
  // 10. Audit logs: include refund breakdown
});
```

### Key Differences from Void Workflow

| Aspect       | Payment Void             | Enrollment Cancellation                    |
| ------------ | ------------------------ | ------------------------------------------ |
| Scope        | Single payment           | ALL payments for assessment                |
| Refund scope | Full payment reversed    | **Only refundable items reversed**         |
| Trigger      | Void request approval    | Cancellation request approval              |
| Assessment   | Remains active           | Marked cancelled                           |
| Enrollment   | May revert to "assessed" | Marked cancelled                           |
| Audit        | `payment_reversed`       | `enrollment_cancelled_with_partial_refund` |

---

## Database Schema

### New Enum: `cancellation_reason_type`

```sql
CREATE TYPE cancellation_reason_type AS ENUM (
  'transfer', 'financial', 'medical', 'relocation',
  'personal', 'administrative', 'non_compliance', 'disciplinary', 'other'
);
```

### New Table: `enrollment_cancellation_requests`

```sql
CREATE TABLE enrollment_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason_type cancellation_reason_type NOT NULL,  -- Predefined reason
  remarks TEXT,                                    -- Optional details (required when reason_type = 'other')
  status enrollment_cancellation_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_remarks TEXT,
  deleted_at TIMESTAMP,
  deleted_by UUID REFERENCES users(id)
);

CREATE TYPE enrollment_cancellation_request_status AS ENUM (
  'pending', 'approved', 'rejected', 'cancelled'
);

-- Indexes
CREATE INDEX ecr_enrollment_idx ON enrollment_cancellation_requests(enrollment_id);
CREATE INDEX ecr_status_idx ON enrollment_cancellation_requests(status);
CREATE INDEX ecr_pending_idx ON enrollment_cancellation_requests(status, deleted_at)
  WHERE status = 'pending' AND deleted_at IS NULL;
```

### Validation Rule

- When `reason_type = 'other'`, the `remarks` field is **required** (min 10 chars)
- For all other reason types, `remarks` is optional

---

## Files to Create

| File                                                                | Purpose                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/lib/constants/cancellation-reasons.ts`                         | Predefined cancellation reason constants + labels              |
| `src/features/enrollments/enrollment-cancellation.schema.ts`        | Zod validation schemas                                         |
| `src/features/enrollments/enrollment-cancellation.actions.ts`       | Server actions (request/approve/reject/withdraw)               |
| `src/features/enrollments/enrollment-cancellation.queries.ts`       | Database queries                                               |
| `src/features/enrollments/components/RequestCancellationForm.tsx`   | Form with reason dropdown + optional remarks                   |
| `src/features/enrollments/components/CancellationRequestsTable.tsx` | Admin inbox table                                              |
| `src/features/enrollments/components/CancellationRequestDetail.tsx` | Request detail with approve/reject                             |
| `src/features/enrollments/components/WithdrawRequestButton.tsx`     | Self-cancel button                                             |
| `src/features/clearances/clearances.schema.ts`                      | Clearance validation schemas                                   |
| `src/features/clearances/clearances.actions.ts`                     | Clearance actions (generate, resolve, waive, write-off)        |
| `src/features/clearances/clearances.queries.ts`                     | Clearance queries (get pending, check eligibility, by student) |
| `src/features/clearances/components/ClearanceTable.tsx`             | Admin clearance management table                               |
| `src/features/clearances/components/GenerateClearanceForm.tsx`      | Manual clearance generation form                               |
| `src/features/clearances/components/StudentClearanceCard.tsx`       | Student's clearance status display                             |
| `src/app/admin/cancellation-requests/page.tsx`                      | Admin inbox page                                               |
| `src/app/admin/cancellation-requests/[requestId]/page.tsx`          | Request detail page                                            |
| `src/app/admin/clearances/page.tsx`                                 | Clearance management page                                      |
| `src/app/admin/clearances/[clearanceId]/page.tsx`                   | Clearance detail/resolution page                               |
| `src/app/staff/students/[studentId]/clearances/page.tsx`            | Student clearance history                                      |

## Files to Modify

| File                                                | Changes                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/lib/db/schema.ts`                              | Add `systemSettings` + `enrollmentCancellationRequests` + `studentClearances` tables + `isRefundable` columns |
| `src/features/enrollments/enrollments.actions.ts`   | Block direct `enrolled` → `cancelled`, route to request flow                                                  |
| `src/features/assessments/assessments.actions.ts`   | Copy `isRefundable` + add cancellation blocking check                                                         |
| `src/features/payments/payments.actions.ts`         | Add cancellation blocking check + `clearance_settlement` payment type                                         |
| `src/features/payments/void-requests.actions.ts`    | Add cancellation blocking check to void requests                                                              |
| `src/features/discounts/discounts.actions.ts`       | Add cancellation blocking check to `applyDiscountAction`                                                      |
| `src/features/fees/components/FeeItemTypeForm.tsx`  | Add `isRefundable` checkbox to fee type management UI                                                         |
| `src/features/settings/settings.actions.ts`         | Add action to get/set `refund_cutoff_days` setting                                                            |
| `src/app/admin/settings/page.tsx`                   | Add "Refund Cutoff" settings + "Generate Clearances" action                                                   |
| `src/features/school-years/school-years.actions.ts` | Add `closeSchoolYearAction` with auto clearance generation                                                    |
| `src/app/staff/dashboard/page.tsx`                  | Add pending requests count badge (admin only)                                                                 |
| `src/app/staff/enrollments/[enrollmentId]/page.tsx` | Add "Request Cancellation" button + history                                                                   |

### System Settings Table (New)

Create `systemSettings` table for configurable system-wide settings:

```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);
```

**Initial Settings:**

| Key                        | Value        | Description                                               |
| -------------------------- | ------------ | --------------------------------------------------------- |
| `refund_cutoff_start_date` | `2026-05-01` | Reference start date for refund cutoff (usually SY start) |
| `refund_cutoff_days`       | `30`         | Days from start date within which refunds are allowed     |

**Computed Cutoff Date:** `refund_cutoff_start_date + refund_cutoff_days` = May 31, 2026

---

## Server Actions

### 1. `requestEnrollmentCancellationAction`

- Permission: `enrollments:cancel`
- Validates: enrollment status = `enrolled`, no existing pending request
- Creates: cancellation request with status `pending`
- Audit: `enrollments:request_cancellation`

### 2. `approveEnrollmentCancellationAction`

- Permission: role = `admin` or `super_admin`
- Validates: request status = `pending`, enrollment still enrolled
- **Time Check (Critical):**
  1. Fetch `refund_cutoff_start_date` and `refund_cutoff_days` from system settings
  2. Calculate `cutoffDate = refund_cutoff_start_date + refund_cutoff_days`
  3. Determine refund eligibility: `isEligibleForRefund = today <= cutoffDate`
- **Refund Calculation:**
  IF `isEligibleForRefund`:
  1. Fetch all assessment items with `isRefundable` flag
  2. Fetch all payment allocations for this assessment
  3. Calculate:
     - `refundableAmount` = sum of allocations to refundable items
     - `nonRefundableAmount` = sum of allocations to non-refundable items
  4. For refundable allocations only:
     - Mark allocation as `status = 'reversed'`
     - Create reversal entry (negative amount, `kind = 'reversal'`)
     - Reference number: `REV-{orNumber}` or `REV-{paymentId.slice(0,8)}`
  5. Update assessment: - `billingStatus = 'cancelled'` - `totalPaid = nonRefundableAmount` - `balance = 0`
     ELSE (past cutoff):
  6. No payment reversals created
  7. All payments considered forfeited
  8. Update assessment: `billingStatus = 'cancelled'` (totalPaid unchanged)
- Executes:
  - Update enrollment: `status = 'cancelled'`, set `cancelledAt`, `cancelledBy`, `cancelRemarks`
  - Update request: `status = 'approved'`, set `reviewedBy`, `reviewedAt`, `reviewRemarks`
- Audit: `enrollments:approve_cancellation` with breakdown:
  - `refundedAmount`, `forfeitedAmount`, `cutoffDate`, `cancellationDate`, `isEligibleForRefund`

### 3. `rejectEnrollmentCancellationAction`

- Permission: role = `admin` or `super_admin`
- Validates: request status = `pending`
- Executes: Update request `status = 'rejected'` with required rejection reason
- Audit: `enrollments:reject_cancellation`

### 4. `withdrawCancellationRequestAction`

- Permission: `requestedBy === session.userId`
- Validates: request status = `pending`
- Executes: Update request `status = 'cancelled'`
- Audit: `enrollments:withdraw_cancellation`

---

## Modify Existing Action

### `updateEnrollmentStatusAction` Changes

```typescript
// Add routing logic for enrolled enrollments
if (action === "cancel" && enrollment.status === "enrolled") {
  return {
    message:
      "Enrolled enrollments require approval. Please submit a cancellation request instead.",
  };
}

// Only allow direct cancellation for pending/assessed
if (
  action === "cancel" &&
  !["pending", "assessed"].includes(enrollment.status)
) {
  return { message: "Invalid enrollment status for direct cancellation." };
}

// For "assessed" status with existing assessment:
if (action === "cancel" && enrollment.status === "assessed") {
  await db.transaction(async (tx) => {
    // 1. Check if assessment exists
    const assessment = await getAssessmentByEnrollmentId(enrollment.id);

    if (assessment && assessment.totalPaid > 0) {
      // 2. Apply refund policy (same logic as approval flow)
      const startDate = await getSystemSetting("refund_cutoff_start_date");
      const cutoffDays = await getSystemSetting("refund_cutoff_days");
      const cutoffDate = addDays(new Date(startDate), cutoffDays);
      const isEligibleForRefund = new Date() <= cutoffDate;

      if (isEligibleForRefund) {
        // Reverse refundable allocations
        await reverseRefundableAllocations(tx, assessment.id);
      }
      // Else: all payments forfeited, no reversals
    }

    // 3. Cancel assessment
    if (assessment) {
      await cancelAssessment(tx, assessment.id);
    }

    // 4. Cancel enrollment
    await cancelEnrollment(tx, enrollment.id, reason);
  });
}
```

---

## UI Flow

### Flow 1a: Direct Cancellation (pending - no assessment)

```
Registrar → Cancel button → Confirm dialog (reason required) →
updateEnrollmentStatusAction() →
  - Enrollment status = 'cancelled'
  - No assessment exists, nothing to refund
→ Success
```

### Flow 1b: Direct Cancellation (assessed - has assessment, may have payments)

```
Registrar → Cancel button → Confirm dialog (reason required) →
updateEnrollmentStatusAction() →
  ↓
Same refund logic as approval flow:
  1. Check time cutoff (days since enrollment created)
  2. IF within cutoff + has payments:
     - Reverse refundable payment allocations
     - Keep non-refundable as collected
  3. Mark assessment as cancelled
  4. Mark enrollment as cancelled
  5. Audit log with refund breakdown
→ Success
```

**Key Point:** "Assessed" enrollments may have partial payments. The same refund policy applies:

- Within cutoff: Refundable items reversed
- Past cutoff: All payments forfeited

### Flow 2: Request Cancellation (enrolled)

```
Registrar → "Request Cancellation" button →
Select reason from dropdown → Enter remarks (required if "Other") →
requestEnrollmentCancellationAction() → Pending in inbox
```

### Flow 3: Admin Approval (with Payment Rollback)

```
Admin → Dashboard notification → Inbox → Review request →
Approve (with optional remarks) → approveEnrollmentCancellationAction() →
  ↓
Transaction:
  1. Lock enrollment + assessment
  2. Fetch all posted payments
  3. For each payment:
     - Mark as reversed
     - Create reversal entry (negative amount)
     - Update assessment balance
  4. Mark assessment cancelled
  5. Mark enrollment cancelled
  6. Audit logs for all operations
  ↓
Success: Enrollment cancelled + all payments reversed
```

### Flow 4: Admin Rejection

```
Admin → Inbox → Review request → Reject (with required reason) →
rejectEnrollmentCancellationAction() → Request rejected, enrollment unchanged
```

### Flow 5: Requester Withdrawal

```
Requester → Enrollment detail → "Withdraw" button → Confirm →
withdrawCancellationRequestAction() → Request cancelled
```

---

## Implementation Phases

### Phase 1: Database & Constants

1. Create `src/lib/constants/cancellation-reasons.ts` with predefined reasons
2. Add `isRefundable` to `feeItemTypes` table in `schema.ts`
3. Add `isRefundable` to `assessmentItems` table in `schema.ts`
4. Add `cancellationReasonTypeEnum` PostgreSQL enum
5. Add `enrollmentCancellationRequests` table + relations
6. Add `refund_cutoff_days` to seed data for `systemSettings`
7. Generate and apply migration

### Phase 2: Schemas & Queries

1. Create `enrollment-cancellation.schema.ts` with all validation schemas
2. Create `enrollment-cancellation.queries.ts` with all queries
3. Update `feeItemTypes` schema to include `isRefundable` validation

### Phase 3: Server Actions

1. Create `enrollment-cancellation.actions.ts` with all 4 actions
2. Modify `enrollments.actions.ts` to block direct enrolled cancellation
3. Update assessment creation to copy `isRefundable` from `feeItemTypes`

### Phase 4: UI Components

1. Create `RequestCancellationForm.tsx` (reason dropdown + remarks)
2. Create `CancellationRequestsTable.tsx`
3. Create `CancellationRequestDetail.tsx` (shows refund breakdown)
4. Create `WithdrawRequestButton.tsx`
5. Update `FeeItemTypeForm.tsx` to include `isRefundable` checkbox

### Phase 5: Pages & Integration

1. Create `/admin/cancellation-requests/page.tsx`
2. Create `/admin/cancellation-requests/[requestId]/page.tsx`
3. Modify staff dashboard to show pending count
4. Modify enrollment detail to show request button + history

### Phase 6: Testing

1. Test direct cancellation (pending/assessed)
2. Test approval workflow with partial refund
3. Test full refund scenario
4. Test no refund scenario
5. Verify permission enforcement
6. Verify audit logging with refund breakdown

---

## Verification Plan

1. **Direct Cancellation Test (pending - no assessment):**
   - Create enrollment with status `pending` → Cancel with reason
   - Verify: Enrollment cancelled, no assessment to cancel

2. **Direct Cancellation Test (assessed - with payments, within cutoff):**
   - Create enrollment with status `assessed` (15 days old)
   - Add payment: ₱5,000 to tuition (refundable)
   - Cancel with reason
   - Verify:
     - Enrollment cancelled
     - Assessment cancelled
     - ₱5,000 reversed (within cutoff)

2b. **Direct Cancellation Test (assessed - with payments, past cutoff):**

- Create enrollment with status `assessed` (45 days old)
- Add payment: ₱5,000 to tuition (refundable)
- Cancel with reason
- Verify:
  - Enrollment cancelled
  - Assessment cancelled
  - ₱5,000 forfeited (past cutoff, no reversal)

2. **Request Workflow Test:**
   - Create enrollment with status `enrolled` → Try direct cancel → Verify blocked
   - Request cancellation → Verify appears in admin inbox
   - Approve → Verify enrollment cancelled + assessment cancelled

3. **Within Cutoff - Partial Refund Test:**
   - Set `refund_cutoff_start_date = "2026-05-01"`, `refund_cutoff_days = 30`
   - Cutoff date = May 31, 2026
   - Today = May 20, 2026 (within cutoff)
   - Create enrollment with assessment:
     - Tuition: ₱20,000 (refundable) → paid ₱10,000
     - Books: ₱2,000 (non-refundable) → paid ₱2,000
     - Uniform: ₱1,500 (non-refundable) → paid ₱1,500
   - Request cancellation → Admin approves
   - Verify:
     - `isEligibleForRefund = true` (May 20 < May 31)
     - Only tuition allocation reversed (₱10,000)
     - Books and uniform allocations NOT reversed
     - Assessment `totalPaid = ₱3,500` (non-refundable kept)
     - Assessment `billingStatus = 'cancelled'`
     - Audit log shows: `refundedAmount: 10000`, `cutoffDate: "2026-05-31"`

4. **Past Cutoff - No Refund Test (Critical):**
   - Set `refund_cutoff_start_date = "2026-05-01"`, `refund_cutoff_days = 30`
   - Cutoff date = May 31, 2026
   - Today = June 15, 2026 (past cutoff)
   - Create enrollment with same assessment
   - Request cancellation → Admin approves
   - Verify:
     - `isEligibleForRefund = false` (June 15 > May 31)
     - NO reversals created
     - All ₱13,500 forfeited
     - Assessment `totalPaid = ₱13,500` (unchanged)
     - Assessment `billingStatus = 'cancelled'`
     - Audit log shows: `forfeitedAmount: 13500`, `cutoffDate: "2026-05-31"`

5. **Within Cutoff - Full Refund Test:**
   - Set cutoff date = May 31, 2026
   - Today = May 25, 2026
   - Create enrollment where all fee items are refundable
   - Pay full amount → Request cancellation → Approve
   - Verify: All payments reversed, `totalPaid = 0`

6. **Cutoff Edge Case - Exactly at Cutoff Date:**
   - Set cutoff date = May 31, 2026
   - Today = May 31, 2026 (exactly on cutoff)
   - Request cancellation → Approve
   - Verify: Should be eligible (May 31 <= May 31)

7. **Rejection Test:**
   - Request cancellation → Reject → Verify enrollment still enrolled

8. **Withdrawal Test:**
   - Request cancellation → Withdraw → Verify request status = cancelled

9. **Permission Tests:**
   - Non-admin tries to approve → Verify blocked
   - Non-requester tries to withdraw → Verify blocked

10. **System Settings Test:**
    - Set `refund_cutoff_start_date = "2026-05-01"`, `refund_cutoff_days = 30` → Cutoff = May 31
    - Change to `refund_cutoff_days = 60` → Cutoff = June 30
    - Verify: Cancellations after May 31 but before June 30 now eligible for refund
    - Note: Cutoff is calculated at time of approval (not request submission)

11. **Transaction Blocking Tests:**
    - Create enrollment → Submit cancellation request
    - Try to record payment → Verify blocked with error message
    - Try to void existing payment → Verify blocked
    - Try to apply discount → Verify blocked
    - Approve/reject cancellation → Verify transactions unblocked

12. **Clearance Workflow Tests (Cancellation):**
    - Cancel enrollment with ₱5,000 outstanding balance (past cutoff)
    - Verify: Clearance record created with `type = 'enrollment_cancellation'`, `status = 'pending'`
    - Try to release document → Verify blocked ("pending clearance")
    - Pay ₱5,000 → Resolve clearance as 'paid' → Document released
    - Alternate: Admin resolves as 'waived' with reason → Document released

12b. **End-of-Year Clearance Tests:** - Close school year with 3 students: - Student A: Balance = ₱0 (fully paid) - Student B: Balance = -₱500 (overpaid) - Student C: Balance = ₱3,000 (unpaid) - Verify clearances generated: - Student A: `status = 'cleared'` (balance <= 0) - Student B: `status = 'cleared'` (balance <= 0) - Student C: `status = 'pending'` (balance > 0) - Student C requests transcript → Blocked - Student C pays ₱3,000 → Resolve clearance → Transcript released

12c. **Manual Clearance Generation Test:** - Generate clearance manually for specific student mid-year - Verify: Clearance created with correct balance snapshot - Verify: Does not duplicate if clearance already exists for same enrollment + type

13. **Late Settlement Test (Critical):**
    - Cancel enrollment with ₱5,000 balance (past cutoff) in SY 2025-2026
    - Verify: Clearance record persists with no expiration
    - Simulate payment years later (e.g., different school year)
    - Verify: Payment accepted to cancelled assessment (`paymentType = 'clearance_settlement'`)
    - Verify: Clearance status updated to 'approved'
    - Verify: Assessment stays 'cancelled' but `totalPaid` increased
    - Verify: Document release now unblocked

14. **Audit Log Verification:**
    - Check all actions generate proper audit entries
    - Verify refund breakdown includes: `refundedAmount`, `forfeitedAmount`, `cutoffDate`, `cancellationDate`
    - Verify clearance actions are logged (create, approve, waive)
    - Verify late settlement payments are logged with clearance reference

---

## Key Files Reference

- Schema: `src/lib/db/schema.ts:369-401` (enrollments table)
- Existing action: `src/features/enrollments/enrollments.actions.ts:345-507`
- Void workflow (pattern to follow): `src/features/payments/void-requests.actions.ts`
- Assessment balance utility: `src/lib/utils/assessment-balance.ts` (`applyAssessmentBalanceDelta()`)
- Audit logger: `src/lib/utils/audit-logger.ts`
- Tx helpers: `src/lib/db/tx-helpers.ts` (`lockEnrollment`, `lockAssessment`, `lockPayment`)

---

# APPENDIX A: Enrollment Cancellation Process Flow

## Process Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ENROLLMENT CANCELLATION FLOW                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│   START      │
│ (Cancel Req) │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Check Enrollment     │
│ Status               │
└──────┬───────────────┘
       │
       ├─────── "pending" ──────────────────────────────────┐
       │                                                     │
       ├─────── "assessed" ─────┐                           │
       │                        ▼                           │
       │              ┌─────────────────────┐               │
       │              │ Check if payments   │               │
       │              │ exist               │               │
       │              └──────┬──────────────┘               │
       │                     │                              │
       │           ┌─────────┴─────────┐                    │
       │           │                   │                    │
       │      Has payments        No payments               │
       │           │                   │                    │
       │           ▼                   │                    │
       │    ┌─────────────────┐        │                    │
       │    │ Apply Refund    │        │                    │
       │    │ Policy          │        │                    │
       │    └──────┬──────────┘        │                    │
       │           │                   │                    │
       │           └───────┬───────────┘                    │
       │                   │                                │
       │                   ▼                                │
       │         ┌─────────────────────┐                    │
       │         │ Direct Cancel       │◄───────────────────┘
       │         │ (No Approval Req)   │
       │         └──────┬──────────────┘
       │                │
       │                ▼
       │         ┌─────────────────────┐
       │         │ CANCELLED           │
       │         │ (Process Complete)  │
       │         └─────────────────────┘
       │
       └─────── "enrolled" ─────────────────────────────────┐
                                                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │ Submit Cancellation     │
                                              │ Request                 │
                                              │ (Select reason + remarks)│
                                              └──────────┬──────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────────────┐
                                              │ Request Status: PENDING │
                                              │ (Waiting for Admin)     │
                                              └──────────┬──────────────┘
                                                         │
                               ┌─────────────────────────┼─────────────────────────┐
                               │                         │                         │
                               ▼                         ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
                    │ Admin REJECTS   │       │ Admin APPROVES  │       │ Requester       │
                    │ (with reason)   │       │ (with remarks)  │       │ WITHDRAWS       │
                    └────────┬────────┘       └────────┬────────┘       └────────┬────────┘
                             │                         │                         │
                             ▼                         ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
                    │ Request Status: │       │ Apply Refund    │       │ Request Status: │
                    │ REJECTED        │       │ Policy          │       │ CANCELLED       │
                    │ (Enrollment     │       └────────┬────────┘       │ (Enrollment     │
                    │ unchanged)      │                │                │ unchanged)      │
                    └─────────────────┘                │                └─────────────────┘
                                                       ▼
                                              ┌─────────────────────┐
                                              │ Check Outstanding   │
                                              │ Balance             │
                                              └──────────┬──────────┘
                                                         │
                                      ┌──────────────────┴──────────────────┐
                                      │                                     │
                                 Balance = 0                           Balance > 0
                                      │                                     │
                                      │                                     ▼
                                      │                        ┌─────────────────────────┐
                                      │                        │ Create CLEARANCE        │
                                      │                        │ Record                  │
                                      │                        │ (Status: pending)       │
                                      │                        └──────────┬──────────────┘
                                      │                                   │
                                      ▼                                   ▼
                              ┌─────────────────┐              ┌─────────────────────────┐
                              │ CANCELLED       │              │ CANCELLED               │
                              │ (Complete)      │              │ (Clearance Required)    │
                              └─────────────────┘              └─────────────────────────┘
```

---

## Refund Policy Decision Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       REFUND POLICY FLOW                             │
│          (Based on FIXED cutoff date, not enrollment date)           │
└─────────────────────────────────────────────────────────────────────┘

┌───────────────────────┐
│ Start Refund Check    │
│ (has payments)        │
└───────────┬───────────┘
            │
            ▼
┌───────────────────────────────────────┐
│ Get from system settings:             │
│ • refund_cutoff_start_date (e.g. May 1)│
│ • refund_cutoff_days (e.g. 30)        │
│                                       │
│ Calculate:                            │
│ cutoffDate = startDate + days         │
│            = May 1 + 30 = May 31      │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│ Compare: today vs cutoffDate          │
└───────────────────┬───────────────────┘
                    │
    ┌───────────────┴───────────────┐
    │                               │
    ▼                               ▼
┌───────────────────┐       ┌───────────────────┐
│ WITHIN CUTOFF     │       │ PAST CUTOFF       │
│ (today <= May 31) │       │ (today > May 31)  │
└─────────┬─────────┘       └─────────┬─────────┘
          │                           │
          ▼                           ▼
┌───────────────────────┐   ┌───────────────────────┐
│ For each payment      │   │ NO REFUND             │
│ allocation:           │   │ All payments          │
│                       │   │ FORFEITED             │
│ Is item refundable?   │   │                       │
│                       │   │ (clearance created    │
│ ✅ Yes → REVERSE      │   │ if balance > 0)       │
│ ❌ No  → KEEP         │   │                       │
└───────────────────────┘   └───────────────────────┘

Example:
• Settings: start_date = May 1, days = 30 → cutoff = May 31
• Student A cancels May 25 → ✅ Eligible (May 25 ≤ May 31)
• Student B cancels June 5 → ❌ Not eligible (June 5 > May 31)
```

---

## Clearance Settlement Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CLEARANCE SETTLEMENT FLOW                         │
│              (Can happen immediately or years later)                 │
└─────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐
│ Student requests documents    │
│ (e.g., transcript, Form 137) │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│ Check for pending clearances  │
│ for this student              │
└───────────────┬───────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌───────────────┐   ┌───────────────────────────────┐
│ No pending    │   │ Has pending clearance         │
│ clearances    │   │ (e.g., ₱5,000 from 2026)     │
└───────┬───────┘   └───────────────┬───────────────┘
        │                           │
        ▼                           ▼
┌───────────────┐   ┌───────────────────────────────┐
│ ✅ RELEASE    │   │ ❌ BLOCKED                    │
│ DOCUMENTS     │   │ "Pending clearance: ₱5,000"  │
└───────────────┘   └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │ Option A:             │       │ Option B:             │
        │ Student pays balance  │       │ Admin WAIVES balance  │
        │ (₱5,000)              │       │ (with reason)         │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │ Record payment:       │       │ Clearance status:     │
        │ type = 'clearance_    │       │ WAIVED                │
        │ settlement'           │       │                       │
        └───────────┬───────────┘       └───────────┬───────────┘
                    │                               │
                    ▼                               │
        ┌───────────────────────┐                   │
        │ Clearance status:     │                   │
        │ APPROVED              │                   │
        └───────────┬───────────┘                   │
                    │                               │
                    └───────────────┬───────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │ ✅ RELEASE DOCUMENTS  │
                        └───────────────────────┘
```

---

## Transaction Blocking During Cancellation Request

```
┌─────────────────────────────────────────────────────────────────────┐
│           TRANSACTION BLOCKING (PENDING CANCELLATION)                │
└─────────────────────────────────────────────────────────────────────┘

When enrollment has PENDING cancellation request:

┌─────────────────────────────────────────────┐
│              BLOCKED ACTIONS                │
├─────────────────────────────────────────────┤
│ ❌ Record new payment                       │
│ ❌ Void existing payment                    │
│ ❌ Apply discount                           │
│ ❌ Modify assessment                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│             ALLOWED ACTIONS                 │
├─────────────────────────────────────────────┤
│ ✅ Encode grades (academic record)          │
│ ✅ View enrollment details                  │
│ ✅ Withdraw cancellation request (requester)│
└─────────────────────────────────────────────┘

Blocking is lifted when:
• Request is APPROVED (enrollment cancelled)
• Request is REJECTED (enrollment unchanged)
• Request is WITHDRAWN (by requester)
```

---

## Summary: Status Transitions

```
ENROLLMENT STATUS TRANSITIONS:

pending ──────────────────────────► cancelled (direct)
    │
    ▼
assessed ─────────────────────────► cancelled (direct + refund policy)
    │
    ▼
enrolled ──► cancellation_requested ──► approved ──► cancelled (with refund)
                    │                       │
                    │                       └──► clearance (if balance > 0)
                    │
                    ├──► rejected ──► enrolled (unchanged)
                    │
                    └──► withdrawn ──► enrolled (unchanged)
```
