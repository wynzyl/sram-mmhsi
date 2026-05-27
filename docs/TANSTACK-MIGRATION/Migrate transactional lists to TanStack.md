# Migrate transactional lists to TanStack Query (assessments + payments)

## Context

Today only 3 read surfaces use TanStack Query (students directory, cashier queue, fee-item-types);
most transactional lists are plain server components. We want the **financial transactional lists**
(assessments + payments) on TanStack so they get client caching, smooth pagination, and live
invalidation after mutations — **without ever caching financial data server-side**.

**Hard rule (from `docs/CACHING-ARCHITECTURE.md` + CLAUDE.md):** payments/assessments must NEVER use
Next.js `"use cache"` / `cacheTag`. On the client they must be **always-fresh** (confirmed with user):
`staleTime: 0`, refetch on mount + window focus. We keep `keepPreviousData` for smooth pagination and
invalidate on mutation. This is *deduping + live invalidation*, not stale serving.

Reference implementation to mirror throughout: **students** —
`src/app/api/students/route.ts`, `src/features/students/students.queries.ts`
(`fetchStudentDirectoryPage`), `src/features/students/hooks/use-students.ts`,
`src/features/students/components/StudentDirectoryView.tsx`. Query-key factory already has
`assessments` and `payments` namespaces in `src/lib/query/keys.ts`.

Work proceeds **one phase at a time**; each phase ends with a build/typecheck + a manual responsiveness
check in the browser before starting the next.

---

## Shared prerequisite (do first)

**Add an always-fresh financial freshness helper** to `src/lib/query/staleness.ts` (sits beside the
existing `schoolYearFreshness`), so every financial hook uses one policy:

```ts
// Financial data (payments, assessments): never serve stale — always refetch.
export function financialFreshness() {
  return { staleTime: 0, refetchOnMount: true, refetchOnWindowFocus: true } as const;
}
```

Confirm no payments/assessments query file contains `"use cache"` (verified today: none do — keep it that way).

---

## Phase 1 — Assessments billing tabs (largest read migration)

**Goal:** Convert `/staff/assessments` from server-rendered to a client TanStack view mirroring students.
Always-fresh, snappy tab + page switching.

**Reuse:** existing query fns `getAssessmentsList()` + `getAssessmentTabCounts()` in
`src/features/assessments/assessments.queries.ts` (no `"use cache"` — keep). Existing presentational
components `AssessmentsTable` (`src/features/finance/components/AssessmentsTable.tsx`) and
`PendingAssessmentsQueue` (`src/features/assessments/components/PendingAssessmentsQueue.tsx`).
Existing `assessments` key namespace (`keys.ts:57-68`).

### Deliverables checklist
- [ ] **`src/app/api/assessments/route.ts`** (new) — `GET`. Auth via `getCurrentUser()` + `hasPermission(role,"assessments:read")` (401/403 like students route). Parse `view` (validate against the 6 views), `page`. Returns:
  `{ view, rows | pendingRows, totalCount, totalPages, currentPage, tabCounts, pendingCount, canCreate, canCancel }`.
  - billing views → `getAssessmentsList({ page, pageSize: 20, billingFilter })`
  - `pending` view → the pending-enrollments query currently inlined in `assessments-index-page.tsx:255-300` (move that SQL into a new `getPendingAssessmentQueue({page,pageSize})` in `assessments.queries.ts`)
  - always include `getAssessmentTabCounts()` + pending count
- [ ] **`src/features/assessments/hooks/use-assessments.ts`** (new) — `useAssessments({view,page})` with `queryKey: queryKeys.assessments.list({view,page})`, `placeholderData: keepPreviousData`, `...financialFreshness()`. Plus `useCancelAssessmentFromQueue()` mutation wrapping the existing cancel action, invalidating `queryKeys.assessments.all` + `queryKeys.payments.queue()`.
- [ ] **`src/features/assessments/components/AssessmentsDirectoryView.tsx`** (new, client) — mirrors `StudentDirectoryView`: reads `view`/`page` from `useSearchParams`, renders the full tab nav (counts from query data), and either `AssessmentsTable` or `PendingAssessmentsQueue` + pagination. Reuse pagination markup from the current page-template (`paginationPages`, the `AssessmentsPagination` block) — extract into a shared client component or inline.
- [ ] **`src/app/page-templates/assessments/assessments-index-page.tsx`** — gut to a thin server shell (like `InternalStudentDirectoryPage`): auth + permission only, render `<AssessmentsDirectoryView basePath=... />`. It must **not** fetch searchParam-dependent data (so soft navs stay cheap → single client fetch per nav).
- [ ] Convert the **pending-tab inline cancel** in `PendingAssessmentsQueue` to use `useCancelAssessmentFromQueue()` so the client list refreshes live (currently `useActionState` + `revalidatePath`).

### Verification
- `npm run build` clean. Load `/staff/assessments`; switch all 6 tabs — counts correct, no full reload, no stale spinner flashes (keepPreviousData). Paginate within a tab — smooth. Post/void a payment elsewhere, return → list reflects new balances (always-fresh refetch on mount). Confirm Network tab shows `/api/assessments` with no `cache` headers and a fresh hit each mount.

---

## Phase 2 — Payments main page (smallest; reuse existing hook)

**Goal:** Drive `/staff/payments` stats + queue + recent collections from the **existing**
`useCashierQueue` hook instead of inline server queries. The hook already polls (30s) + `staleTime 15s`
+ no server cache — honors the rule.

**Reuse:** `useCashierQueue` / `usePostPayment` / `useVoidPayment` (`src/features/payments/hooks/use-cashier-queue.ts`), `fetchCashierQueueData` (`payments.queries.ts`), `/api/cashier/queue`, `CashierQueueTable`.

### Deliverables checklist
- [ ] **Add `assessmentId` to recent collections** so the sidebar links work client-side: add the column to the `recentCollections` select in `fetchCashierQueueData` (`payments.queries.ts:162-180`), to `RecentCollection` type, to the route serializer (`api/cashier/queue/route.ts:24-27`), and to `RecentCollectionSchema` (`use-cashier-queue.ts:48-55`).
- [ ] **`src/features/payments/components/CashierDashboardView.tsx`** (new, client) — calls `useCashierQueue()`, renders the 4 KPI cards (`stats`), `<CashierQueueTable rows={queue} />`, the Cashier Policy card, and the Recent Collections sidebar (from `recentCollections`). Lift the JSX from current `page.tsx:121-241`.
- [ ] **`src/app/staff/payments/page.tsx`** — reduce to thin server shell: auth + `payments:read`, render `<CashierDashboardView />`. Remove the inline DB queries.

### Verification
- `/staff/payments` shows identical stats/queue/recent collections, now auto-refreshing every 30s. Post a payment → queue + stats update within the poll/invalidation. Recent-collection links navigate to the assessment ledger. No server cache headers.

---

## Phase 3 — Per-assessment ledger payments (highest risk — do carefully)

**Goal:** Make the payments list + balance summary on the assessment ledger live-update after
post/void, instead of full server re-render. Keep SSR first paint via `initialData`.

**Reuse:** `AssessmentLedgerRegister` (`src/features/payments/components/`), existing post/void mutation
hooks, `keys.ts` `payments.byAssessment(id)` + `assessments.detail(id)`.

### Deliverables checklist
- [ ] **`getAssessmentPayments(assessmentId)`** (new) in `payments.queries.ts` — extract the `paymentRecords` select from `assessment-ledger-page.tsx:78-94` (+ the `ledgerPayments` mapping at 152-163). No `"use cache"`.
- [ ] **`src/app/api/assessments/[id]/payments/route.ts`** (new) — `GET`, auth + `assessments:read`, returns `{ payments, summary: { totalAmount, totalPaid, balance, billingStatus } }`.
- [ ] **`src/features/payments/hooks/use-assessment-payments.ts`** (new) — `useAssessmentPayments(assessmentId, initialData)` with `queryKey: queryKeys.payments.byAssessment(id)`, `...financialFreshness()`, `initialData` seeded from server props (no loading flash).
- [ ] **Extend post/void invalidation** in `use-cashier-queue.ts`: `usePostPayment`/`useVoidPayment` `onSuccess` also invalidate `queryKeys.payments.byAssessment(assessmentId)` and `queryKeys.assessments.detail(assessmentId)`. (Pass `assessmentId` through the mutation variables.)
- [ ] **`AssessmentLedgerRegister`** — read `payments` + balance summary from `useAssessmentPayments` (seeded by the existing server props as `initialData`) instead of static props, so posting/voiding updates the ledger in place. Leave items/discounts/booklets as server props for now.

### Verification
- Open an assessment ledger, post a payment → the payments row appears and balance/summary updates **without full reload**; OR number consumed. Void (or approve void) → row flips to voided, balance reverts. Confirm no stale serving and no server cache.

---

## Phase 4 — Portal payments list (lowest priority)

**Goal:** Move the read-only `/portal/payments` table onto TanStack (always-fresh).

**Reuse:** `getPortalStudentIds` / `getPortalStudentLabels` (`src/lib/queries/portal-student.ts`),
`CurrencyDisplay`, `StatusBadge`.

### Deliverables checklist
- [ ] **`getPortalPayments(userId, role)`** (new) in `payments.queries.ts` — the `studentIds` resolve + payments select from `portal/payments/page.tsx:23-43`, returning rows + student label map + `showStudentColumn`.
- [ ] **`src/app/api/portal/payments/route.ts`** (new) — `GET`, auth via session, `PORTAL_ROLES` guard, returns the portal payment rows for the session user.
- [ ] **`src/features/payments/hooks/use-portal-payments.ts`** (new) — `usePortalPayments()` with `queryKey: queryKeys.payments.list({ scope: "portal" })`, `...financialFreshness()`.
- [ ] **`PortalPaymentsView.tsx`** (new, client) — renders the table (lift JSX from `page.tsx:57-113`); `portal/payments/page.tsx` becomes a thin server shell.

### Verification
- `/portal/payments` renders identical table; refetches fresh on mount/focus. Multi-student accounts still show the Student column.

---

## Global notes & guardrails
- **Never** add `"use cache"`/`cacheTag` to any payments/assessments query touched here.
- Mutation actions keep their `revalidatePath`/`revalidateTag` calls (server-cache correctness for any
  remaining server components); TanStack invalidation is **additive**, not a replacement.
- API routes need auth — use `getCurrentUser()` + `hasPermission(...)` returning 401/403, and call
  `connection()` first (see `api/cashier/queue/route.ts:7`) to opt out of prerendering.
- After every phase: `npm run build` (typecheck) + the phase's manual browser check before moving on.
- Final pass: `npm run lint`, and re-confirm `grep "use cache"` shows zero hits under `src/features/payments` and `src/features/assessments`.
