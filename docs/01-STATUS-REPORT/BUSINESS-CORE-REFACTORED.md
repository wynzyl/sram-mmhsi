# SRAMS Core Business Engine Refactoring Report

**Last Updated:** 2026-05-21

## Overview

This document details the refactoring of the SRAMS core business engine, focusing on Registration, Enrollment, Assessment, Payments, Discount, and Ledger modules. The goal was to create a stable, maintainable business engine that can survive future changes without becoming spaghetti — while NOT over-engineering for a 700-1000 student school.

---

## Phase 1: Transaction Helpers (Completed)

### Problem Addressed

Raw SQL `SELECT ... FOR UPDATE` patterns were scattered across 14+ instances in action files, causing:
- Type-unsafe `as any` casts
- Inconsistent snake_case → camelCase handling (bug-prone)
- Repeated boilerplate code for lock + fetch + null check

### Solution

Created `src/lib/utils/tx-helpers.ts` with typed lock helpers:

```typescript
// Before (scattered across action files)
const paymentRows = await tx.execute(
  sql`SELECT * FROM "payments" WHERE "id" = ${paymentId} FOR UPDATE`
);
if (!Array.isArray(paymentRows) || paymentRows.length === 0) {
  throw new Error("Payment not found.");
}
const payment = paymentRows[0] as any;
// Bug: Must use payment.assessment_id (snake_case)

// After (typed helper)
const payment = await lockPayment(tx, paymentId);
if (!payment) throw new Error("Payment not found.");
// Safe: payment.assessmentId (camelCase, fully typed)
```

### New Functions

| Function | Purpose |
|----------|---------|
| `lockPayment(tx, id)` | Lock and fetch a payment row |
| `lockAssessment(tx, id)` | Lock and fetch an assessment row |
| `lockAssessmentByEnrollment(tx, enrollmentId)` | Lock assessment via enrollment FK |
| `lockReceiptBooklet(tx, id, statusFilter?)` | Lock booklet with optional status filter |
| `lockVoidRequest(tx, id)` | Lock and fetch a void request |
| `lockStudentDiscount(tx, id)` | Lock and fetch a student discount |
| `lockDiscountRequest(tx, id)` | Lock and fetch a discount request |
| `lockEnrollment(tx, id)` | Lock and fetch an enrollment row |
| `lockAssessmentTransferStatus(tx, id)` | Partial lock for transfer guard checks |
| `lockStudentDiscountReversalStatus(tx, id)` | Partial lock for reversal guard checks |

### Type Definitions

Fully typed interfaces for each lockable table row:
- `LockedPayment`
- `LockedAssessment`
- `LockedReceiptBooklet`
- `LockedVoidRequest`
- `LockedStudentDiscount`
- `LockedDiscountRequest`
- `LockedEnrollment`

All interfaces use camelCase property names, matching the Drizzle schema.

---

## Phase 2: Assessment Balance Operations (Completed)

### Problem Addressed

Assessment balance update patterns were inconsistent:
- `payments.actions.ts` used `String(newBalance)` (no precision control)
- `discounts.actions.ts` used `newBalance.toFixed(2)` (proper precision)
- Billing status derivation was duplicated

### Solution

Created `src/lib/utils/assessment-balance.ts` with centralized balance operations:

```typescript
// Before (inconsistent patterns)
const newTotalPaid = Number(assessment.totalPaid) + amount;
const newBalance = Number(assessment.balance) - amount;
await tx.update(assessments).set({
  totalPaid: String(newTotalPaid),  // No .toFixed()!
  balance: String(newBalance),
  billingStatus: assessmentBillingStatusFromState({ ... }),
  ...
});

// After (consistent, centralized)
const { newBalance } = await applyAssessmentBalanceDelta(
  tx,
  assessmentId,
  amount,  // positive = payment, negative = reversal
  assessment.cancelledAt,
  assessment.transferredAt,
  session.userId
);
```

### New Functions

| Function | Purpose |
|----------|---------|
| `applyAssessmentBalanceDelta(executor, id, delta, cancelledAt, transferredAt, userId)` | Apply payment/reversal delta with consistent `.toFixed(2)` rounding |
| `recalcAssessmentTotalsForDiscount(executor, id, amount, direction, userId)` | Recalculate totals after discount apply/reverse |

### Key Improvements

- **Consistent rounding**: All monetary values use `.toFixed(2)`
- **Single source of truth**: Billing status derived from centralized `assessmentBillingStatusFromState()`
- **Atomic updates**: Balance + status + timestamp updated together

---

## Files Changed

### New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/utils/tx-helpers.ts` | 383 | Transaction lock helpers with type safety |
| `src/lib/utils/assessment-balance.ts` | 203 | Assessment balance operations |

### Modified Files

| File | Before | After | Delta | Changes |
|------|--------|-------|-------|---------|
| `src/features/payments/payments.actions.ts` | 499 | 462 | -37 | Replaced 2 lock patterns, 2 balance updates |
| `src/features/payments/void-requests.actions.ts` | 620 | 550 | -70 | Replaced 6 lock patterns, 1 balance update |
| `src/features/discounts/discounts.actions.ts` | 1607 | 1533 | -74 | Replaced 4 lock patterns, removed inline function |

**Total reduction:** ~181 lines from action files (absorbed into reusable utilities)

---

## What Was NOT Changed

Per the plan, these patterns were intentionally left as-is:

1. **Query consolidation** - Drizzle ORM already provides query building; generic builders would add complexity without benefit
2. **Service layer abstraction** - Server actions ARE the service layer in Next.js App Router
3. **Repository pattern** - Overkill for this scale
4. **Action decomposition** - Deferred to future phase; current action sizes are manageable

---

## Verification Results

### Build Status
```
✓ Compiled successfully
✓ TypeScript type checking passed
✓ Static pages generated (48/48)
```

### Test Status
```
Test Files: 2 passed (2)
Tests: 25 passed (25)
Duration: 244ms
```

---

## Usage Examples

### Locking a Payment in a Transaction

```typescript
import { lockPayment } from "@/lib/utils/tx-helpers";

await db.transaction(async (tx) => {
  const payment = await lockPayment(tx, paymentId);
  if (!payment) throw new Error("Payment not found.");

  // payment.status, payment.assessmentId, etc. are fully typed
  if (payment.status !== "posted") {
    throw new Error(`Cannot process ${payment.status} payment.`);
  }

  // ... business logic
});
```

### Applying a Payment Balance Delta

```typescript
import { applyAssessmentBalanceDelta } from "@/lib/utils/assessment-balance";

// For a payment (positive delta)
const { newBalance } = await applyAssessmentBalanceDelta(
  tx,
  assessmentId,
  5000,  // PHP 5,000 payment
  assessment.cancelledAt,
  assessment.transferredAt,
  session.userId
);

// For a reversal (negative delta)
await applyAssessmentBalanceDelta(
  tx,
  assessmentId,
  -5000,  // Reverse PHP 5,000
  assessment.cancelledAt,
  assessment.transferredAt,
  session.userId
);
```

### Recalculating After Discount Changes

```typescript
import { recalcAssessmentTotalsForDiscount } from "@/lib/utils/assessment-balance";

// Apply a discount (reduces totalAmount)
await recalcAssessmentTotalsForDiscount(
  tx,
  assessmentId,
  10000,  // PHP 10,000 discount
  "apply",
  session.userId
);

// Reverse a discount (increases totalAmount)
await recalcAssessmentTotalsForDiscount(
  tx,
  assessmentId,
  10000,
  "reverse",
  session.userId
);
```

---

## Migration Notes

### For Existing Code

When adding new lock patterns, use the helpers instead of raw SQL:

```typescript
// Don't do this
const rows = await tx.execute(
  sql`SELECT * FROM "payments" WHERE "id" = ${id} FOR UPDATE`
);
const payment = rows[0] as any;

// Do this
const payment = await lockPayment(tx, id);
```

### For New Tables

To add a new lockable table:

1. Define the `Locked{Table}` interface in `tx-helpers.ts`
2. Add a `lock{Table}()` function following the existing pattern
3. Export from the module

---

## Future Considerations

### Phase 3: Action Decomposition (Not Yet Started)

Large actions could be decomposed into internal helpers:

- `createAssessmentFromEnrollmentAction` (485 lines) → Extract `validateEnrollmentForAssessment()`, `collectBalanceForwardItems()`, etc.
- `reverseDiscountAction` (217 lines) → Extract `validateDiscountForReversal()`, `createReversalEntries()`
- `approveVoidRequestAction` → Extract `validateVoidApprovalContext()`, `createReversalPayment()`

This is lower priority since the current action sizes are still manageable.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Server Actions                           │
│  (payments.actions.ts, void-requests.actions.ts, etc.)      │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────────┐ ┌───────────────┐ ┌──────────────────────┐
│  tx-helpers.ts  │ │ assessment-   │ │ Existing Utilities   │
│                 │ │ balance.ts    │ │                      │
│ • lockPayment() │ │               │ │ • assessment-billing │
│ • lockAssess()  │ │ • applyDelta()│ │ • enrollment-grade   │
│ • lockBooklet() │ │ • recalcDisc()│ │ • or-number          │
│ • lockVoidReq() │ │               │ │ • audit-logger       │
│ • lockDiscount()│ │               │ │                      │
└────────┬────────┘ └───────┬───────┘ └──────────────────────┘
         │                  │
         └────────┬─────────┘
                  │
                  ▼
         ┌────────────────┐
         │  Drizzle ORM   │
         │  (db/schema)   │
         └────────────────┘
```

---

## Conclusion

This refactoring successfully:

1. **Eliminated type-unsafe patterns** - No more `as any` casts for locked rows
2. **Standardized snake_case handling** - Automatic conversion in one place
3. **Unified balance operations** - Consistent `.toFixed(2)` rounding everywhere
4. **Reduced code duplication** - ~181 lines moved to reusable utilities
5. **Preserved API surface** - No changes to server action signatures

The codebase is now more maintainable and less prone to the snake_case bugs that were identified in the analysis phase.
