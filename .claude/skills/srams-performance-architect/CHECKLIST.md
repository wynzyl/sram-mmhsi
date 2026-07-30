# SRAMS Architecture Review Checklist

_Last updated: 2026-07-30 (Database Query Optimization Implemented)_

## Database

- [x] Normalized — Feature-based schema with proper relations
- [x] Proper FK — All relationships have foreign keys
- [x] Composite indexes — Archive indexes added (0003_add_archive_indexes.sql)
- [ ] Missing indexes — Not fully audited
- [ ] Dead columns — Not audited
- [ ] Dead tables — Not audited
- [ ] Sequential scans — Not audited
- [ ] Duplicate data — Not audited
- [x] Constraints — Unique constraints on OR numbers, student refs
- [x] Cascade rules — Soft delete pattern enforced

---

## Queries

- [x] SELECT \* — 256+ explicit column selections, no SELECT * usage
- [x] N+1 — Fixed: enrollment-cancellation.queries.ts uses LEFT JOIN with table aliases
- [ ] Duplicate queries — Not fully audited
- [x] Pagination — SQL-level pagination everywhere (void-requests.queries.ts updated)
- [x] Search optimization — SQL-level ILIKE filtering
- [x] Transactions — Payment posting uses DB transactions
- [x] Batch operations — Batch lookups used (e.g., manual entry suggestions)
- [x] Aggregations — SQL-level SUM/COUNT with CTEs
- [x] JS-to-SQL filters — Term filtering moved to SQL WHERE clause in grades.queries.ts

---

## Backend

- [ ] Repository Pattern — Using server actions directly
- [x] Service Layer — Server actions in src/features/*/\*.actions.ts
- [x] Shared validation — Zod schemas in src/lib/validators/
- [x] Shared authorization — hasPermission() in src/lib/rbac/permissions.ts
- [x] Thin actions — Business logic centralized in actions
- [x] Business logic separation — Feature-based organization

---

## Frontend

- [x] Server Components — Primary pattern throughout app
- [x] Suspense — Used with loading states
- [ ] Streaming — Partial implementation
- [x] Lazy loading — Drawer details lazy-loaded (enrollments)
- [ ] Memoization — Partial; not systematically audited
- [x] Hydration — Date formatting fixed (Asia/Manila timezone)

---

## TanStack Query

- [x] Stable query keys — Factory pattern in `src/lib/query/keys.ts` (8 namespaces, type-safe)
- [x] staleTime — Constants extracted to `staleness.ts` (STANDARD/RARE_CHANGE/LIVE_DATA)
- [x] gcTime — Configured globally (5 min) + adaptive for archived data (1 hr)
- [x] Prefetch — Hook created (`use-student-prefetch.ts`); 1 SSR instance in fee-item-types
- [x] Optimistic updates — Implemented for payment posting (`use-cashier-queue.ts`)
- [x] Invalidation — Verified correct for financial ops; assessment keys support view filtering
- [x] Error handling — Global handlers in QueryCache + MutationCache

---

## Forms

- [x] Shared fields — TextInputField, SelectField, CurrencyInputField
- [x] Shared validation — Zod schemas with common-schemas.ts
- [x] Minimal rerenders — useActionState pattern
- [x] Reusable controls — Form components in src/components/forms/

---

## UI

- [x] Shared Table — DataTable<T> component
- [x] Shared Dialog — AlertDialog with accessibility
- [x] Shared Form — FormSection, FormActions components
- [x] Shared Badge — StatusBadge component
- [x] Shared Card — StatCard component
- [x] Shared Header — PageHeader with breadcrumbs

---

## Tailwind

- [x] CVA — Used for variant styling
- [x] twMerge — cn() utility function
- [x] Design tokens — CSS custom properties for theming
- [ ] Utility reduction — Not audited

---

## Security

- [x] RBAC — Role-based permissions enforced at 3 levels
- [x] Authorization — Route guard + action validation + audit
- [x] SQL injection — Drizzle parameterization throughout
- [x] Audit logs — Financial actions logged (logAudit helper)
- [x] Transactions — Payment posting uses transactions

---

## Architecture

- [x] Feature modules — src/features/ structure (20+ features)
- [x] Shared utilities — src/lib/utils/
- [x] Shared hooks — src/hooks/ (useFormToast, etc.)
- [~] Shared types — Inline DTOs; needs consolidation to *.types.ts files
- [x] Shared constants — src/lib/constants/

---

## Legend

- [x] Implemented
- [~] Partial (needs improvement)
- [ ] Not implemented / Not audited

## Pending Optimizations (from audit)

### Database Queries (Implemented 2026-07-30)
1. ✅ **CRITICAL:** Fix 4 N+1 user lookups — `enrollment-cancellation.queries.ts` uses LEFT JOIN with aliases
2. ✅ **HIGH:** Add pagination — `listPendingVoidRequests()`, `listMyPendingVoidRequests()` now paginated
3. ✅ **MEDIUM:** Remove unused fields — `isPrimary` removed from `new-assessment-context.queries.ts`
4. ✅ **MEDIUM:** Move JS term filtering to SQL — `grades.queries.ts` uses `inArray(termOffered, validTerms)`
5. **MEDIUM:** Consolidate inline DTOs to dedicated *.types.ts files
6. **LOW:** Convert raw SQL void-request queries to typed Drizzle

### TanStack Query (Implemented 2026-07-30)
7. ~~**CRITICAL:** Remove erroneous enrollments.queue() invalidation~~ — VERIFIED: Invalidation is correct (enrollment status changes)
8. ✅ **HIGH:** Add optimistic updates for payment posting — `use-cashier-queue.ts` updated
9. ✅ **HIGH:** Assessment cache keys already support view filtering via `list(filters)`
10. ✅ **MEDIUM:** Prefetch hook created — `use-student-prefetch.ts` (table integration deferred)
11. ✅ **MEDIUM:** Stale time constants extracted — `staleness.ts` (STANDARD/RARE_CHANGE/LIVE_DATA)
12. ✅ **LOW:** Global error handlers added — `query-client.ts` (QueryCache + MutationCache)
