Updated: 5-21-2026

# Diagnosis: Pages slower after caching / revalidation / skeleton changes

## Context

The user reports that pages became less responsive after the recent stack of changes (commits `fd9b5fc`, `ac8f19a`, and the loading-skeleton + TanStack Query + Sonner work). Before these changes the same pages felt snappier. This plan pinpoints the concrete causes (no code changes proposed yet — investigation only).

## Root causes (ranked by impact)

### 1. `force-dynamic` on the admin dashboard defeats its own `unstable_cache` — HIGH

- `src/app/admin/dashboard/page.tsx:10` — `export const dynamic = "force-dynamic"`
- `src/lib/queries/admin-dashboard.ts:223` — `getAdminDashboardMetrics` is wrapped in `unstable_cache(..., { revalidate: 60, tags: [CACHE_TAGS.DASHBOARD] })`

`force-dynamic` opts the route into dynamic rendering, which bypasses the page-level Data Cache. The 6 aggregate queries (`COUNT`, `SUM`, joined `EXISTS`) in `_getAdminDashboardMetricsUncached` re-execute on every single request. The cache code looks like it's helping but isn't. Net effect: the dashboard is the slowest page it has ever been.

### 2. Server blocks render on heavy DB queries before any UI streams — HIGH

- `src/app/staff/finance/fee-item-types/page.tsx:28` — `const feeTypes = await getAllFeeItemTypesAdmin();` runs before any JSX is returned
- `src/app/page-templates/students/students-directory-page.tsx:43,51` — two sequential `await`s (`fetchActiveSchoolYearId()`, then `fetchStudentDirectoryPage()`) before render

The new `loading.tsx` files paint a skeleton while these queries run, but nothing streams in. The user sees the skeleton for the *entire* DB-query duration, then a hard swap to final content. Pre-skeleton, the same blocking query existed but the user saw a less jarring "blank → content" transition; now it's "blank → skeleton flash → content" which *feels* longer even when wall-clock is similar.

Representative `loading.tsx` files: `src/app/admin/dashboard/loading.tsx`, `src/app/staff/students/loading.tsx`, `src/app/staff/payments/loading.tsx`, plus 4 others.

### 3. HydrationBoundary cache-key mismatch wastes the SSR prefetch on the students directory — HIGH

- Server key (`students-directory-page.tsx:74-79`):
  ```ts
  { q: "", page, schoolYearId: schoolYearId || null, gradeLevelId: gradeLevelId || null }
  ```
- Client key (`src/features/students/hooks/use-students.ts:69-74`):
  ```ts
  { q: "", page, schoolYearId: schoolYearId || undefined, gradeLevelId: gradeLevelId || undefined }
  ```

`null` vs `undefined` produces a different TanStack Query hash. The dehydrated cache entry never matches the client `useStudents` lookup, so on mount the client immediately refetches via `/api/students` — re-running on the server the same query the page just awaited. Result: **double work on every visit**, plus an extra network round-trip the user has to wait through before the table is interactive.

### 4. Aggressive client `staleTime` undoes hydration on idle/interaction — MEDIUM

- `use-students.ts:82` — `staleTime: 30 * 1000`
- `use-cashier-queue.ts` — `staleTime: 15 * 1000`
- `use-fee-item-types.ts:63` — `staleTime: 2 * 60 * 1000` (fine)

Even where hydration keys match, 15–30s stale windows are shorter than the time users spend on a page before clicking a filter or paginating, so the next interaction triggers a refetch and a visible loading state. The server-side `unstable_cache` revalidates much less frequently (60s+), so the client is doing more work than the server cache.

### 5. Mutations now require a client round-trip where they used to be one-shot — MEDIUM

- Hooks like `useCreateFeeItemType` / `useToggleFeeItemType` (`use-fee-item-types.ts:75-132`) call server actions then `queryClient.invalidateQueries`, which fires `fetch("/api/fee-item-types")`.

Previously, server actions could call `revalidatePath`/`revalidateTag` and the next render arrived in one shot from the server. Now every mutation = action call + API refetch + toast render. The toast migration (`17124fb`) is fine on its own, but combined with the invalidate→refetch path it makes post-submit flows feel laggy.

### 6. Render path is per-render `new QueryClient` on the server — LOW

- `src/lib/query/query-client.ts:32-44` — `getQueryClient()` correctly returns a fresh `QueryClient` per server request, but each page that uses prefetch pays that allocation + dehydration cost. Small in isolation; adds up across nested layouts.

## What is NOT the cause

- The separation between server caching and TanStack Query caching is correct (prior verification stands).
- `QueryClient` defaults (`staleTime: 60s`, `gcTime: 5min`, `refetchOnWindowFocus: false`) are sensible.
- `unstable_cache` is not being applied to session-dependent data (no `requireSession` inside cached functions).
- No other route exports `force-dynamic` besides admin dashboard.

## Suggested fix direction (for a follow-up plan, not this one)

1. Remove `export const dynamic = "force-dynamic"` from `src/app/admin/dashboard/page.tsx:10`. The `unstable_cache` already revalidates every 60s — that is the right freshness knob.
2. Normalize the prefetch key in `students-directory-page.tsx:74-79` to use `undefined` (not `null`), matching `use-students.ts:69-74`. Verify by checking that `useStudents` returns `isFetching: false` on first paint.
3. Wrap the heavy server fetch in a `<Suspense fallback={…}>` boundary *inside* the page (instead of relying on `loading.tsx` for the whole route) so the header/shell paints immediately and only the data region shows the skeleton.
4. Raise `staleTime` on `use-students` and `use-cashier-queue` to align with their server-side cache TTLs (e.g. 60–120s), or remove the client query entirely on pages that already hydrate from SSR.
5. For mutation flows that don't need optimistic UI, prefer `router.refresh()` + server `revalidateTag` over `invalidateQueries` + `/api/*` refetch. Keep TanStack mutations only where the form needs intermediate optimistic state.

## How to verify the diagnosis

- **Dashboard cache bypass:** with the dev server running, open `/admin/dashboard`, then open Network → server logs. Confirm the 6 aggregate queries run on every refresh. After removing `force-dynamic`, confirm they run only on first hit and then once per 60s.
- **Students prefetch waste:** load `/staff/students`, open React Query DevTools (or log in `useStudents`), confirm a `/api/students` request fires on mount despite SSR fetching the same data. After aligning the keys, confirm `isFetching` is `false` immediately.
- **Skeleton flash:** record a page load with browser perf tools. Compare TTFB → first content vs. TTFB → skeleton → content. With Suspense inside the page, expect the shell to paint before the data region.
- **Mutation round-trip:** in fee-item-types, create or toggle a type and watch Network. Today you'll see action POST + `/api/fee-item-types` GET. With `router.refresh()` you should see only the action + a streamed RSC payload.
