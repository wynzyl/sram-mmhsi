# ADR 0001 — Verification of caching/revalidation TTL behavior and page responsiveness

- Date: 2026-05-22
- Status: **Accepted** (with open items — see §5)
- Scope: SRAMS — fulfills item 16 ("Caching and revalidation tags placements") of
  `docs/DATABASE-OPTIMIZATION/DATABASE-AUDIT.md`.
- Related: `docs/CACHING-REVALIDATION.md`; commits `c2dc90a`, `fd9b5fc`, `ac8f19a`.

---

## 1. Context

Three commits landed a caching audit and a responsiveness regression fix:

- `ac8f19a` — wrapped 7 server queries in `unstable_cache`, added route-level
  `loading.tsx` skeletons.
- `fd9b5fc` — added `DISCOUNT_TYPES` cache + pruned 9 dead cache tags.
- `c2dc90a` — fixed a regression where the changes above *slowed* the students
  directory: an SSR/client hydration key mismatch (`null` vs `undefined`) made
  the client refetch `/api/students` on every mount, and uncached queries in
  `students.queries.ts` re-ran on every navigation.

`docs/CACHING-REVALIDATION.md` documents the fixes but no formal verification
was recorded against the audit checklist. This ADR captures one.

## 2. Decisions under verification

The patterns in `docs/CACHING-REVALIDATION.md` §3:

1. Server-only, cross-user queries are wrapped in `unstable_cache(..., { revalidate, tags })`.
2. SSR prefetch keys are normalized identically to client `useQuery` keys (no `null`/`undefined` drift).
3. Mutations refresh via `router.refresh()` and **not** `queryClient.invalidateQueries()`.
4. Cache tags only exist when there is a real `unstable_cache` subscriber.
5. Cashier-queue background poll is 60s, foreground-only.

## 3. Method

- **Phase A — static / automated.** `npm run test` (29/29 pass, includes
  `hydration-key-alignment.test.ts`). `npm run build` (compiled OK,
  49/49 static pages). Cross-checked every `unstable_cache` declaration against
  the TTL/tag table in `docs/CACHING-REVALIDATION.md` §4.
- **Phase B — live dev-server walkthrough.** `npm run dev`, signed in as
  super-admin, drove Chromium via `gstack` through `/admin/dashboard`,
  `/staff/students`, `/staff/finance/fee-item-types`, `/staff/finance/discount-types`,
  and `/staff/payments`. Used Next.js dev-server timing lines + browser network
  panel as evidence.

## 4. Verification matrix

| # | Behavior under test | Result | Evidence |
|---|---|---|---|
| V1 | `fetchStudentDirectoryPage` 60s TTL on `/staff/students` | **PASS** | Dev-log `application-code` time: 338 ms (cold) → 98–112 ms across 12 reloads (5 DB queries deduped). Next.js timings, file `bn72lb7gy.output` lines 27–39. |
| V2 | SSR hydration key alignment — no `/api/students` GET on mount | **PASS** | `gstack network` over 6 visits to `/staff/students`: 0 `/api/students` requests. `hydration-key-alignment.test.ts` (4 cases) green in `npm run test`. |
| V3 | `/admin/dashboard` 60s TTL across 6 aggregates | **PASS** | Dev-log: 220 ms (cold) → 87 ms → 87 ms on consecutive reloads. No `export const dynamic = "force-dynamic"` present in `src/app/admin/dashboard/page.tsx`. |
| V4 | Fee-item-types mutation flow — action POST only, no `/api/fee-item-types` GET | **PASS** | 12 toggle actions captured: 12 × `POST /staff/finance/fee-item-types → 200`, **0** `GET /api/fee-item-types`. RSC stream replaces the table. |
| V5 | Cashier-queue poll config | **PASS (static)** | `src/features/payments/hooks/use-cashier-queue.ts:102–104` — `refetchInterval: 60_000`, `refetchIntervalInBackground: false`, `staleTime: 60_000`. Hook is currently only exported (no consumer in this branch); behavior verified via source, not live page. |
| V6 | `STUDENTS` tag invalidation propagates after writes | **PASS (static)** | 4 call sites confirmed: `students.actions.ts:328`, `:575`, `enrollments.actions.ts:317`, `:498`. Tag subscriber documented in `src/lib/cache/cache-tags.ts:52`. Behavioral equivalence demonstrated live by V4 (same mechanism on `FEE_ITEM_TYPES`). |
| V7 | `DISCOUNT_TYPES` 1 h TTL on `/staff/finance/discount-types` | **PASS** | Dev-log: 419 ms (cold) → 134 ms → 100 ms → 81 ms on consecutive reloads. `application-code` drops 80 %. |
| V8 | `npm run lint && test && build` | **PARTIAL** | `test` PASS (29/29), `build` PASS (49/49). `lint` has 39 pre-existing errors unrelated to caching (`react-hooks/set-state-in-effect` in `StudentForm.tsx:63`, `StudentRegistrationForm.tsx:93`, etc., plus unused imports). Not blocking this ADR, tracked as an open item. |

## 5. Open items

These are real but out of scope for this verification — fixes go through follow-up tasks.

1. **Lint debt** — 39 errors, 36 warnings, predominantly `set-state-in-effect`
   patterns in form components and dead `useEffect`/`buttonVariants` imports.
   Not caching-related but blocks a clean CI signal.

2. **Page-level route caching gap on `/staff/payments`.** The page is a server
   component fetching directly via Drizzle without an `unstable_cache` wrapper.
   Each navigation costs ~120 ms in `application-code` even when nothing
   changed. Either wrap the underlying queries (preferred) or split the route
   into a static shell + `<Suspense>`-wrapped data region (per the partial fix
   called out in `CACHING-REVALIDATION.md` §1.6).

3. **`enrollments-queue.queries.ts:902` uses a string literal `'enrollments'`
   instead of `CACHE_TAGS.ENROLLMENTS`.** Behaviorally identical today, but
   defeats the centralized-tag convention. Trivial 1-line fix.

4. **`useCashierQueue` is exported but unused** on this branch (no consumer in
   `src/features/payments/**` or `src/app/staff/payments/**`). Either wire it
   into `/staff/payments` (the original intent) or remove the hook to avoid the
   dead-code drift that the doc warns against in §3.

5. **Route-level `loading.tsx` skeletons still block on heaviest query** — the
   follow-up to split each route into shell + `<Suspense>` boundaries (per
   `CACHING-REVALIDATION.md` §1.6 — explicitly tagged "partial").

## 6. References

- Plan file: `~/.claude/plans/c-users-wynzy-downloads-sram-mmhsi-docs-glimmering-tulip.md`
- `docs/CACHING-REVALIDATION.md` — fix narrative and §4 file-changes list.
- `docs/DATABASE-OPTIMIZATION/DATABASE-AUDIT.md` — audit prompt (item 16).
- `src/lib/cache/cache-tags.ts` — central tag registry.
- `src/features/students/__tests__/hydration-key-alignment.test.ts` — V2 regression test.
- Commits `ac8f19a`, `fd9b5fc`, `c2dc90a`.
