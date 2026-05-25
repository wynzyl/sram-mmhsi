# Caching Migration Report: `unstable_cache` → `use cache`

**Date:** 2026-05-25
**Next.js Version:** 16.2.6
**Status:** Complete

---

## Executive Summary

Successfully migrated all 6 query files from the deprecated `unstable_cache()` API to Next.js 16's stable `use cache` directive with `cacheLife()` and `cacheTag()` functions. The build now uses Partial Prerendering (PPR) as the default behavior with Cache Components enabled.

---

## Migration Overview

### Before (unstable_cache pattern)
```typescript
import { unstable_cache } from "next/cache";

async function _getData() {
  return db.query.table.findMany();
}

export const getData = unstable_cache(
  _getData,
  ['cache-key'],
  { revalidate: 3600, tags: ['my-tag'] }
);
```

### After (use cache pattern)
```typescript
import { cacheLife, cacheTag } from "next/cache";

export async function getData() {
  'use cache'
  cacheTag('my-tag')
  cacheLife('hours')

  return db.query.table.findMany();
}
```

---

## Files Modified

### 1. Configuration: `next.config.ts`

Added custom `cacheLife` profile for fee-templates (10-minute cache):

```typescript
const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    "fee-templates": {
      stale: 300,      // 5 minutes client cache
      revalidate: 600, // 10 minutes server revalidate
      expire: 3600,    // 1 hour max
    },
  },
};
```

### 2. Query Files Migrated

| File | Previous Duration | New Profile | Tags |
|------|-------------------|-------------|------|
| `src/lib/queries/schoolYears.ts` | 3600s (1hr) | `'hours'` | `SCHOOL_YEARS` |
| `src/lib/queries/gradeLevels.ts` | 3600s (1hr) | `'hours'` | `GRADE_LEVELS` |
| `src/lib/queries/admin-dashboard.ts` | 60s | `'minutes'` | `DASHBOARD` |
| `src/features/discounts/discounts.queries.ts` | 3600s (1hr) | `'hours'` | `DISCOUNT_TYPES` |
| `src/features/finance/fee-templates/fee-templates.queries.ts` | 600s (10min) | `'fee-templates'` (custom) | `FEE_TEMPLATES`, `FEE_ITEM_TYPES` |
| `src/features/enrollments/enrollments-queue.queries.ts` | 60s | `'minutes'` | `ENROLLMENTS` |

### 3. Cache Life Preset Profiles Used

| Profile | Stale | Revalidate | Expire | Use Case |
|---------|-------|------------|--------|----------|
| `'minutes'` | 5min | 1min | 1hr | Dashboard metrics, enrollment counts |
| `'hours'` | 5min | 1hr | 1day | Reference data (school years, grade levels, discount types) |
| `'fee-templates'` (custom) | 5min | 10min | 1hr | Fee templates and item types |

### 4. Action Files Updated

**`src/features/discounts/discounts.actions.ts`**

Added missing cache invalidation calls:

```typescript
// In bulkApproveDiscountsAction (line ~735)
invalidateTag(CACHE_TAGS.ENROLLMENTS);

// In cancelDiscountRequestAction (line ~838)
invalidateTag(CACHE_TAGS.ENROLLMENTS);
```

### 5. Layout Updates for Partial Prerendering

Authenticated layouts now wrap content in `<Suspense>` to support PPR:

- `src/app/admin/layout.tsx`
- `src/app/staff/layout.tsx`
- `src/app/portal/layout.tsx`

Pattern used:
```typescript
async function LayoutContent({ children }) {
  const session = await requireSession();
  // ... auth checks
  return <div>{children}</div>;
}

export default function Layout({ children }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <LayoutContent>{children}</LayoutContent>
    </Suspense>
  );
}
```

### 6. API Routes Updated

Added `await connection()` to exclude from prerendering:

- `src/app/api/cashier/queue/route.ts`
- `src/app/api/fee-item-types/route.ts`
- `src/app/api/students/route.ts`

```typescript
import { connection } from "next/server";

export async function GET() {
  await connection(); // Requires auth - exclude from prerendering
  // ...
}
```

### 7. Removed Deprecated Exports

Removed `export const dynamic = "force-dynamic"` from:
- `src/app/admin/dashboard/page.tsx`
- `src/app/staff/students/page.tsx`

This export is not compatible with `cacheComponents: true`.

### 8. Documentation Updated

**`src/lib/cache/cache-tags.ts`**

Updated comments to reference `'use cache'` instead of `unstable_cache`.

---

## Cache Invalidation System

The existing invalidation system in `cache-tags.ts` remains unchanged and is already compatible with Next.js 16:

```typescript
// Stale-while-revalidate (for dashboards, summaries)
export function invalidateTag(tag: CacheTag): void {
  nextRevalidateTag(tag, "max");
}

// Immediate invalidation (for read-your-own-writes)
export function forceUpdateTag(tag: CacheTag): void {
  nextUpdateTag(tag);
}
```

---

## Build Output

```
Route (app)                                 Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ◐ /admin/dashboard                                1m      1h
├ ◐ /admin/users
├ ◐ /staff/dashboard
├ ◐ /staff/enrollments
├ ◐ /staff/finance
├ ƒ /api/cashier/queue
├ ƒ /api/students
└ ... (62 total routes)

○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
```

---

## Verification Checklist

- [x] `npm run build` passes without errors
- [x] All 25 unit tests pass
- [x] Dashboard metrics show with `1m` revalidation in build output
- [x] School years/grade levels use `hours` profile
- [x] Fee templates use custom `fee-templates` profile
- [x] Enrollment queue counts use `minutes` profile
- [x] Authenticated layouts use Suspense boundaries
- [x] API routes using cookies have `connection()` calls
- [x] Cache invalidation calls present in all relevant actions

---

## Benefits of Migration

1. **Stable API** - `use cache` is the official stable API in Next.js 16
2. **Semantic Profiles** - `'hours'`, `'minutes'` are clearer than `3600`, `60`
3. **Simpler Syntax** - No wrapper function, directive-based
4. **Better DX** - Clear intent at top of function
5. **Partial Prerendering** - Static shell with dynamic streaming
6. **Future-proof** - `unstable_cache` may be removed in future versions

---

## React `cache()` - No Changes

Two files use React's `cache()` for request-level memoization:
- `src/lib/queries/schoolYears.ts` - `getActiveSchoolYear()`
- `src/lib/queries/gradeLevels.ts` - `getGradeLevelsMap()`

These were intentionally **not migrated** because they serve a different purpose: they deduplicate database calls within a single request, not across requests. Using `use cache` would change their behavior.

---

## Rollback Plan

If issues arise, `unstable_cache` is still supported in Next.js 16 (deprecated but not removed). Both patterns can coexist during a gradual migration.

---

## References

- [Next.js Caching Guide](https://nextjs.org/docs/app/getting-started/caching)
- [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components)
- [use cache Directive](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [cacheLife Function](https://nextjs.org/docs/app/api-reference/functions/cacheLife)
- [connection Function](https://nextjs.org/docs/app/api-reference/functions/connection)
