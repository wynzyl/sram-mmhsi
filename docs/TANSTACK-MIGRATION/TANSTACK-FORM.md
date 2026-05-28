# Fix build error: `dynamic = "force-dynamic"` vs `cacheComponents`

## Context

`npm run build` fails on `src/app/portal/payments/page.tsx:7` — `export const dynamic = "force-dynamic"` is incompatible with `cacheComponents: true` (set in `next.config.ts:5`). Next 16's `cacheComponents` replaces the old route-segment caching model: dynamism is now inferred from runtime APIs (reading `cookies()`/`headers()`, etc.) rather than declared via `export const dynamic`. The build literally instructs "Please remove it."

This is the pre-existing blocker noted during the TanStack Form work. It is the **only** file in `src/` with an incompatible segment config (grep for `export const (dynamic|revalidate|fetchCache|dynamicParams|runtime)` returns just this one), so fixing it should unblock the build past this point.

## Change

**Delete line 7 of `src/app/portal/payments/page.tsx`:** `export const dynamic = "force-dynamic";`

Why this is safe (not just silencing the error): the page calls `requireSession()` (`src/lib/auth/session.ts`), which `await cookies()` (lines 85/98/142/169). Reading `cookies()` under `cacheComponents` automatically opts the route out of static prerendering — so the page stays dynamic/always-fresh exactly as before. The `force-dynamic` directive was redundant. Payment data is fetched client-side via TanStack Query (`PortalPaymentsView`), so there is no server-side cache to worry about either way.

No other files change. Do not add `"use cache"` or `<Suspense>` — the page is correctly dynamic via the cookie read.

## Verification

- `npm run build` — confirm it no longer errors on `portal/payments/page.tsx`. (If the build surfaces a *different*, unrelated error further along, report it separately — it is out of scope for this one-line fix.)
- `npm run dev`, log in as a portal-role user, open `/portal/payments` — confirm the payments view renders and data loads (still dynamic, no stale cache).

---

# (Completed) Audit RHF, remove phantom deps, prototype TanStack Form

## Context

CLAUDE.md claims the form stack is "React Hook Form," but an audit shows **no source file imports it**. The real pattern across ~50 forms is React 19's native `useActionState` + `<form action={action}>` with server-side Zod validation. `react-hook-form` and `@hookform/resolvers` are phantom dependencies.

The user asked to (1) audit which forms would actually benefit from TanStack Form, (2) remove the unused RHF deps and correct CLAUDE.md, and (3) prototype TanStack Form on one complex form so we can compare against the current pattern before committing to any broader migration.

## Audit findings

**Pattern in use everywhere:** uncontrolled native form → `useActionState(action, {})` → server action runs `schema.safeParse(formData)` → errors returned via `state.errors.fieldName` / `state.errors._form`, surfaced inline + via `useFormToast`. No client-side form library.

**Forms that would genuinely benefit** (they already hand-roll the state/validation TanStack Form provides):
- `src/features/registrations/components/StudentRegistrationForm.tsx` — **strongest candidate.** 4-step wizard with manual `draft` state, hand-written `validateStep()` per-step Zod checks, a `getError()` that merges client+server errors, and a guardians **field array** (add/remove/primary toggle). ~800 lines.
- `src/features/enrollments/components/EnrollmentWizardForm.tsx` — 3-step wizard, ~6 `useState`, manual step-error routing via `useEffect`.
- `src/features/finance/fee-templates/components/*` and `FeeScheduleForm.tsx` / `AddFeeItemForm.tsx` — fee-item arrays.
- Moderate: `DiscountRequestForm`, `AssessmentDraftForm`.

**Forms that should stay as-is** (simple, single-submit, server-validated — no benefit, and native forms give progressive enhancement): `UserForm`, `EditUserForm`, `ResetPasswordForm`, `LoginForm`, `ChangePasswordForm`, `SchoolYearForm`, `CreateSubjectForm`, `AssignTeacherForm`, `BookletForm`, and the rest (~40 forms).

**Conclusion:** No blanket migration. TanStack Form pays off only on the handful of wizard/field-array forms.

## Changes

### 1. Remove phantom RHF deps
- Edit `package.json`: remove `react-hook-form` (line 48) and `@hookform/resolvers` (line 26).
- Run `npm install` to refresh `package-lock.json`.

### 2. Correct CLAUDE.md (both files)
- `C:\Users\wynzy\Downloads\sram-mmhsi\CLAUDE.md` stack line currently says "React Hook Form". Replace with the actual pattern: "React 19 `useActionState` + server actions + Zod (server-side validation)". Note TanStack Form is being trialed for complex wizard/field-array forms only.
- `C:\Users\wynzy\Downloads\CLAUDE.md` references React Hook Form in the recommended stack — leave the root design-doc as aspirational, or add a one-line note that the repo uses native Actions. (Confirm with user; default: only fix the in-repo `sram-mmhsi/CLAUDE.md`.)

### 3. Prototype TanStack Form (parallel, non-destructive)
- `npm install @tanstack/react-form`.
- Create a **new** component `src/features/registrations/components/StudentRegistrationFormTanstack.tsx` (the original stays untouched so the two can be compared side by side). It will:
  - Use `useForm` with `defaultValues` for all student fields + a `guardians` array.
  - Use `validators: { onChange: <zodSchema> }` reusing the existing schemas from `src/lib/validators/student.ts` and `common-schemas.ts` (`GuardianSchema`, `emailSchema`, `lrnSchema`, `phoneSchema`) — no schema duplication.
  - Use `<form.Field name="guardians" mode="array">` with `field.pushValue`/`field.removeValue` to replace the hand-rolled guardian add/remove/primary logic.
  - Keep the same 4-step wizard UX and editorial styling (`editorialFieldClass`, `DataCard`).
  - On submit, build `FormData` and call the **existing** `createStudentAction` (server action contract unchanged: `guardians` JSON, intake fields, etc.) — so server validation + audit logging stay authoritative.
- Mount it behind a temporary preview route or a query-param toggle on the existing registration page for comparison (e.g. `?form=tanstack`). Confirm exact mount point with user.

## Verification
- `npm run dev`, open the registration page, exercise both the original and the TanStack prototype: per-field validation as you type, guardian add/remove, step navigation, successful submit creates a student + redirects.
- Confirm the removed deps don't break anything: `npm run build` and `npm run lint` pass.
- Grep to confirm zero remaining `react-hook-form` / `@hookform/resolvers` imports.

## Out of scope
- Migrating the other ~49 forms. This is audit + cleanup + one prototype only; broader migration is a follow-up decision after comparing the prototype.
