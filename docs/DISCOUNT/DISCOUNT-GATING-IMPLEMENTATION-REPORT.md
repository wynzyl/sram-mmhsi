# Implementation Report — Discount-Request and Assessment Gating

**Date:** 2026-05-21
**Spec:** `docs/Discount/DISCOUNT-REQUEST-AND-ASSESSMENT-GATING.md`
**Verification:** `npx tsc --noEmit` → 0 errors · `npm run test` → 35/35 pass

---

## Summary

Locked down the discount-request lifecycle so two business rules are now enforced consistently at both the server-action layer (hard block) and the UI layer (entry points hidden with a visible reason). Also surfaced reversed-discount activity in the student profile and fixed a latent "live payment" predicate bug that was incorrectly blocking discount reversals after an approval-flow void.

## Rules Now Enforced

1. **Block new discount requests on an assessed enrollment when either:**
   - (a) Any **live** payment exists on the assessment (`status IN ('pending_confirmation', 'posted')`). Resolution: void the payment first.
   - (b) Any prior `discount_requests` row on the enrollment has `status = 'reversed'` **AND** at least one `payments` row exists on the assessment (voided or not). Resolution: locked permanently — discount changes are frozen once payments have touched the assessment.
   - **Negative case:** a reversed discount with no payment history ever recorded → still allowed (admin-correction path).
2. **Block assessment creation when the enrollment has any pending discount request.** (Already enforced at `assessments.actions.ts:99-106`; verified, no change needed.)

## Code Changes

### New query helper

- **`src/features/discounts/discounts.queries.ts`** — added `DiscountRequestGate` type and `getDiscountRequestGate(enrollmentId)`. Returns `{ allowed: true }` or `{ allowed: false, code, reason }` with codes `PAYMENT_POSTED` / `DISCOUNT_REVERSED`. Three existence checks run in parallel (`Promise.all`) after the initial assessment lookup.

### Server action

- **`src/features/discounts/discounts.actions.ts`** — `createDiscountRequestAction` post-assessment branch (formerly an inline check that only enforced Rule 1a) now delegates to `getDiscountRequestGate`. Pre-assessment branch (`enrollment.status === 'pending'`) is unchanged.

### Exports

- **`src/features/discounts/index.ts`** — added `getDiscountRequestGate` and `DiscountRequestGate` type exports.

### UI gating

- **`src/app/page-templates/enrollments/enrollment-detail-page.tsx`** — `canRequest` now combines the permission check with `gate.allowed`; new `requestBlockReason` derived from `gate.reason` is threaded into both child components.
- **`src/features/discounts/components/EnrollmentDiscountsSection.tsx`** — accepts optional `requestBlockReason` prop and renders a muted italic notice in the card content when set (the "Request Discount" button auto-hides because `canRequest` is now tighter upstream).
- **`src/features/discounts/components/StudentDiscountsList.tsx`** — accepts optional `requestBlockReason` prop and renders a muted notice next to reversed-discount rows in place of the "Request replacement →" link.

### Student profile discount tab

- **`src/features/registrations/components/RegistrationDetailView.tsx`** — added a status-summary banner at the top of the discounts tab showing per-status badge counts (Pending / Approved / Rejected / Cancelled / Reversed); banner switches to danger tint when any rows are reversed and explains that new requests are locked once payment activity has been recorded. Also added the missing `Reversed` badge to the requests table (the cell previously rendered nothing for that status).

## Bug Fix — "Live Payment" Predicate

**Symptom reported:** Discount reversal blocked even though the payment had been voided and the assessment balance was zero.

**Root cause:** Three call sites in the discounts feature used `ne(payments.status, "voided")` to detect "live" payments. However, the **approval-based void flow** (`void-requests.actions.ts:261`) sets the payment's `status` to `"reversed"`, not `"voided"`. The `payment_status` enum has five non-active states (`voided`, `reversed`, `reversal`, `balance_forward`, plus the in-flight `pending_confirmation`), so `!= "voided"` is the wrong predicate.

**Fix:** Replaced with `inArray(payments.status, ["pending_confirmation", "posted"])` at:

| File | Function |
| --- | --- |
| `discounts.actions.ts` | `reverseDiscountAction` |
| `discounts.actions.ts` | `applyApprovedDiscountToExistingAssessment` |
| `discounts.queries.ts` | `getDiscountRequestGate` (the helper introduced in this change) |

The `ne` import was removed from both files once orphaned. Error messages updated from "non-voided payment" to "live payment" to reflect the corrected semantics.

## What Was Not Changed

- No schema or migration changes — the `reversed` value already existed in the `discount_request_status` enum.
- No changes to the OR/payment void path itself.
- No changes to the assessment-creation block (Rule 2 was already correct).
- No retroactive cleanup of historical enrollments — they become locked going forward.

## Files Touched

```
src/features/discounts/discounts.queries.ts          (+ gate, predicate fix, imports)
src/features/discounts/discounts.actions.ts          (gate wiring, predicate fix x2, imports)
src/features/discounts/index.ts                      (exports)
src/app/page-templates/enrollments/enrollment-detail-page.tsx  (gate consumption, prop threading)
src/features/discounts/components/EnrollmentDiscountsSection.tsx (reason notice)
src/features/discounts/components/StudentDiscountsList.tsx       (reason notice on reversed rows)
src/features/registrations/components/RegistrationDetailView.tsx (status banner + Reversed badge)
```

## Manual Verification Checklist

1. **Rule 1a — live payment posted:** On an enrollment with a posted payment → "Request Discount" button hidden, banner explains why. Direct action call returns `PAYMENT_POSTED` message.
2. **Rule 1b — reversed discount + payment activity:** On an enrollment with a reversed discount AND any payment row (voided or not) → button and "Request replacement →" link both hidden, banner reads "...previously reversed discount and recorded payment activity...".
3. **Rule 1b negative — reversed discount, no payment ever recorded:** "Request Discount" button still visible, request succeeds (admin-correction path).
4. **Rule 1 happy path:** Fresh `pending` enrollment with no assessment → button visible, request submits.
5. **Rule 2:** Enrollment with a pending discount request → assessment creation returns the pending-request message; after approve/reject, creation succeeds.
6. **Reversal bug fix:** Approval-voided payment with balance = 0 → discount reversal now proceeds (previously blocked).
7. **Student profile banner:** Discount tab shows status badge counts; danger tint + heads-up note when any row is `reversed`; `Reversed` badge appears in the table column.
