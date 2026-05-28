# TanStack Form Migration — Implementation Report

**Date:** 2026-05-28
**Status:** ✅ Complete (first in-place migration)
**Scope:** `StudentRegistrationForm` (4-step wizard + guardian field array)

Companion to [`../01-STATUS-REPORT/TANSTACK-FORM-TRIAL-REPORT.md`](../01-STATUS-REPORT/TANSTACK-FORM-TRIAL-REPORT.md)
(the trial) and [`TANSTACK-FORM-CANDIDATES.md`](./TANSTACK-FORM-CANDIDATES.md) (the per-form assessment +
migration order). This report records the first production form actually migrated.

---

## Executive summary

Migrated the student registration wizard from the native React 19 `useActionState` pattern to
TanStack Form (`@tanstack/react-form`), **in place** — no parallel file, no `?form=` toggle. The form
gains live per-field validation and a typed guardian field array while keeping the existing server
action and FormData contract byte-for-byte, so server-side Zod validation and audit logging remain
authoritative.

Two real bugs were found and fixed via browser dogfooding (not visible in code review): a broken
guardian single-primary toggle and a stalled submit redirect.

### Key metrics

| Metric | Value |
|--------|-------|
| Forms migrated | 1 (`StudentRegistrationForm`) |
| Files modified | 3 (form, page template, barrel) |
| Files deleted | 1 (`StudentRegistrationFormTanstack.tsx` prototype) |
| Deps removed | 2 (`react-hook-form`, `@hookform/resolvers` — phantom) |
| Bugs fixed during migration | 2 (primary toggle, submit transition) |
| TypeScript errors | 0 |
| ESLint | clean |
| Server contract changes | 0 |

---

## What changed

| File | Change |
|------|--------|
| `src/features/registrations/components/StudentRegistrationForm.tsx` | Rewritten on TanStack Form (`useForm`, `<form.Field>`, `mode="array"` guardians). Same props, same redirect (`/staff/registrations`). |
| `src/app/page-templates/registrations/new-student-registration-page.tsx` | Removed the `?form=tanstack` branch + prototype import; always renders the migrated form. `searchParams` no longer carries `form`. |
| `src/features/registrations/index.ts` | Removed the `StudentRegistrationFormTanstack` export. |
| `src/features/registrations/components/StudentRegistrationFormTanstack.tsx` | **Deleted** (throwaway trial prototype). |
| `package.json` / lockfile | Removed phantom `react-hook-form` + `@hookform/resolvers` (zero source imports). |

---

## Migration pattern (reuse for the next forms)

1. **`useForm` + `defaultValues`** for every field, including the guardian array
   (`guardians: [emptyGuardian(true)]`).
2. **Reuse existing Zod schemas** via a `zodCheck` adapter that runs `safeParse` and returns
   `string | undefined` — this sidesteps TanStack's standard-schema output-type constraint and works for
   optional/array fields. No schema duplication.
   ```ts
   const zodCheck =
     (schema: z.ZodType) =>
     ({ value }: { value: unknown }): string | undefined => {
       const r = schema.safeParse(value);
       return r.success ? undefined : r.error.issues[0]?.message;
     };
   ```
3. **Field array** via `<form.Field name="guardians" mode="array">`, plus a whole-array validator
   (`validateGuardians`) enforcing GuardianSchema on each row and the single-primary rule. Step-3 gating
   calls `form.validateField("guardians", "change")`.
4. **Array-item flags** (`isPrimary`) are mutated by **replacing the whole array** with
   `form.setFieldValue("guardians", next)`, not by `setFieldValue` on a nested bracket path. This is the
   fix for the trial's broken toggle (see below).
5. **Per-step gating** via `form.validateField` over each step's field list before advancing.
6. **Unchanged server contract:** on submit, build the same `FormData` (scalar keys + `guardians` JSON +
   `schoolYearId` / `registrationIntent` / `registrationStudentType` + intake keys) and dispatch the
   existing `createStudentAction`. Server-side field errors are merged back into the inline messages
   (`mergedError(field, state.errors)`).
7. **Dispatch inside `startTransition`** — `useActionState`'s action must be called within a transition,
   otherwise `state` never updates (no toast, no redirect). See below.

---

## Bugs found + fixed during migration

### 1. Guardian single-primary toggle (carried over from the trial prototype)

**Symptom:** clicking "Set as primary" on guardian 2 did nothing — the badge stayed on guardian 1.

**Root cause:** the prototype set `form.setFieldValue(\`guardians[${j}].isPrimary\`, …)`, but `isPrimary`
was never rendered as a `<form.Field>`, so the array store wasn't updated reactively and the badge never
moved. On submit it would always send guardian 1 as primary.

**Fix:** maintain the single-primary invariant by writing the whole array:
```ts
const setPrimary = (index: number) =>
  form.setFieldValue("guardians", guardianList().map((g, i) => ({ ...g, isPrimary: i === index })));
```
`removeGuardian` likewise reassigns primary to the first row if the removed one was primary.

### 2. Submit didn't redirect (transition warning)

**Symptom:** the server POST returned 200 and created the student, but the client stayed on the form —
no success toast, no redirect. React warned: *"An async function with useActionState was called outside
of a transition."*

**Root cause:** TanStack's `onSubmit` is a plain async handler; calling the `useActionState` dispatcher
there is outside React's transition, so `state` (and therefore `useFormToast`'s `onSuccess`) never fired.

**Fix:** `startTransition(() => action(fd))`.

---

## Verification

- `npx tsc --noEmit` — clean (0 errors).
- `npx eslint` on changed files — clean.
- Grep — zero remaining `react-hook-form` / `@hookform/resolvers` / `StudentRegistrationFormTanstack` /
  `form=tanstack` references.
- **Browser dogfood** (`/staff/students/new`, authenticated):
  - Live per-field validation clears errors as you type.
  - Guardian add / remove works.
  - **Primary toggle moves the badge** (`G1:- G2:PRIMARY`); removing the primary falls back to G1.
  - Step gating blocks advance on an invalid field (e.g. bad email) until corrected.
  - Full submit creates the registration and redirects to `/staff/registrations`, zero transition
    warnings. Confirmed two test registrations created end-to-end.

> Dogfood note: the verification runs created two test registrations in the dev DB (**Maria Santos**,
> **Pedro Reyes**). Soft-delete them if a clean dev dataset is wanted.

---

## Next targets

Per the candidates assessment: the field-array forms `StudentForm` / `EditStudentForm` (they share the
guardian array and can reuse the `setPrimary` / whole-array pattern above), then `AssessmentDraftForm`
only if fee-line editing is added. The ~15 simple single-submit forms stay native.
