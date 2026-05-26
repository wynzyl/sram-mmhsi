# Caching, revalidation & skeleton — diagnosis and resolved fixes

This document captures the verified root causes of the post-caching slowdown reported on 2026-05-22 and records the changes that resolved them. Read this before touching `unstable_cache`, `loading.tsx`, or TanStack hydration on this codebase — the same traps are easy to reintroduce.

The full implementation plan that drove these changes lives at:
`~/.claude/plans/verify-that-all-nextjs-dapper-breeze.md`.

---

## 1. Verified root causes (ranked by user-visible impact)

### 1.1. `students.queries.ts` was fully uncached — HIGH ✅ fixed

**Evidence (pre-fix):** `src/features/students/students.queries.ts` contained zero `unstable_cache` wrappers.

Every visit to `/staff/students` (or any other route hitting `fetchStudentDirectoryPage` / `fetchActiveSchoolYearId`) executed:

1. `fetchActiveSchoolYearId` — 1 query
2. Inside `fetchStudentDirectoryPage` — 4 parallel queries (school years list, grade levels list, paginated students join, count)

That's **5 DB round-trips per page load**, none cached. The directory also re-ran all 4 on every URL filter/page change. This was the largest single contributor to perceived slowness.

**Fix:**

- Wrapped `fetchActiveSchoolYearId` in `unstable_cache(..., ['active-school-year-id'], { revalidate: 300, tags: [CACHE_TAGS.SCHOOL_YEARS] })`. The `SCHOOL_YEARS` tag already gets invalidated by any school-year action.
- Wrapped `fetchStudentDirectoryPage` in `unstable_cache(..., ['student-directory-page'], { revalidate: 60, tags: [CACHE_TAGS.STUDENTS] })`. The new `STUDENTS` tag is invalidated from student/enrollment mutations.
- Registered `CACHE_TAGS.STUDENTS` with subscribers documented in `src/lib/cache/cache-tags.ts`.

### 1.2. SSR hydration cache-key mismatch (`null` vs `undefined`) — HIGH ✅ fixed

**Evidence (pre-fix):**

- Server key (`src/app/page-templates/students/students-directory-page.tsx`): `schoolYearId: schoolYearId || null`
- Client key (`src/features/students/hooks/use-students.ts`): `schoolYearId: filters.schoolYearId || undefined`

TanStack Query hashes keys deterministically; `null` and `undefined` hash to different keys. The dehydrated entry never matched the client lookup, so on mount the client immediately fired `/api/students` — re-running the same uncached query the page had already awaited. Net: **2× the query bundle on every first paint**, plus a network round-trip before the table was interactive.

**Fix:** server now uses `undefined` to align with the client. A future Vitest regression test asserts the two keys produce the same TanStack hash.

### 1.3. `force-dynamic` on the admin dashboard — LOW / MEDIUM ✅ removed

**Pre-fix:** `src/app/admin/dashboard/page.tsx:10` exported `dynamic = "force-dynamic"`.

**Important correction:** `unstable_cache` is a function-level cache, **independent** of the route's `dynamic` setting. With `force-dynamic`, the route is dynamically rendered (no Full Route Cache, no static optimization, RSC payload regenerated per request), but the wrapped function still serves its memoized result for the 60-second TTL. The 6 aggregate COUNT/SUM/EXISTS queries do NOT re-execute on every request — they execute once per 60-second window.

Earlier internal notes claimed `force-dynamic` defeated the `unstable_cache` on this page. **That was wrong.** The real cost of `force-dynamic` here is RSC-payload regeneration on every request and skipping the static fallback optimization. Smaller than originally claimed, but still worth removing since the 60-second revalidate window is sufficient freshness.

**Fix:** removed the `force-dynamic` export. The 60s `unstable_cache` revalidate is now the sole freshness knob, supplemented by `invalidateTag(CACHE_TAGS.DASHBOARD)` from finance/enrollment actions.

### 1.4. Aggressive client `staleTime` + 30s `refetchInterval` on cashier queue — MEDIUM ✅ fixed

**Pre-fix:** `src/features/payments/hooks/use-cashier-queue.ts` had `refetchInterval: 30 * 1000` AND `staleTime: 15 * 1000`. A background poll fired every 30s regardless of user activity, including in background tabs.

`src/features/students/hooks/use-students.ts` had `staleTime: 30 * 1000`, shorter than the new 60s server cache, which forced wasted refetches.

**Fix:**

- Cashier queue → `refetchInterval: 60 * 1000`, `refetchIntervalInBackground: false`, `staleTime: 60 * 1000`. Foreground freshness now comes from `router.refresh()` after mutations; the poll is a safety net for activity from *other* cashiers.
- Students list → `staleTime: 60 * 1000` to align with the server cache TTL.

### 1.5. Mutation hooks forced a redundant `/api/*` round-trip — MEDIUM ✅ fixed (with subscriber-mismatch correction)

**Pre-fix (fee-item-types):**

- `fee-item-types.actions.ts` already called `revalidatePath(...)` + `invalidateTag(CACHE_TAGS.FEE_ITEM_TYPES)`.
- `use-fee-item-types.ts` *also* called `queryClient.invalidateQueries(...)`, which fired `fetch("/api/fee-item-types")`.
- That endpoint ran an **uncached** Drizzle query (a separate inline copy of the query lived in the API route).

So every create/update/toggle = server action mutation + `revalidatePath` + `invalidateTag` + extra `/api/fee-item-types` fetch + DB query + toast render.

**Subscriber mismatch (corrected):** `CACHE_TAGS.FEE_ITEM_TYPES` was documented as subscribed only by `getAllFeeItemTypes` in `fee-templates.queries.ts` — NOT by `getAllFeeItemTypesAdmin` (which the fee-item-types page calls and which was uncached entirely). The `invalidateTag` call in the actions was effectively a no-op for the page that triggered the mutation.

**Fix:**

- Wrapped `getAllFeeItemTypesAdmin` in `unstable_cache(..., { revalidate: 300, tags: [CACHE_TAGS.FEE_ITEM_TYPES] })` so it's now a real subscriber.
- Replaced the inline Drizzle query in `src/app/api/fee-item-types/route.ts` with a call to the now-cached `getAllFeeItemTypesAdmin`.
- Replaced `queryClient.invalidateQueries` in `use-fee-item-types.ts` and `use-cashier-queue.ts` mutations with `router.refresh()`. The server action's `revalidatePath` + `invalidateTag` + the streamed RSC payload now provide freshness without an extra API round-trip.

### 1.6. `loading.tsx` skeleton flash with no streaming — MEDIUM ⏳ partial

**Pre-fix:** Seven route-level `loading.tsx` files exist; none is paired with internal `<Suspense>` boundaries. Pages do `const data = await ...()` at the top, so the entire route blocks behind the heaviest query. The skeleton sits for the full query duration, then hard-swaps.

**Status:** Caching (1.1) and hydration alignment (1.2) cut the typical query duration enough that the visible skeleton time drops substantially. Splitting each route into shell + Suspense-wrapped data region is captured as a follow-up — the existing `loading.tsx` files remain but now sit on top of a much faster data layer.

### 1.7. Sequential await waterfall on students directory — LOW (resolved indirectly)

`students-directory-page.tsx` does `await fetchActiveSchoolYearId()` (which now hits the cache) then a `redirect`. Subsequent renders only do `await fetchStudentDirectoryPage()` (also cached). Net impact disappeared with 1.1.

---

## 2. Ruled out by direct inspection

- `src/components/providers/QueryProvider.tsx` — `QueryClientProvider` is correctly client-side and devtools is dev-only.
- `src/lib/query/query-client.ts` — defaults (`staleTime: 60s`, `gcTime: 5min`, `retry: 1`, `refetchOnWindowFocus: false`) are sensible.
- `src/lib/cache/cache-tags.ts` — tag registry is clean; `invalidateTag` uses Next 16 `'max'` profile.
- `unstable_cache` is **not** wrapping any session-dependent function — no cross-user leakage risk.
- No other route exports `force-dynamic`.

---

## 3. Patterns to follow going forward

### 3.1. When to wrap with `unstable_cache`

Wrap any server-only query that:

- runs from a server component or RSC page (not directly inside `requireSession`-derived contexts that vary per user),
- returns data shared across users,
- has a tag in `CACHE_TAGS` whose mutation actions reliably call `invalidateTag(...)`.

Do NOT wrap:

- queries that close over the current session/user (those must stay per-request),
- queries whose freshness depends on real-time external state with no clear invalidation path.

### 3.2. SSR hydration with TanStack Query — key normalization is load-bearing

When you call `queryClient.prefetchQuery` on the server and consume the result with `useQuery` on the client:

- normalize the key shape (especially empty strings, `null`, `undefined`) identically on both sides,
- prefer `undefined` (TanStack's idiom) over `null`,
- co-locate the normalization in one shared util when reasonable.

A misaligned key silently throws the SSR work away and the client refetches.

### 3.3. Mutation flow

- Server action: `revalidatePath(...)` + `invalidateTag(...)` for any tag the affected query subscribes to.
- Client mutation hook: `router.refresh()` — NOT `queryClient.invalidateQueries(...)` — unless the affected view doesn't go through the App Router (e.g., a pure SPA modal).
- `queryClient.invalidateQueries` is still useful when the same data is also rendered by sibling components that don't get a fresh RSC payload (e.g., in-modal previews). In that case, do both (`router.refresh()` + targeted invalidations) intentionally, not by reflex.

### 3.4. Skeleton flash vs perceived speed

Route-level `loading.tsx` paints during the *entire* server query. Prefer internal `<Suspense fallback={...}>` boundaries inside the page so the layout shell paints first and only the data region shows the skeleton. Reserve route-level `loading.tsx` for routes that have no static shell to render before data.

---

## 4. Files changed by this fix

- `src/lib/cache/cache-tags.ts` — added `STUDENTS` tag, updated subscriber comments.
- `src/features/students/students.queries.ts` — wrapped both query functions in `unstable_cache`.
- `src/features/students/students.actions.ts` — added `invalidateTag(CACHE_TAGS.STUDENTS)` in create + update.
- `src/features/enrollments/enrollments.actions.ts` — added `invalidateTag(CACHE_TAGS.STUDENTS)` in create + status update.
- `src/app/page-templates/students/students-directory-page.tsx` — fixed `null` → `undefined` for prefetch key alignment.
- `src/features/students/hooks/use-students.ts` — raised `staleTime` to 60s.
- `src/features/finance/fee-item-types/fee-item-types.queries.ts` — wrapped `getAllFeeItemTypesAdmin` in `unstable_cache`.
- `src/app/api/fee-item-types/route.ts` — now reuses the cached query.
- `src/features/finance/fee-item-types/hooks/use-fee-item-types.ts` — mutations use `router.refresh()`.
- `src/features/payments/hooks/use-cashier-queue.ts` — mutations use `router.refresh()`; poll relaxed to 60s, focused-only.
- `src/app/admin/dashboard/page.tsx` — removed `dynamic = "force-dynamic"`.

---

## 5. Verification checklist

- `npm run lint && npm run test && npm run build` should pass.
- Dev server walk-through:
  - `/staff/students` — Postgres logs show the directory queries fire on first hit, then go quiet for 60s; React Query Devtools shows the `students.list(...)` entry as `fresh` and `isFetching: false` immediately on first paint (no `/api/students` request in the Network panel on mount).
  - `/admin/dashboard` — the 6 aggregate queries fire once per 60s window, not per request.
  - `/staff/finance/fee-item-types` — create/toggle a row: Network shows only the action POST + an RSC stream, NOT a follow-up `/api/fee-item-types` GET.
  - `/staff/payments` — open in a background tab; no 30s polling traffic should appear in DevTools Network until focus returns.
