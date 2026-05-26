# Plan — Fix Discount Reversal Math & Display

## Context

Two bugs surfaced after a reversal in production (admin reversed a 10% Sibling Discount on Aquino, Diego's assessment):

1. **Assessment math is wrong.** Stored `totalAmount = ₱30,100` but the visible line sum is `₱31,750` — the warning "Stored total differs from line sum" is visible at the bottom of the ledger. The displayed Balance is `₱21,850`, which is `₱30,100 − ₱8,250` (it double-subtracts the remaining `Academic Honors Scholarship` from a `totalAmount` that is *already* net of discounts).
2. **Display is noisy/incorrect.** The reversed discount line and its counter `Reversal: 10% Sibling Discount` line both appear as ordinary rows in the Fee Assessment table, making the ledger read like a `+₱1,650` charge appeared. In the Discounts section, the counter `student_discounts` row renders under "Active" with a malformed `--₱1,650.00` value, and the "Total Discounts" badge sums to `₱6,600` instead of the expected `₱8,250` (the sole remaining true-active discount).

Root causes:

- `reverseDiscountAction` (`src/features/discounts/discounts.actions.ts:965-983`) and `applyApprovedDiscountToExistingAssessment` (same file) both treat `assessments.totalAmount` as gross when it is actually stored as **net** (per `assessments.actions.ts:399-406`: `totalAmount = assessmentTotalAmount − totalDiscounts`). Result: balance is double-discounted and `totalAmount` is never re-written.
- `StudentDiscountsList` (`src/features/discounts/components/StudentDiscountsList.tsx:26-27`) buckets discounts solely by `reversedAt`. The counter row has `reversedAt = null` and a negative `discountAmount`, so it falls into the Active bucket and pollutes the sum.
- The assessment ledger Fee Assessment table renders every `assessment_items` row indiscriminately. Reversed pairs (original discount + counter offset) are both shown.

This plan fixes the arithmetic, hides the reversed pair from the Fee Assessment table, and reorganizes the Discounts section so true-active rows and reversal-counter rows are visually distinct with a correct "Total Discounts" sum.

## Out of Scope

- Schema/migration changes. All fixes are arithmetic + presentational.
- Changing the immutable-ledger model. Counter `studentDiscounts` and counter `assessmentItems` rows remain in the DB for audit; we only adjust what the UI surfaces.
- Reconciling historical assessments that already have drifted totals. A separate one-shot script could be written later if you want to retroactively correct already-broken rows.

## Changes

### 1. Arithmetic — `reverseDiscountAction`

File: `src/features/discounts/discounts.actions.ts:953-983`

Replace the recompute block with one that updates `totalAmount` and derives `balance` from the new net:

```ts
if (assessment) {
  const discountAmount = Number(appliedDiscount.discountAmount);
  // totalAmount is the NET line sum (after discounts). Reversing a discount
  // increases the net by the original discount amount.
  const newTotalAmount = Number(assessment.totalAmount) + discountAmount;
  const newTotalDiscounts = Number(assessment.totalDiscounts) - discountAmount;
  const newBalance = newTotalAmount - Number(assessment.totalPaid);

  await tx.update(assessments).set({
    totalAmount: String(newTotalAmount.toFixed(2)),
    totalDiscounts: String(newTotalDiscounts.toFixed(2)),
    balance: String(newBalance.toFixed(2)),
    updatedBy: session.userId,
    updatedAt: new Date(),
  }).where(eq(assessments.id, appliedDiscount.assessmentId));
}
```

### 2. Arithmetic — `applyApprovedDiscountToExistingAssessment`

Same file, the new action I added earlier. Currently it does the same broken math in the opposite direction. Replace with:

```ts
const newTotalAmount = Number(assessment.total_amount) - discountAmount; // applying reduces net
const newTotalDiscounts = Number(assessment.total_discounts) + discountAmount;
const newBalance = newTotalAmount - Number(assessment.total_paid);

await tx.update(assessments).set({
  totalAmount: String(newTotalAmount.toFixed(2)),
  totalDiscounts: String(newTotalDiscounts.toFixed(2)),
  balance: String(newBalance.toFixed(2)),
  updatedBy: session.userId,
  updatedAt: new Date(),
}).where(eq(assessments.id, assessment.id));
```

### 3. Ledger Fee Assessment table — leave as-is

**Verified:** `reverseDiscountAction` at `src/features/discounts/discounts.actions.ts:933-945` already inserts a positive `assessment_items` row for every reversal:

```ts
await tx.insert(assessmentItems).values({
  assessmentId: appliedDiscount.assessmentId,
  description: `Reversal: ${appliedDiscount.discountTypeName}`,
  amount: appliedDiscount.discountAmount,   // positive in storage
  isDiscount: false,                         // treated as a charge, not a discount
  studentDiscountId: reversalDiscount.id,
  createdBy: session.userId,
  updatedBy: session.userId,
});
```

So the ledger already renders both halves of a reversed pair as visible line items: the original discount row as `−₱1,650.00` (`isDiscount=true`) and the counter as a positive fee line `Reversal: 10% Sibling Discount  ₱1,650.00` (`isDiscount=false`). The signed line sum already evaluates to the correct net (`₱31,750` in the bug scenario). No filtering, no hiding, no strikethrough.

The only reason the "Stored total differs from line sum" warning appears today is that stored `totalAmount` is stale at `₱30,100` — fixing the arithmetic in §1 brings it to `₱31,750` and the warning disappears on its own.

Expected Fee Assessment table after §1 lands (no code change here):

| Description | Amount |
| --- | --- |
| Tuition Fee | ₱16,500.00 |
| Miscellaneous Fees | ₱9,500.00 |
| Registration Fee | ₱2,500.00 |
| Other Fees | ₱11,500.00 |
| DISC 10% Sibling Discount (on ₱16,500 tuition) | −₱1,650.00 |
| DISC Academic Honors Scholarship (on ₱16,500 tuition) | −₱8,250.00 |
| Reversal: 10% Sibling Discount | ₱1,650.00 |
| **Total fees** | **₱31,750.00** |

No files modified in this section.

### 4. Discounts section — render counter rows as positive offsets, sum every row

File: `src/features/discounts/components/StudentDiscountsList.tsx`

Keep the existing two-bucket split (`Active = reversedAt IS NULL`, `Reversed = reversedAt IS NOT NULL`). **Do not touch the original discount row** — it continues to render in the Reversed Discounts section exactly as today (strikethrough, `−₱1,650.00`).

Two surgical fixes:

(a) **Fix the counter row display in the Active section.** Detect counter rows by `Number(discount.discountAmount) < 0`. When detected, render the amount cell as a positive offset using `Math.abs(...)` and a `+` prefix instead of the standard `-` prefix:

```tsx
const amount = Number(discount.discountAmount);
const isOffset = amount < 0;
// In the Active row render:
<div className="text-lg font-semibold text-[var(--color-success)]">
  {isOffset ? "+" : "−"}
  <CurrencyDisplay amount={Math.abs(amount)} className="inline" />
</div>
```

This eliminates the malformed `--₱1,650.00` and clearly reads as "+₱1,650.00 added back". Also suppress the "Reverse" button on counter rows (`!isOffset && canReverse && …`) — you can't reverse a reversal.

(b) **Total Discounts = signed sum across every row.** Replace the current sum (which only covers `activeDiscounts`) with a sum over all `discounts`:

```ts
const totalDiscount = discounts.reduce(
  (sum, d) => sum + Number(d.discountAmount),
  0,
);
// Footer:
<span className="text-lg font-semibold text-[var(--color-success)]">
  −<CurrencyDisplay amount={totalDiscount} className="inline" />
</span>
```

Worked example with the screenshot scenario (storage values):

| Row | `discountAmount` (DB) | Section | Displayed | Contribution |
| --- | --- | --- | --- | --- |
| Academic Honors Scholarship | `8250.00` | Active | `−₱8,250.00` | +8,250 |
| 10% Sibling Discount (Reversal) — counter | `-1650.00` | Active | `+₱1,650.00` | −1,650 |
| 10% Sibling Discount — reversed original | `1650.00` | Reversed | `−₱1,650.00` (strikethrough) | +1,650 |
| **Total Discounts** | | | **`−₱8,250.00`** | **8,250** |

The counter's negative storage and the reversed original's positive storage naturally cancel, leaving the sum equal to the only effectively-applied discount (Academic). No bucket re-organization, no extra labels, no per-section sums — just a correct render and a correct total.

## Files To Modify

| File | Change |
| --- | --- |
| `src/features/discounts/discounts.actions.ts` | Fix `reverseDiscountAction` recompute (§1); fix `applyApprovedDiscountToExistingAssessment` recompute (§2). |
| `src/features/discounts/components/StudentDiscountsList.tsx` | Detect counter rows by `discountAmount < 0`; render their amount as `+₱{abs}.00`; suppress the "Reverse" button on counter rows; switch Total Discounts to a signed sum across all rows (§4). |

No new files, no new server actions, no new queries, no migrations. The assessment ledger page template and the `AssessmentLedgerRegister` client component are untouched.

## Verification

1. `npx tsc --noEmit` → exits 0.
2. `npm run test` → existing 35/35 still pass.
3. `npm run lint` → no new lint errors in the three touched files.
4. End-to-end against the Docker app, using the Aquino/Diego scenario from the bug report:
   - Open `/staff/assessments/3e5c4609-9369-4aca-a38f-17e83437976d`.
   - Fee Assessment table shows all 7 rows exactly as today (Tuition, Misc, Registration, Other Fees, the reversed Sibling discount `−₱1,650.00`, Academic Honors `−₱8,250.00`, and the `Reversal: 10% Sibling Discount  +₱1,650.00` line). **Total fees** at the bottom: `₱31,750.00`.
   - The orange "Stored total differs from line sum" warning is gone (stored `totalAmount` now equals `₱31,750.00` after the §1 fix).
   - Header tile `Total assessed` reads `₱31,750.00`; `Balance due` reads `₱31,750.00` (assuming no payments).
   - Discounts section below shows:
     - **Active Discounts** — `Academic Honors Scholarship` with `−₱8,250.00`, and `10% Sibling Discount (Reversal)` with `+₱1,650.00` (no double-minus; no "Reverse" button on the counter row).
     - **Reversed Discounts** — `10% Sibling Discount` with `−₱1,650.00` strikethrough, unchanged from today.
     - **Total Discounts** footer reads `−₱8,250.00` (signed sum: 8,250 + (−1,650) + 1,650).
   - Reverse the Academic Honors discount next → a second `Reversal: Academic Honors` line appears in the Fee Assessment table at `+₱8,250.00`; Total fees becomes `₱40,000.00`; Balance becomes `₱40,000.00`; Active Discounts contains two counter rows; Reversed Discounts contains two strikethrough rows; Total Discounts is `₱0.00`.
   - Apply a new approved discount via `/staff/finance/discount-requests` → a new `DISC` line is inserted into the Fee Assessment table for the new discount amount; stored `totalAmount` matches the line sum; no warning banner.
5. Confirm the existing failure path is gone: reverse a discount that has a non-voided payment → still returns the existing `REVERSE_BLOCKED` error.
