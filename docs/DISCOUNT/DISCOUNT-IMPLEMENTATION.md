# Discount Scope Verification Report

## Context

You asked to verify whether the Discount feature applies **only to the Tuition Fee item** and **not to the whole Assessment Total**. This report traces the discount feature end-to-end through the schema, calculation utility, server action, and the admin UI that configures it. No code changes are made — output is verification only.

## TL;DR — Answer

**The discount feature is NOT restricted to Tuition Fee items. Scope is configurable per discount type.**

Each row in `discount_types` carries a `base_type` column (PostgreSQL enum) with two legal values:

| `base_type`       | What gets discounted                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `tuition_only`    | Sum of assessment items where `feeItemType.code === 'TUITION'`        |
| `full_assessment` | Sum of **all** non-discount assessment items (tuition + every fee)    |

The admin chooses which one when creating/editing a discount type. New discount types **default to `tuition_only`**, but `full_assessment` is fully wired and produces a discount against the entire assessment subtotal when selected.

## Evidence Trail (source files → behavior)

### 1. Schema — both scopes are first-class
`src/lib/db/schema.ts:106-110`
```ts
export const discountBaseTypeEnum = pgEnum("discount_base_type", [
  "tuition_only",
  "full_assessment",
]);
```
The `discount_types.base_type` column uses this enum. Migration `drizzle/0007_add_discount_system.sql:33` sets `DEFAULT 'tuition_only'`.

### 2. Calculation — branches on `baseType`
`src/features/discounts/utils/discount-calculations.ts:59-78`
```ts
export function calculateDiscountBase(
  assessmentItems: CalculationAssessmentItem[],
  baseType: "tuition_only" | "full_assessment"
): number {
  const nonDiscountItems = assessmentItems.filter((item) => !item.isDiscount);

  if (baseType === "full_assessment") {
    return nonDiscountItems.reduce((sum, item) => sum + Number(item.amount), 0);
  }

  // tuition_only: Sum items where fee type code is 'TUITION'
  return nonDiscountItems
    .filter((item) => item.feeItemTypeCode === "TUITION")
    .reduce((sum, item) => sum + Number(item.amount), 0);
}
```
The doc-comment on the file (lines 8-11) even walks through a worked example with both scopes:
```
Tuition: 50,000 | Other fees: 7,000 | Total: 57,000
ESC 20% (tuition_only)        = 20% × 50,000 = 10,000
Employee 5% (full_assessment) = 5% × 57,000 =  2,850
```

### 3. Application — both branches reachable in production code path
`src/features/discounts/discounts.actions.ts:979-1124` (`applyApprovedDiscountsToAssessment`):
- Selects each approved request's `baseType` from `discount_types` (line 1004).
- Calls `calculateDiscountBase(items, request.baseType)` (line 1035) with whatever the admin configured — no override or guard restricts it to `tuition_only`.
- Writes the chosen `baseType` and resulting `baseAmount` onto the `studentDiscounts` audit row (lines 1075-1077).

`src/features/assessments/assessments.actions.ts:382-426` (assessment creation):
- Calls the above function passing every resolved line's `feeItemTypeCode` (line 392).
- Recomputes `assessments.totalAmount` as `assessmentTotalAmount − totalDiscounts` (line 399), so the discount lands in the assessment grand total either way.

### 4. UI — admin picks the scope
`src/features/discounts/components/DiscountTypeFormModal.tsx:35-36, 195-203`
```tsx
const [baseType, setBaseType] = useState<"tuition_only" | "full_assessment">(
  discountType?.baseType ?? "tuition_only"
);
...
<select name="baseType" value={baseType} onChange={...}>
  <option value="tuition_only">Tuition Only</option>
  <option value="full_assessment">Full Assessment</option>
</select>
```
Both options are user-selectable. `tuition_only` is only the default for the *new-type* form, not a hard constraint.

## Worked Example

Assume an assessment has these line items before discounts:

| Description        | `feeItemTypeCode` | Amount   |
| ------------------ | ----------------- | -------- |
| Tuition Fee        | `TUITION`         | ₱ 50,000 |
| Books              | `BOOKS`           | ₱  4,000 |
| Miscellaneous Fees | `MISC`            | ₱  3,000 |
| **Subtotal**       |                   | **₱ 57,000** |

- A discount type **"ESC 20%"** with `base_type = tuition_only` produces:
  - base = ₱ 50,000 (only the TUITION row passes the filter)
  - discount = ₱ 10,000
  - assessment net = ₱ 47,000
- A discount type **"Employee 5%"** with `base_type = full_assessment` produces:
  - base = ₱ 57,000 (all three non-discount rows)
  - discount = ₱ 2,850
  - assessment net = ₱ 54,150

Both behaviors are live today; which one fires depends solely on the `base_type` value chosen when the admin created the discount type.

## Consistency Findings

- Schema, calculation utility, action layer, and UI are mutually consistent — no drift detected.
- `feeItemTypeCode` is correctly threaded from `feeItemTypes.code` → assessment line resolver → discount calculation (`src/features/assessments/assessments.actions.ts:204-243, 382-395`).
- Stacked discounts each calculate against their own configured base independently (`calculateTotalDiscounts`, `discount-calculations.ts:117-153`) — they do **not** chain against the remaining balance.
- Balance-forward lines carry `feeItemTypeCode = "BALANCE_FORWARD"`, so they are correctly excluded from a `tuition_only` base but *would* be included in a `full_assessment` base. Worth knowing if an FO ever applies a `full_assessment` discount to a student carrying a BF balance.

## Conclusion

The premise "discount is only applicable to the Tuition Fee item and NOT the whole Assessment Total" is **not enforced by the system**. The system supports both scopes by design, controlled per discount type via `discount_types.base_type`. To audit production behavior, inspect existing rows:

```sql
SELECT code, name, base_type, calculation_type, default_value, is_active
FROM discount_types
ORDER BY base_type, code;
```

Any row with `base_type = 'full_assessment'` represents a discount that, when approved and applied, will reduce the *entire* assessment subtotal — not just tuition.

## Files Referenced (no edits)

- `src/lib/db/schema.ts:106-110`
- `src/features/discounts/utils/discount-calculations.ts:59-78, 117-153`
- `src/features/discounts/discounts.actions.ts:979-1124`
- `src/features/assessments/assessments.actions.ts:204-243, 382-426`
- `src/features/discounts/components/DiscountTypeFormModal.tsx:35-36, 195-203`
- `drizzle/0007_add_discount_system.sql:33`
