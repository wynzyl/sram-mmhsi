# TanStack Form Trial — Status Report

Audited status of the **forms layer** after trialing TanStack Form against the project's native
React 19 form pattern. Companion to [`TANSTACK-MIGRATION-REPORT.md`](./TANSTACK-MIGRATION-REPORT.md):
that doc records the TanStack **Query** (client-data) migration; this one records what was trialed for
TanStack **Form**, what was deliberately left native, and the verdict.

**Bottom line:** No blanket migration. The native `useActionState` + Server Actions pattern stays the
default. TanStack Form is justified only on the handful of wizard / field-array forms, and exactly one —
student registration — was prototyped behind a query-param toggle for side-by-side comparison. The
original form remains the production path.

## 1. Baseline form pattern (unchanged default)

Every form in the app uses the same native React 19 flow — there is **no** client-side form library
in the production path:

```
uncontrolled <form action={action}>
  → useActionState(action, {})
  → server action runs schema.safeParse(formData)
  → errors returned via state.errors.fieldName / state.errors._form
  → surfaced inline below fields + form-level via useFormToast (Sonner)
```

This gives progressive enhancement (forms submit without JS), keeps validation server-authoritative,
and writes audit logs inside the action. ~50 forms follow it.

## 2. Phantom-dependency cleanup (done)

`CLAUDE.md` previously claimed the stack was "React Hook Form," but an import audit found **zero** source
files importing `react-hook-form` or `@hookform/resolvers` — both were phantom dependencies.

| Action | Detail |
|---|---|
| Removed deps | `react-hook-form` + `@hookform/resolvers` deleted from `package.json`; lockfile refreshed via `npm install` |
| Corrected docs | `sram-mmhsi/CLAUDE.md` stack line now states the real pattern: native `useActionState` + Server Actions + server-side Zod; notes TanStack Form is trialed for wizard/array forms only |
| Left as-is | Root `Downloads/CLAUDE.md` (the aspirational design doc) — unchanged |

Verified: grep returns **0** remaining `react-hook-form` / `@hookform/resolvers` imports.

## 3. Candidate audit — which forms would actually benefit

TanStack Form earns its keep only where a form already hand-rolls the state/validation it provides
(multi-step wizards, field arrays). Simple single-submit forms gain nothing and would lose
progressive enhancement.

| Form | Verdict | Why |
|---|---|---|
| `StudentRegistrationForm` | **Strongest candidate** | 4-step wizard, manual `draft` state, hand-written `validateStep()`, `getError()` merging client+server errors, guardians **field array** (add/remove/primary). ~800 LOC |
| `EnrollmentWizardForm` | Benefits | 3-step wizard, ~6 `useState`, manual step-error routing via `useEffect` |
| `FeeScheduleForm` / `AddFeeItemForm` / fee-template components | Benefits | Fee-item **arrays** |
| `DiscountRequestForm`, `AssessmentDraftForm` | Moderate | Some dynamic state, but smaller surface |
| `UserForm`, `EditUserForm`, `ResetPasswordForm`, `LoginForm`, `ChangePasswordForm`, `SchoolYearForm`, `CreateSubjectForm`, `AssignTeacherForm`, `BookletForm`, … (~40 forms) | **Stay native** | Simple, single-submit, server-validated; native gives progressive enhancement at zero cost |

## 4. Prototype built

- **Dependency:** `@tanstack/react-form@^1.32.1` (added; this is the only library introduced).
- **Component:** `src/features/registrations/components/StudentRegistrationFormTanstack.tsx` — a **parallel**
  implementation; the original `StudentRegistrationForm.tsx` is untouched so the two can be compared
  side by side.
- **Mount point:** the new-student registration page, behind a query-param toggle.
  `/staff/students/new?form=tanstack` renders the prototype; without the param the original renders.
  Wiring lives in `src/app/page-templates/registrations/new-student-registration-page.tsx`.

**Techniques demonstrated:**

| Concern | TanStack Form approach in the prototype |
|---|---|
| Form state | `useForm({ defaultValues })` including `guardians: [emptyGuardian(true)]` |
| Field array | `<form.Field name="guardians" mode="array">` with `field.pushValue` / `field.removeValue` |
| Single-primary toggle | `form.setFieldValue(\`guardians[${j}].isPrimary\`, j === i)` across the array |
| Per-step gating | `form.validateField(name, "change")` over each step's field list before advancing |
| Schema reuse | Existing Zod field schemas (`nameSchema`, `emailSchema`, `lrnSchema`, `phoneSchema`, …) via the `zodCheck` adapter — no schema duplication |

**Server contract unchanged.** On submit the prototype builds the *same* `FormData` (scalar keys +
`guardians` JSON + `schoolYearId` / `registrationIntent` / `registrationStudentType`) and dispatches the
existing `createStudentAction` via `useActionState`. Server-side validation and audit logging remain
authoritative — TanStack Form only improves the client-side editing experience.

## 5. Native vs TanStack — comparison

| Capability | Native (`useActionState`) | TanStack Form |
|---|---|---|
| Per-field validation as you type | Hand-rolled (`getError`, local state) | Built-in via `validators.onChange` |
| Field arrays (guardians, fee items) | Manual add/remove/index bookkeeping | First-class `mode="array"` + `pushValue`/`removeValue` |
| Multi-step gating | Hand-written `validateStep()` | `form.validateField()` per step |
| Schema reuse | Server-side `safeParse` only | Same Zod schemas client-side (via `zodCheck`) |
| Progressive enhancement (no-JS submit) | ✅ Yes | ❌ No (controlled, JS-driven submit) |
| Bundle / LOC | Zero deps; more hand-written glue on complex forms | +1 dependency; far less glue on wizard/array forms |
| Server validation + audit | Authoritative | Unchanged — still authoritative |

**Read:** TanStack wins decisively on wizard/array ergonomics (less hand-rolled state, typed field
arrays, reusable client validation). Native wins on simplicity and the no-JS fallback, which matters for
the ~40 simple forms.

## 6. Notable friction (resolved)

- **Standard-schema validator output-type mismatch.** TanStack Form's standard-schema validators require
  the schema's output type to exactly match the field type, which breaks for optional schemas
  (`lrn`, `email`) and `as never`-typed array fields. Resolved with a small `zodCheck` adapter that runs
  `safeParse` and returns `string | undefined`, sidestepping the type constraint while reusing the same
  schemas.
- **`react/no-children-prop` lint (26 hits).** TanStack Form's documented API uses `children={(field) => …}`
  as a render prop. Resolved with a single file-level eslint-disable carrying an explanatory rationale,
  rather than suppressing per line.

## 7. Verdict / recommendation

- **Keep native Actions as the default** for all simple, single-submit forms.
- **Adopt TanStack Form only for wizard / field-array forms.** ✅ **Decided & executed:** `StudentRegistrationForm`
  was migrated in place on 2026-05-28; the prototype and `?form=tanstack` toggle are retired.

## 8. Verification performed

- `npx tsc --noEmit` — clean (0 errors project-wide) after the prototype + `zodCheck` adapter.
- `npx eslint` on the prototype — clean (exit 0).
- Grep — **0** remaining `react-hook-form` / `@hookform/resolvers` imports.
- Dev route `/staff/students/new?form=tanstack` compiles and serves HTTP 200.
- ✅ Authenticated browser dogfood (both forms, end-to-end) — **done (2026-05-28)**. Surfaced two bugs in
  the prototype (broken single-primary toggle; submit dispatch outside a transition), both fixed when
  `StudentRegistrationForm` was migrated in place. See
  [`../TANSTACK-MIGRATION/TANSTACK-FORM-IMPLEMENTATION-REPORT.md`](../TANSTACK-MIGRATION/TANSTACK-FORM-IMPLEMENTATION-REPORT.md).

## 9. Open follow-ups (not blocking)

- ✅ Go decision made; `StudentRegistrationForm` migrated in place; prototype + toggle pruned.
- Next targets are the field-array forms `StudentForm` / `EditStudentForm` (reuse the shipped
  whole-array `setPrimary` pattern). `EnrollmentWizardForm` was re-rated **down** after reading its code
  (no field array, shared uncontrolled intake fieldset) — see the candidates doc §3.
- Soft-delete the two dogfood test registrations (Maria Santos, Pedro Reyes) if a clean dev DB is wanted.
