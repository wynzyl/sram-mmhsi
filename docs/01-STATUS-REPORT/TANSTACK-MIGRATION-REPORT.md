# TanStack Query Migration — Status Report

Audited status of the client-data layer after migrating the financial **transactional lists**
(assessments + payments) onto TanStack Query. Companion to [`CACHING-ARCHITECTURE.md`](./CACHING-ARCHITECTURE.md):
that doc defines *where* data is cached; this one records *what was migrated, what was deliberately
left, and why*.

**Hard rule (unchanged):** payments/assessments are **never** cached server-side (`"use cache"`), and on
the client they are **always-fresh** — `staleTime: 0`, refetch on mount + focus. This is deduping + live
invalidation, not stale serving. Verified: `grep "use cache"` returns **0** hits under
`src/features/payments` and `src/features/assessments`.

## 1. Shared freshness policy

A single helper centralizes the always-fresh financial policy:

```ts
// src/lib/query/staleness.ts
export function financialFreshness() {
  return { staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true } as const;
}
```

Used by every financial read hook below. Contrast with `schoolYearFreshness()` (students directory),
which serves past years from a 30m stale window — **not** used for financial data.

## 2. What was migrated (client reads)

| Surface | Route shell | API route | Hook | Client view | Freshness |
|---|---|---|---|---|---|
| Students directory | `/staff`,`/admin/students` | `/api/students` | `useStudents` | `StudentDirectoryView` | school-year aware |
| Assessments lists | `/staff/assessments` | `/api/assessments` | `useAssessments` | `AssessmentsDirectoryView` | always-fresh |
| Cashier dashboard | `/staff/payments` | `/api/cashier/queue` | `useCashierQueue` | `CashierDashboardView` | 15s stale + 30s poll |
| Fee item types | `/staff/finance/fee-item-types` | `/api/fee-item-types` | `useFeeItemTypes` | `FeeItemTypesView` | 2m stale |
| Portal payments | `/portal/payments` | `/api/portal/payments` | `usePortalPayments` | `PortalPaymentsView` | always-fresh |

**Pattern (non-negotiable, students convention):** route file = thin server shell (auth + permission only)
→ renders a client `*View` wrapper that owns the `useQuery` call → passes data into existing
presentational components. No presentational components were duplicated; pages were reduced to shells.

## 3. Mutations & invalidation

| Mutation hook | Action | Invalidates |
|---|---|---|
| `useCreateStudent` / `useUpdateStudent` | student create/update | `students.all` / `students.lists()` + `students.detail(id)` |
| `usePostPayment` / `useVoidPayment` | cashier post/void | `payments.queue()` + `booklets.all` + `assessments.all` |
| `useCancelAssessmentFromQueue` | pending-queue cancel | `assessments.all` + `payments.queue()` |
| create/update/toggle fee item type | fee item type CRUD | `feeItemTypes.all` |

All mutation hooks gate on `result.success` before invalidating. No optimistic updates; form-level
errors surface via `useFormToast`.

## 4. What is NOT on TanStack (by design)

- **Assessment ledger** (`/staff/assessments/[id]`, `AssessmentLedgerRegister`): stays **server-rendered**.
  Posting (`PostPaymentForm` → `postPaymentAction`) and cancel (`cancelAssessmentAction`) use server actions
  + `router.refresh()`. The page has **no server cache**, so `router.refresh()` already re-fetches fresh
  payments + balance after every post/void/cancel. Migrating it would mean restructuring the critical
  OR-consuming screen for a marginal gain — **intentionally skipped**.
- **Registrations, enrollments, invoices, grades, subjects, fee templates, discount requests**: still
  server-component + Drizzle (some with `"use cache"` for reference data). Not part of this migration.
- **Server-side**: `/api/students`, `/api/assessments`, `/api/cashier/queue`, `/api/portal/payments` all hit
  Postgres fresh per request — no `"use cache"`. Financial reads are always current.

## 5. Audit findings (resolved this cycle)

- **Adoption gap:** the query-key factory (`src/lib/query/keys.ts`) defines 17 namespaces; most were unused
  scaffolding. Assessments + payments(portal) are now live; the remaining namespaces stay aspirational.
- **Overstated "stale-after-write" risk:** features that read server-side rely on `revalidatePath`/
  `revalidateTag` — there is no TanStack cache to go stale there. The only genuine mixed-mode spot is
  `EnrollmentConfirmationDrawer` (a `useQuery` read of intake docs + a non-invalidating action write); low
  impact (read-only doc status), left as a follow-up.
- **Re-assessment failure (fixed):** root cause was **migration drift**, not application code. The live DB
  had the *full* unique index `assessments_enrollment_id_uidx (enrollment_id)`; migrations **0010** and
  **0011** were unapplied (`drizzle-kit migrate` exits 1 in this environment regardless of state). A
  cancelled assessment kept occupying the enrollment's unique slot, so re-assessment collided on INSERT.
  Resolved by applying 0010 + 0011 SQL and reconciling `drizzle.__drizzle_migrations` in one atomic
  transaction. Verified post-state: index is now partial (`WHERE cancelled_at IS NULL`), 12/12 migrations
  recorded, 0 duplicate students/registrations.

## 6. Verification performed

- `npx tsc --noEmit` — clean after each phase.
- `npm run build` — compiles; new routes present (`/api/assessments`, `/api/portal/payments`).
- `npx eslint <changed files>` — clean (exit 0). Repo-wide lint has 82 pre-existing problems in unrelated
  files.
- DB index/migration state verified directly against Postgres (`pg_indexes`, `drizzle.__drizzle_migrations`).
- Manual browser confirmation: assessments directory responsiveness confirmed by user; payments + portal
  pending user dogfood.

## 7. Open follow-ups (not blocking)

- `drizzle-kit migrate` exits 1 in this environment even with nothing to apply — a tooling/Windows quirk to
  run down separately; schema state is correct.
- Tighten `usePostPayment`/`useVoidPayment` to `assessments.byStudent(id)` / `.detail(id)` once an
  assessments-detail TanStack read exists (currently broad `assessments.all`, harmless no-op today).
- Add invalidation (or remove the `useQuery`) in `EnrollmentConfirmationDrawer`.
- Prune unused namespaces in `keys.ts` to reflect reality.
