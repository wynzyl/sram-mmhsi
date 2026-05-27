# Caching Architecture

SRAMS uses **two independent cache layers**. They never overlap: a given dataset is cached in one or the other, never both.

## 1. Server cache — Next.js 16 `"use cache"`

Shared across all users/requests. Opt-in per query:

```ts
"use cache";
cacheTag(CACHE_TAGS.SCHOOL_YEARS);
cacheLife("hours");
```

**What's cached (and lifetime):**

| Data | File | Lifetime |
|---|---|---|
| School years | `lib/queries/schoolYears.ts` | 1h |
| Grade levels | `lib/queries/gradeLevels.ts` | 1h |
| Discount types | `features/discounts/discounts.queries.ts` | 1h |
| Fee templates / fee item types | `features/finance/fee-templates/fee-templates.queries.ts` | 10m |
| Enrollment queue counts | `features/enrollments/enrollments-queue.queries.ts` | 1m |
| Admin dashboard metrics | `lib/queries/admin-dashboard.ts` | 1m |

Rule of thumb: **reference/config → hours; summaries/aggregates → ~1 min.**

**Invalidation** (`lib/cache/cache-tags.ts`):

- `invalidateTag(tag)` → `revalidateTag(tag, "max")` — stale-while-revalidate, for dashboard/summary data.
- `forceUpdateTag(tag)` → `updateTag(tag)` — blocking, instant expiry, for read-your-own-writes (enrollment/assessment/payment mutations).
- Tags are centralized in `CACHE_TAGS`; only add a tag once a query actually subscribes via `cacheTag()`.

## 2. Client cache — TanStack Query

Per-user, per-browser-tab, in-memory only. Browser singleton in `lib/query/query-client.ts` (cleared on hard reload / new tab). Defaults: `staleTime 60s`, `gcTime 5m`, `refetchOnWindowFocus false`.

**What's cached:** live operational lists — currently the **student directory** (`useStudents`). Each filter combo is its own entry, keyed by `queryKeys.students.list({ schoolYearId, gradeLevelId })`.

**School-year freshness tiers** (`lib/query/staleness.ts`, applied in `use-students.ts`):

| Entry | staleTime | gcTime | refetch focus/mount |
|---|---|---|---|
| Active school year | 0 (always fresh) | 5m | yes |
| Past school year | 30m | 1h | no |

The active-year id comes from the server (`getActiveSchoolYear`) via `ActiveSchoolYearProvider` and drives the tier choice.

## What is NOT cached

- `/api/students` → `fetchStudentDirectoryPage`: **no server cache** — hits Postgres fresh every request. Student rows are cached only client-side (TanStack).
- Individual payments and assessments: intentionally uncached server-side so financial reads are always current.

## Mental model

- **Server cache** = slow-changing config + dashboard summaries, shared across everyone.
- **Client cache** = live per-user lists where active-year data must stay fresh; mutations (`useCreateStudent` / `useUpdateStudent`) call `invalidateQueries` to refresh immediately.
