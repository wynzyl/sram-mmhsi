Updated: 5-27-2026

# Enrollment Cancellation Feature - Implementation Plan

## Overview

Implement a conditional approval workflow for enrollment cancellations:
- **Direct cancellation** (no approval) for `pending` and `assessed` enrollments
- **Approval required** for `enrolled` status enrollments (admin approval)

## Requirements Summary

| Aspect | Decision |
|--------|----------|
| Workflow | Conditional approval (enrolled requires approval) |
| Approval trigger | When enrollment status = `enrolled` |
| Approvers | Admin/Super Admin only |
| Cancellation reasons | Free-text remarks (min 10 chars) |
| Self-cancel | Requester can withdraw pending request |
| UI Location | Staff dashboard notifications + dedicated inbox |

---

## Database Schema

### New Table: `enrollment_cancellation_requests`

```sql
CREATE TABLE enrollment_cancellation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL,
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

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/features/enrollments/enrollment-cancellation.schema.ts` | Zod validation schemas |
| `src/features/enrollments/enrollment-cancellation.actions.ts` | Server actions (request/approve/reject/withdraw) |
| `src/features/enrollments/enrollment-cancellation.queries.ts` | Database queries |
| `src/features/enrollments/components/RequestCancellationForm.tsx` | Form to request cancellation |
| `src/features/enrollments/components/CancellationRequestsTable.tsx` | Admin inbox table |
| `src/features/enrollments/components/CancellationRequestDetail.tsx` | Request detail with approve/reject |
| `src/features/enrollments/components/WithdrawRequestButton.tsx` | Self-cancel button |
| `src/app/admin/cancellation-requests/page.tsx` | Admin inbox page |
| `src/app/admin/cancellation-requests/[requestId]/page.tsx` | Request detail page |

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add `enrollmentCancellationRequests` table + relations |
| `src/features/enrollments/enrollments.actions.ts` | Block direct `enrolled` → `cancelled`, route to request flow |
| `src/app/staff/dashboard/page.tsx` | Add pending requests count badge (admin only) |
| `src/app/staff/enrollments/[enrollmentId]/page.tsx` | Add "Request Cancellation" button + history |

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
- Executes:
  - Update enrollment: `status = 'cancelled'`, set `cancelledAt`, `cancelledBy`, `cancelRemarks`
  - Update assessment: `billingStatus = 'cancelled'`
  - Update request: `status = 'approved'`, set `reviewedBy`, `reviewedAt`, `reviewRemarks`
- Audit: `enrollments:approve_cancellation`

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
    message: "Enrolled enrollments require approval. Please submit a cancellation request instead.",
  };
}

// Only allow direct cancellation for pending/assessed
if (action === "cancel" && !["pending", "assessed"].includes(enrollment.status)) {
  return { message: "Invalid enrollment status for direct cancellation." };
}
```

---

## UI Flow

### Flow 1: Direct Cancellation (pending/assessed)
```
Registrar → Cancel button → Confirm dialog → updateEnrollmentStatusAction() → Success
```

### Flow 2: Request Cancellation (enrolled)
```
Registrar → "Request Cancellation" button → Enter reason (min 10 chars) →
requestEnrollmentCancellationAction() → Pending in inbox
```

### Flow 3: Admin Approval
```
Admin → Dashboard notification → Inbox → Review request →
Approve (with optional remarks) → approveEnrollmentCancellationAction() →
Enrollment cancelled
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

### Phase 1: Database (1 hour)
1. Add `enrollmentCancellationRequests` table to `schema.ts`
2. Add table relations
3. Generate and apply migration

### Phase 2: Schemas & Queries (1 hour)
1. Create `enrollment-cancellation.schema.ts` with all validation schemas
2. Create `enrollment-cancellation.queries.ts` with all queries

### Phase 3: Server Actions (2 hours)
1. Create `enrollment-cancellation.actions.ts` with all 4 actions
2. Modify `enrollments.actions.ts` to block direct enrolled cancellation

### Phase 4: UI Components (3 hours)
1. Create `RequestCancellationForm.tsx`
2. Create `CancellationRequestsTable.tsx`
3. Create `CancellationRequestDetail.tsx`
4. Create `WithdrawRequestButton.tsx`

### Phase 5: Pages & Integration (2 hours)
1. Create `/admin/cancellation-requests/page.tsx`
2. Create `/admin/cancellation-requests/[requestId]/page.tsx`
3. Modify staff dashboard to show pending count
4. Modify enrollment detail to show request button + history

### Phase 6: Testing (1 hour)
1. Test all workflows end-to-end
2. Verify permission enforcement
3. Verify audit logging

---

## Verification Plan

1. **Direct Cancellation Test:**
   - Create enrollment with status `pending` → Cancel → Verify cancelled
   - Create enrollment with status `assessed` → Cancel → Verify cancelled

2. **Request Workflow Test:**
   - Create enrollment with status `enrolled` → Try direct cancel → Verify blocked
   - Request cancellation → Verify appears in admin inbox
   - Approve → Verify enrollment cancelled + assessment cancelled

3. **Rejection Test:**
   - Request cancellation → Reject → Verify enrollment still enrolled

4. **Withdrawal Test:**
   - Request cancellation → Withdraw → Verify request status = cancelled

5. **Permission Tests:**
   - Non-admin tries to approve → Verify blocked
   - Non-requester tries to withdraw → Verify blocked

6. **Audit Log Verification:**
   - Check all actions generate proper audit entries

---

## Key Files Reference

- Schema: `src/lib/db/schema.ts:369-401` (enrollments table)
- Existing action: `src/features/enrollments/enrollments.actions.ts:345-507`
- Similar pattern: `src/features/payments/void-requests.actions.ts`
- Audit logger: `src/lib/utils/audit-logger.ts`
- Tx helpers: `src/lib/db/tx-helpers.ts`
