# Plan: Implement Complete Assessment Cancellation

## Summary

Implement the full assessment cancellation flow per `docs/ASSESSMENT/CANCELLATION.md` specification.

## Problem

Current implementation is incomplete:

- Allows cancellation with posted payments (spec says NO)
- Doesn't revert enrollment status
- Doesn't reverse balance forwards
- Doesn't revert discount grants
- Cancellation reason is optional (should be required)

## Specification (from docs/ASSESSMENT/CANCELLATION.md)

### Validation Rules

1. User role: Admin or Finance (`assessments:cancel` permission)
2. Assessment exists
3. Assessment billingStatus is `outstanding` (not already cancelled/paid)
4. Enrollment status is `assessed`
5. **No posted payments exist** (hard block, no override)
6. Cancellation reason **required**

### Transaction Steps

1. Mark assessment as `cancelled`
2. If balance was forwarded INTO this assessment:
   - Reverse balance forward (restore source assessment balance)
   - Delete BFX receipts
3. Revert applied discounts → delete records AND set discount requests to `rejected`
4. Change enrollment: `assessed` → `pending`
5. Create audit log entry
6. Commit transaction

**No partial cancellation - rollback everything on failure.**
\*\*No HARD Delete. Always use Soft Delete

## Implementation

### File: `src/features/assessments/assessments.actions.ts`

**Rewrite `cancelAssessmentAction` with full transaction:**

```typescript
// 1. VALIDATION
- Permission check: assessments:cancel
- Assessment exists and billingStatus = 'outstanding'
- Enrollment status = 'assessed' (not enrolled, not cancelled)
- NO posted payments (totalPaid === 0) - hard block
- Cancellation reason REQUIRED (not optional)

// 2. TRANSACTION
await db.transaction(async (tx) => {

  // 2a. Handle balance forward items (if any)
  //     - Find all assessment items with sourceAssessmentId
  //     - For each: restore source assessment balance, delete BFX receipt
  //     - Delete balance forward items from this assessment
  //     (Reuse logic from reverseBalanceTransferAction)

  // 2b. Handle applied discounts
  //     - Find all studentDiscounts linked to this assessment
  //     - Delete studentDiscounts records
  //     - Set discountRequests.status = 'rejected' for each
  //     - Delete discount line items from assessmentItems

  // 2c. Cancel assessment
  //     - Set billingStatus = 'cancelled'
  //     - Set cancelledAt, cancelledBy

  // 2d. Revert enrollment to pending
  //     - Set enrollment.status = 'pending'

  // 2e. Audit log
});
```

### File: `src/features/payments/components/AssessmentLedgerRegister.tsx`

**Update Cancel button conditions:**

- Only show when: `billingStatus === 'outstanding'` AND `enrollment.status === 'assessed'`
- Block entirely if any payments exist (no admin override)
- Require cancellation reason (make remarks field required)

**Update messaging:**

- Inform user: "Assessment will be cancelled, enrollment reverted to pending"
- If balance forwards exist: "Balance forwards will be reversed"
- If discounts applied: "Applied discounts will be removed (must re-request)"

## Files to Modify

1. `src/features/assessments/assessments.actions.ts` - Rewrite cancelAssessmentAction
2. `src/features/payments/components/AssessmentLedgerRegister.tsx` - Update UI/messaging

## Imports Needed

Add to `assessments.actions.ts`:

- `studentDiscounts`, `discountRequests` from schema
- `inArray` from drizzle-orm (if not already imported)

## Verification

### Test Steps

1. Create enrollment → Create assessment (enrollment becomes `assessed`)
2. Navigate to assessment ledger page
3. Verify Cancel button appears
4. Test validation:
   - No payments: should succeed
   - Has payments: should block (not show button or show disabled with message)
   - Missing remarks: should show error
5. Test with balance forwards:
   - Cancel should reverse balance forwards
   - Source assessment balance restored
6. Test with applied discounts:
   - `studentDiscounts` records deleted
   - `discountRequests` status set to `rejected`
7. Verify enrollment status reverted to `pending`
8. Verify can create new assessment for same enrollment

## create this as a module same as void OR and Balance forward.
