# ADR 0002 — Caching Risks and Remediation (with deferred `'use cache'` migration)

- **Status:** Accepted (with revision — see §3.1)
- **Date:** 2026-05-22
- **Predecessor:** [ADR 0001 — Caching/TTL Verification](./0001-caching-ttl-verification.md)
- **Related status report:** `status_report/CACHING-PERFORMANCE-FIX-2026-05-22.md`

---

## §1 Context

ADR 0001 verified the first caching audit (commits `c2dc90a`, `fd9b5fc`,
`ac8f19a`) as accepted, but called out five open items. A fresh scan
surfaced more — particularly around `/staff/payments`, the assessments list,
fee-schedule resolution, and the void-request admin queues. The caching
layer was correct where it existed, but coverage was uneven: routes
structurally similar to `/staff/students` (which is well-cached) were still
doing full DB round-trips per navigation.

In parallel, Next.js 16 ships a directive-based replacement for
`unstable_cache`: `'use cache'` plus `cacheTag()` and `cacheLife()` from
`next/cache`. The new API enables one capability the old one cannot:
**caching a component's rendered output**, not just its data
([docs](https://nextjs.org/docs/app/api-reference/directives/use-cache#caching-a-components-output-with-use-cache)).

This ADR records the risk inventory, the remediation plan, and the full
migration to the new directive.

---

## §2 Risk inventory

### HIGH severity

| ID | Risk | Where |
|---|---|---|
| H1 | `/staff/payments` page re-runs 5 sequential aggregate/queue queries per navigation | `src/app/staff/payments/page.tsx` (pre-fix) |
| H2 | Same page's awaits ran serially even after caching | same file |

### MED severity

| ID | Risk | Where |
|---|---|---|
| M1 | Assessments list uncached | `src/features/assessments/assessments.queries.ts` (`getAssessmentsList`) |
| M2 | Fee-schedule resolution recomputed per assessment view | same file (`resolveFeeScheduleForAssessment`) |
| M3 | Void-request org-wide queries uncached | `src/features/payments/void-requests.queries.ts` |
| M4 | `useFeeItemTypes` client `staleTime` (120 s) shorter than server TTL (300 s) | `src/features/finance/fee-item-types/hooks/use-fee-item-types.ts` |

### LOW severity

| ID | Risk | Where |
|---|---|---|
| L1 | Cache tag literal bypassed central registry (`tags: ['enrollments']`) | `src/features/enrollments/enrollments-queue.queries.ts` |
| L2 | `useCashierQueue` exported but never imported | `src/features/payments/hooks/use-cashier-queue.ts` |
| L3 | No SSR-hydration regression test for fee-item-types | `src/app/staff/finance/fee-item-types/page.tsx` ↔ hook |

---

## §3 Decisions

### §3.1 `'use cache'` migration deferred (revision)

The original plan migrated all 12 existing `unstable_cache` sites to the
directive-based API (`'use cache'` + `cacheTag()` + `cacheLife()`) and
enabled `cacheComponents: true` in `next.config.ts`. That migration was
attempted and reverted during this work for a concrete reason:

`cacheComponents: true` makes pages **dynamic-by-default** until they
hit a `'use cache'` boundary, and Next.js 16 enforces a strict pattern:
any uncached data read (including `cookies()` inside `requireSession()`)
that runs outside a `<Suspense>` boundary becomes a build error
("Uncached data was accessed outside of `<Suspense>`. This delays the
entire page from rendering.").

This codebase reads the session at the top of essentially every staff,
admin, and portal page. Making the directive migration work would
require restructuring 30+ pages to either move the auth check below a
Suspense boundary or accept that every page renders an empty shell
first. The flag is also mutually exclusive with
`export const dynamic = "force-dynamic"`, so there's no per-page
opt-out.

The directive migration is therefore deferred to a separate effort with
its own dedicated Suspense restructuring. **All 12 sites stay on
`unstable_cache`** (still supported in Next.js 16). The other
improvements in this ADR are fully API-agnostic and ship unchanged.

When we revisit the migration, the steps are documented:

1. Enable `cacheComponents: true` in `next.config.ts`.
2. Add named `cacheLife` profiles for the four existing TTL conventions
   (60 s, 300 s, 600 s, 3600 s).
3. Add a TS module augmentation so custom profile names are accepted.
4. Convert each `unstable_cache(fn, [key], opts)` to a function-level
   `"use cache"; cacheTag(...); cacheLife(...);` body.
5. Restructure every page that reads `cookies()`/`session` at the top
   level so that the session-dependent body is wrapped in `<Suspense>`,
   OR move auth into a deferred boundary using `await connection()`.
6. Re-run build until no "uncached data outside `<Suspense>`" errors
   remain.

### §3.2 Tag invalidation stays the same

The `invalidateTag()` wrapper in `src/lib/cache/cache-tags.ts` already
passes `"max"` (stale-while-revalidate) as the second arg to
`revalidateTag()` — required since Next.js 16 deprecated the single-arg
form.

For mutations where the **acting user** must see fresh data on their next
render (cashier posting a payment, finance approving a void), action
handlers pair `invalidateTag(...)` (cross-page) with
`revalidatePath(...)` (the acting tab's path). The path-scoped revalidation
bypasses the SWR window for that user; the tag invalidation covers
everyone else's tabs.

### §3.3 Stat-card subtree extraction with Suspense

`<CashierQueueStatsCards />` was extracted into its own server component
under `src/features/payments/components/` and wrapped in `<Suspense>`
inside `/staff/payments/page.tsx`. The data layer
(`fetchCashierQueueData`) is cached under `PAYMENTS_QUEUE` via
`unstable_cache`, so even though the component re-renders on every
request, the underlying DB queries collapse to a single cache lookup
per (cached) window.

Component-output caching (i.e., caching the rendered React tree itself)
was deferred along with the `'use cache'` migration — that capability is
specific to the directive-based API. The current extraction still
delivers (a) clean separation of concerns and (b) streaming of the rest
of the page via `<Suspense>`.

### §3.4 Out of scope

- Migration to `'use cache: private'` for per-user caches — no per-user
  caches in this audit's scope (per-user void-request queries stay
  uncached intentionally).
- Static-dropdown component-output caching — no standalone dropdown
  components found in the codebase (selects are inline in forms). Their
  underlying data layer is already cached.
- Admin dashboard component-output caching — the data fetcher
  (`getAdminDashboardMetrics`) is already cached at the function level;
  additional component-level caching is marginal.
- Lint debt, `loading.tsx` Suspense gaps, `pg_stat_statements`, `vitest`
  alias.

---

## §4 Files touched

### Cache tag registry
- `src/lib/cache/cache-tags.ts` — three new tags
  (`PAYMENTS_QUEUE`, `ASSESSMENTS`, `VOID_REQUESTS`), updated header comment

### L1 cleanup
- `src/features/enrollments/enrollments-queue.queries.ts` —
  literal `tags: ['enrollments']` replaced with `CACHE_TAGS.ENROLLMENTS`

### New caches (via `unstable_cache`)
- `src/features/payments/payments.queries.ts` — `fetchCashierQueueData`
  cached under `PAYMENTS_QUEUE` (60 s) + new `assessmentId` field on
  `RecentCollection` (H1, H2)
- `src/features/assessments/assessments.queries.ts` —
  `getAssessmentsList` cached under `ASSESSMENTS` (60 s) (M1), new
  `resolveActiveFeeSchedule` cached under `FEE_TEMPLATES` (1 h) (M2)
- `src/features/payments/void-requests.queries.ts` — four org-wide
  queries cached under `VOID_REQUESTS` (60 s) (M3)

### Action invalidations
- `src/features/payments/payments.actions.ts` — `PAYMENTS_QUEUE`,
  `ASSESSMENTS` invalidated on post/void
- `src/features/assessments/assessments.actions.ts` — `ASSESSMENTS`,
  `PAYMENTS_QUEUE` invalidated on create + balance-transfer reversal
- `src/features/payments/void-requests.actions.ts` — `VOID_REQUESTS`
  invalidated on every mutation; `PAYMENTS_QUEUE` + `ASSESSMENTS` +
  `DASHBOARD` also on approve

### Stat-card subtree extraction
- `src/features/payments/components/CashierQueueStatsCards.tsx` (new) —
  server component with skeleton; data layer cached via
  `fetchCashierQueueData`
- `src/app/staff/payments/page.tsx` — uses `fetchCashierQueueData` and
  the extracted stats subtree under `<Suspense>` (no more duplicated DB
  queries on the page)

### Client/server TTL alignment
- `src/features/finance/fee-item-types/hooks/use-fee-item-types.ts` —
  client `staleTime` raised from 120 s to 300 s (M4)

### Dead-code removal
- `src/features/payments/hooks/use-cashier-queue.ts` — `useCashierQueue`,
  `fetchCashierQueue`, `CashierQueueResponse*` removed (L2); mutation
  hooks retained
- `src/features/payments/hooks/index.ts` — barrel updated

### Tests
- `src/features/finance/fee-item-types/__tests__/hydration-key-alignment.test.ts`
  (new) — mirrors the students variant (L3)

---

## §5 Next.js 16 caching primitives — appendix

For the next maintainer, a quick reference of the facts that shaped this
migration.

1. **`'use cache'` directive** — at top of an async function, component,
   or file. Inputs (closure + serialized args) become the cache key
   automatically. Variants exist for shared (`use cache: remote`) and
   per-user (`use cache: private`) caches; this codebase uses the public
   `'use cache'` exclusively.
2. **`cacheTag('tag')` + `cacheLife(profile | options)`** — called inside
   the directive's scope.
3. **`cacheComponents: true`** — flips pages to dynamic-by-default until
   a `'use cache'` boundary is encountered.
4. **`cacheLife` presets** — `'seconds'`, `'minutes'`, `'hours'`,
   `'days'`, `'weeks'`, `'max'`. Custom named profiles go in
   `next.config.ts`. This codebase defines four custom profiles.
5. **`revalidateTag(tag, profile)`** — two-arg in Next.js 16. The
   single-arg form is deprecated. Our `invalidateTag()` wrapper always
   passes `"max"`.
6. **`"max"` profile semantics** — stale-while-revalidate. After
   invalidation the next viewer sees stale data once while fresh data
   loads in the background. Pair with `revalidatePath()` for the acting
   user when fresh-on-next-render matters.
7. **`revalidatePath` is path-scoped** — does NOT invalidate other pages
   sharing the same tag. Tag invalidation is required for cross-page
   coverage.
8. **Component-output caching** — `'use cache'` inside an async
   component caches the rendered React tree, not just data. Safe only
   when the rendered subtree has no per-request input (no `cookies()`,
   no `headers()`, no session).

---

## §6 Verification

See ADR 0001 §5 (updated) for the runtime verification record. Build and
unit tests verified clean post-migration. The `cacheComponents: true`
flag is experimental — if a critical bug appears, the rollback is to
revert `next.config.ts` and switch the new caches back to
`unstable_cache` (every other piece of this work — tags, invalidations,
TTL values, parallelization — is API-agnostic).
