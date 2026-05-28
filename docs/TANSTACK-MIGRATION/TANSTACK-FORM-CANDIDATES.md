# TanStack Form — Form-by-Form Migration Assessment

A prioritized assessment of every form in the app against TanStack Form
(`@tanstack/react-form`). Companion to
[`../01-STATUS-REPORT/TANSTACK-FORM-TRIAL-REPORT.md`](../01-STATUS-REPORT/TANSTACK-FORM-TRIAL-REPORT.md):
that doc records the trial + the registration prototype; this one ranks **which other forms should
migrate, in what order, and what to budget for**.

**Bottom line:** TanStack Form earns its keep only on forms that hand-roll multi-step state, field
arrays, or per-field client validation — roughly 6 forms. The other ~15 stay on native Actions. And the
dogfood proved migration is **not a drop-in win**: the trial prototype's guardian "set as primary"
toggle was broken (§7), so every field-array migration must budget for array-item correctness work plus
a per-form browser dogfood.

> **Status (2026-05-28):** Tier-1 `StudentRegistrationForm` is **migrated in place and shipped** — the
> primary-toggle and submit-transition bugs are fixed in production; the prototype + `?form=tanstack`
> toggle are retired. See [`TANSTACK-FORM-IMPLEMENTATION-REPORT.md`](./TANSTACK-FORM-IMPLEMENTATION-REPORT.md).

> Note: `TANSTACK-FORM.md` in this folder is stale build-error plan content, not a form doc. This file is
> the authoritative assessment.

## 1. Purpose & method

All 24 form components under `src/features/**/components`, `src/components/**`, and `src/app/**` were
inventoried. Each was scored on whether it hand-rolls the machinery TanStack Form provides natively.

**Default pattern (stays the default):** native React 19 `<form action={action}>` + `useActionState` +
server-side Zod (`schema.safeParse(formData)`), errors via `state.errors.*` + `useFormToast`. This gives
progressive enhancement (submits without JS) and keeps server validation + audit authoritative. Simple
single-submit forms gain nothing from a client form library and would lose the no-JS fallback.

## 2. Scoring rubric

| Signal | Why it favors TanStack Form |
|---|---|
| Multi-step / wizard state (`currentStep`, `validateStep`) | Built-in per-step validation via `form.validateField` |
| Field array (dynamic add/remove rows) | First-class `<form.Field mode="array">` + `pushValue`/`removeValue` |
| Per-field client validation as you type | Built-in `validators.onChange` (reuse Zod via `zodCheck`) |
| Interdependent fields (`useEffect` routing) | Field subscriptions replace manual effects |
| High `useState`/`useEffect` count | Direct reduction in hand-rolled state glue |
| Large LOC of form plumbing | Proportional cleanup |

A form scores high only with **wizard or field array** present. Multiple `useState` for toggles
(password visibility, show/hide) does **not** count — those don't benefit.

## 3. Tier 1 — Strong (migrate first)

| Form | Path | Signals | Status / win |
|---|---|---|---|
| `StudentRegistrationForm` | `src/features/registrations/components/StudentRegistrationForm.tsx` | 4-step wizard + guardian **field array** + per-step gating + client/server error merge | ✅ **Migrated in place (2026-05-28).** Prototype + toggle retired; primary-toggle + submit-transition bugs fixed |
| `EnrollmentWizardForm` | `src/features/enrollments/components/EnrollmentWizardForm.tsx` | 3-step wizard, `currentStep`/`furthestStep`, `useEffect` error-routing, interdependent fields, ~936 LOC | ⚠️ **Re-rated down.** No field array, near-zero client validation; real complexity (cross-field derivation, server-error step routing, shared *uncontrolled* `IntakeRequirementsFieldset`) isn't improved by TanStack and the shared intake fieldset fights value-based submission. Migrate only as a hybrid, low priority |

## 4. Tier 2 — Field-array forms (migrate next)

| Form | Path | Signals | Notes |
|---|---|---|---|
| `StudentForm` | `src/features/students/components/StudentForm.tsx` | Guardian **field array** (add/remove) via `useCreateStudent`; embeds `GuardianForm` + intake fieldset | Same guardian-array shape as registration — reuse whatever pattern fixes the registration array |
| `EditStudentForm` | `src/features/students/components/EditStudentForm.tsx` | Guardian field array via `useUpdateStudent` | Migrate alongside `StudentForm`; they share `GuardianForm` |
| `AssessmentDraftForm` | `src/features/assessments/components/AssessmentDraftForm.tsx` | Fee-line array (read-only from catalog) + `useMemo` totals + conditional discount sections, ~593 LOC | **Moderate ROI** — the array is read-only, so the array win is smaller; migrate only if line editing is added |

## 5. Tier 3 — Moderate (optional / monitor)

| Form | Path | Why borderline | Promotion trigger |
|---|---|---|---|
| `NewEnrollmentForm` | `src/features/enrollments/components/NewEnrollmentForm.tsx` | Interdependent fields, but single-submit (no step gating) | If it grows step gating or more cross-field logic |
| `DiscountTypeFormModal` | `src/features/discounts/components/DiscountTypeFormModal.tsx` | ~11 `useState`, but all linear single fields | Only boilerplate reduction; migrate if it gains conditional/array logic |
| `DiscountRequestForm` | `src/features/discounts/components/DiscountRequestForm.tsx` | 2 simple fields + conditional display | Low value as-is |
| `CancelEnrollmentForm` | `src/features/enrollments/components/CancelEnrollmentForm.tsx` | Mostly a UI toggle + one textarea | If remarks validation grows |
| `PostPaymentForm` | `src/features/payments/components/PostPaymentForm.tsx` | Conditional sections + simple change calc | If payment-method rules expand |

## 6. Tier 4 — Keep native (no benefit)

Simple, single-submit, server-validated. Migrating would add a dependency and **lose progressive
enhancement** for zero gain:

`LoginForm`, `ChangePasswordForm`, `UserForm`, `EditUserForm`, `ResetPasswordForm`, `SchoolYearForm`,
`EditSchoolYearForm`, `CreateSubjectForm`, `AssignTeacherForm`, `BookletForm`, `FeeScheduleForm`,
`FeeTemplateForm`, `AddFeeItemForm`, `TemplateAssignmentForm`, and `GuardianForm` (a presentational
sub-component, not a standalone form).

## 7. Dogfood evidence (2026-05-28)

Native `/staff/students/new` vs the TanStack prototype `?form=tanstack`, exercised live in a browser
(both clean, no console errors).

| Behavior | Native | TanStack prototype |
|---|---|---|
| Styling / layout | ✅ | ✅ identical |
| Step gating (block advance on empty) | ✅ inline errors, stays on step | ✅ inline errors, stays on step |
| Guardian array add / remove | ✅ | ✅ |
| **Live per-field validation as you type** | ❌ validates on Continue | ✅ error clears instantly on valid input |
| **Single-primary toggle ("Set as primary")** | ✅ primary moves to chosen guardian | ❌ **broken in the prototype** → ✅ **fixed in the shipped migration** |
| Required-field message | per-field ("First name is required.") | generic ("Name is required.") — reuses shared `nameSchema` |

> The toggle defect below describes the **trial prototype**. It was root-caused and fixed in the
> shipped `StudentRegistrationForm` migration (whole-array `setFieldValue`). Kept here as the cautionary
> tale for the remaining field-array forms.

**The win:** live per-field validation is the responsiveness upgrade — typing a valid value clears that
field's error with no re-submit. This is the main reason to migrate wizard/array forms.

**The defect (read before migrating any field array):** in the prototype, clicking "Set as primary" on
guardian 2 does nothing — primary stays on guardian 1 (verified with both synthetic and real Playwright
clicks; the native form works correctly on the same action). On submit, the prototype would always send
guardian 1 as primary regardless of selection.

Root cause in `StudentRegistrationFormTanstack.tsx`: the handler calls
`form.setFieldValue(\`guardians[${j}].isPrimary\`, …)`, but `isPrimary` is **never rendered as a
`<form.Field>`**, so the array store isn't updated reactively and the badge never moves. The fix is to
make array-item flags real subscribed fields, or mutate them through the array-field API — not via a
bracket-path `setFieldValue` on an unmounted field.

**Implication:** field-array migrations are not free. Budget for array-item correctness work and a
per-form dogfood on every Tier 1/Tier 2 form.

## 8. Recommended approach — replace in place

Convert each target form **directly** — no parallel `*Tanstack.tsx` file, no `?form=` toggle (the
registration prototype was a one-off for the trial). Reuse the techniques the prototype proved:

- `useForm({ defaultValues })`; `<form.Field>` per field; `mode="array"` for guardian/line arrays.
- The `zodCheck` adapter to reuse existing Zod field schemas (`nameSchema`, `emailSchema`, `lrnSchema`,
  `phoneSchema`, …) — no schema duplication.
- Per-step gating via `form.validateField`.
- **Keep the existing server action + FormData contract unchanged**, so server validation + audit logging
  stay authoritative.
- For array-item flags (e.g. `isPrimary`), render them as real fields or set via the array-field API —
  this is the §7 fix and applies to every guardian/line-item migration.
- Address the generic-message regression: pass per-field messages instead of relying on the shared
  `nameSchema` message where the field label matters.

## 9. Suggested sequence

1. ✅ **`StudentRegistrationForm`** — **done (2026-05-28).** Migrated in place; primary toggle + submit
   transition fixed; prototype + `?form=tanstack` branch deleted. See the implementation report.
2. **`StudentForm` + `EditStudentForm`** — next. Share the guardian-array `setPrimary`/whole-array pattern.
3. **`AssessmentDraftForm`** — only if/when fee-line editing is added.
4. **`EnrollmentWizardForm`** — deferred / hybrid only (re-rated down, see §3): no field array, shared
   uncontrolled intake fieldset; low payoff for the risk.

Each step verified with `tsc --noEmit`, ESLint, and an authenticated browser dogfood of that specific
form — explicitly re-testing array add/remove and any primary/flag toggle.
