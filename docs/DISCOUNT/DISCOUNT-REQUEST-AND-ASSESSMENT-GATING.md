# Plan — Discount-Request and Assessment Gating Rules

## Context

Two new business rules need enforcement to keep discount and assessment lifecycles in a consistent, auditable state:

1. **Block requesting a discount when an enrollment is already assessed AND either (a) a non-voided payment has been posted on that assessment, OR (b) any prior discount on this enrollment has been reversed.** Today the action only blocks (a) (`src/features/discounts/discounts.actions.ts:371-387`); the open-ended "request replacement after reversal" flow needs to be locked down for financial control.
2. **Block creating/processing an assessment when the enrollment has any pending discount request.** This must already be enforced, with a clear message instructing the user to approve or reject the request first.

Rule 2 is **already implemented** (`src/features/assessments/assessments.actions.ts:99-106` uses `hasPendingDiscountRequests`). We verify it, refine the message if needed, and document the behavior. The bulk of the work is Rule 1.

The intended outcome: server actions hard-block disallowed transitions with descriptive error messages, and the UI hides entry points (the "Request Discount" button and the "Request replacement →" deep link) when the enrollment is locked, so the user never sees a button that's guaranteed to fail.

## Out of Scope

- Schema/migration changes (no new tables, no new columns).
- Changing the assessment-already-pending-discount block (Rule 2 logic is correct as-is; only verify and surface the message clearly).
- Retroactive cleanup of historical enrollments that already have reversed discounts and are now considered "locked" — they simply become locked going forward.
- Touching the OR/payment void path itself.

## Changes

### 1. New reusable query helper — `getDiscountRequestGate`

File: `src/features/discounts/discounts.queries.ts` (new export, sits alongside `hasPendingDiscountRequests`)

Single source of truth for "can this enrollment receive a new discount request?". One DB round-trip, returns a structured result that both the server action and the page template consume:

```ts
export type DiscountRequestGate =
  | { allowed: true }
  | { allowed: false; reason: string; code: "PAYMENT_POSTED" | "DISCOUNT_REVERSED" };

export async function getDiscountRequestGate(
  enrollmentId: string,
): Promise<DiscountRequestGate>;
```

Logic:

- Look up the enrollment's assessment (if any).
- If no assessment → `{ allowed: true }` (pre-assessment path is governed by `enrollment.status === 'pending'` in the existing action and is unchanged).
- If assessment exists:
  - If any `payments` row for `assessmentId` has `status != 'voided'` → `{ allowed: false, code: "PAYMENT_POSTED", reason: "Cannot request a new discount: a non-voided payment exists on this assessment. Void the payment first." }`.
  - Else if any `discount_requests` row for `enrollmentId` has `status = 'reversed'` → `{ allowed: false, code: "DISCOUNT_REVERSED", reason: "Cannot request a new discount: this assessment has a previously reversed discount. Discount changes are locked once a reversal has been recorded." }`.
  - Else → `{ allowed: true }`.

Why a query, not a server action: it's a pure read, used in both `*.actions.ts` (write-time enforcement) and a server component (UI gating).

### 2. Use the gate inside `createDiscountRequestAction`

File: `src/features/discounts/discounts.actions.ts:360-398`

Replace the inline existing-assessment branch with a call to `getDiscountRequestGate(enrollmentId)`:

- When `gate.allowed === false`, return `{ message: gate.reason }` immediately.
- When `gate.allowed === true`, fall through to the existing insert logic.

The existing pre-assessment branch (`enrollment.status !== "pending"`) is untouched — the gate is only consulted when an assessment exists, matching the helper's contract.

### 3. Gate the UI entry points

Files:

- `src/app/page-templates/enrollments/enrollment-detail-page.tsx:96`
- `src/features/discounts/components/EnrollmentDiscountsSection.tsx`
- `src/features/discounts/components/StudentDiscountsList.tsx`

Server-side, in the page template, fetch the gate once and combine it with the permission flag into the prop that controls the UI:

```ts
const canRequestPermission = hasPermission(session.role, "discounts:request");
const gate = await getDiscountRequestGate(enrollment.id);
const canRequest = canRequestPermission && gate.allowed;
const requestBlockReason = !gate.allowed ? gate.reason : undefined;
```

Pass `canRequest` (existing prop, semantics tightened) and a new optional `requestBlockReason?: string` down to both `EnrollmentDiscountsSection` and `StudentDiscountsList`. Use them to:

- Hide the "Request Discount" / "Request a discount" buttons in `EnrollmentDiscountsSection` (already conditioned on `canRequest`, so just by tightening `canRequest` upstream the button disappears) and render a small muted notice with `requestBlockReason` when present so the user understands *why* the option is gone.
- Hide the "Request replacement →" deep link in `StudentDiscountsList` (also driven by `canRequest`, so it disappears automatically) and similarly show a brief reason on the reversed-discount row when applicable.

No new components, no new client state — the only addition is a single muted `<p>` rendering the reason. Both touched components keep their existing patterns.

### 4. Verify Rule 2 (assessment blocked by pending discount request)

File: `src/features/assessments/assessments.actions.ts:99-106`

Already enforced via `hasPendingDiscountRequests`. Confirm:

- The message is actionable. Today: *"This enrollment has pending discount requests. All discount requests must be approved or rejected before creating an assessment."* — keep as-is; it already names both resolutions.
- No code change. List in this plan so the verification step exercises it end-to-end.

## Files To Modify

| File | Change |
| --- | --- |
| `src/features/discounts/discounts.queries.ts` | Add `getDiscountRequestGate(enrollmentId)` and the `DiscountRequestGate` type (§1). |
| `src/features/discounts/index.ts` | Export `getDiscountRequestGate` and the type. |
| `src/features/discounts/discounts.actions.ts` | Replace the post-assessment inline check in `createDiscountRequestAction` (lines 367-398) with a call to the helper (§2). |
| `src/app/page-templates/enrollments/enrollment-detail-page.tsx` | Tighten `canRequest` with the gate result; pass `requestBlockReason` down (§3). |
| `src/features/discounts/components/EnrollmentDiscountsSection.tsx` | Accept optional `requestBlockReason`; render muted reason notice when set (§3). |
| `src/features/discounts/components/StudentDiscountsList.tsx` | Accept optional `requestBlockReason`; render muted reason next to reversed-discount rows when set (§3). |

No new files, no schema changes, no new server actions. The math/display work landed earlier is untouched.

## Reused Functions / Patterns

- `hasPermission(role, "discounts:request")` — `src/lib/rbac/permissions.ts`, the existing UI permission check; the gate composes with it, doesn't replace it.
- `hasPendingDiscountRequests` — `src/features/discounts/discounts.queries.ts:328` — sibling pattern the new helper follows (single COUNT query returning a boolean / structured result).
- Existing `discountRequests`, `payments`, `assessments` table imports in `discounts.queries.ts` — no new schema imports.
- `FormStateAlert` — `src/components/forms/FormStateAlert` — already surfaces server `message` returned by `createDiscountRequestAction`; the new error text flows through this automatically.

## Verification

1. `npx tsc --noEmit` → exits 0.
2. `npm run test` → all current tests still pass.
3. Manual end-to-end against the running Docker app:
   - **Rule 1a (payment posted):** On an enrollment with a posted, non-voided payment, click "Request Discount" → button is hidden; the discount section shows the reason banner. Hitting the action directly returns the `PAYMENT_POSTED` reason.
   - **Rule 1b (reverse discount recorded):** On Diego Aquino's assessment (which has a reversed 10% Sibling Discount), the "Request Discount" button and the "Request replacement →" link on the reversed row are both gone; reason banner reads "...previously reversed discount...".
   - **Rule 1 happy path:** On a fresh `pending` enrollment with no assessment yet, the "Request Discount" button is visible and a request can still be submitted.
   - **Rule 2:** On an enrollment that has a *pending* (not yet approved/rejected) discount request, attempt to create an assessment → returns "This enrollment has pending discount requests..." After approving or rejecting that request, the assessment creation succeeds.
4. Regression: existing reversal tests still pass; the assessment ledger math (from the prior plan) is unaffected.
