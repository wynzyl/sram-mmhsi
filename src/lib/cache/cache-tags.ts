import { revalidateTag as nextRevalidateTag } from "next/cache";

/**
 * Centralized cache tag definitions for consistent tag-based revalidation.
 *
 * Usage:
 * - In queries with unstable_cache: tags: [CACHE_TAGS.DASHBOARD]
 * - In actions after mutations: invalidateTag(CACHE_TAGS.DASHBOARD)
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/revalidateTag
 */
/**
 * Only add a tag here once a query is wrapped in `unstable_cache(...)` with
 * that tag. Tags with no subscriber are no-ops at runtime but tempt callers
 * into pile-on invalidation in action handlers (which is what caused the
 * caching/revalidation regression originally fixed in this audit).
 *
 * Subscribers (kept in sync manually):
 * - DASHBOARD       -> src/lib/queries/admin-dashboard.ts (getAdminDashboardMetrics)
 * - ENROLLMENTS     -> src/features/enrollments/enrollments-queue.queries.ts (getEnrollmentQueueCounts)
 * - SCHOOL_YEARS    -> src/lib/queries/schoolYears.ts (getSchoolYears)
 * - GRADE_LEVELS    -> src/lib/queries/gradeLevels.ts (getGradeLevels)
 * - FEE_TEMPLATES   -> src/features/finance/fee-templates/fee-templates.queries.ts (getFeeTemplatesForDropdown)
 * - FEE_ITEM_TYPES  -> src/features/finance/fee-templates/fee-templates.queries.ts (getAllFeeItemTypes)
 * - DISCOUNT_TYPES  -> src/features/discounts/discounts.queries.ts (getActiveDiscountTypes, getAllDiscountTypes)
 */
export const CACHE_TAGS = {
  /** Admin/Staff dashboard metrics */
  DASHBOARD: "dashboard",

  /** Enrollment queue counts (subscribers: getEnrollmentQueueCounts) */
  ENROLLMENTS: "enrollments",

  /** School year configuration */
  SCHOOL_YEARS: "school-years",

  /** Grade level configuration */
  GRADE_LEVELS: "grade-levels",

  /** Fee template definitions and dropdown */
  FEE_TEMPLATES: "fee-templates",

  /** Fee item type definitions (separate from templates) */
  FEE_ITEM_TYPES: "fee-item-types",

  /** Discount type catalog (global config — rarely changes) */
  DISCOUNT_TYPES: "discount-types",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Helper to get multiple tags as an array.
 * Useful for unstable_cache tags parameter.
 *
 * @example
 * tags: getCacheTags('DASHBOARD', 'PAYMENTS')
 */
export function getCacheTags(
  ...tagKeys: (keyof typeof CACHE_TAGS)[]
): CacheTag[] {
  return tagKeys.map((key) => CACHE_TAGS[key]);
}

/**
 * Invalidate a cache tag. This is a wrapper around Next.js revalidateTag
 * that provides the required second argument for Next.js 16+.
 *
 * Uses 'max' profile for stale-while-revalidate behavior.
 *
 * @example
 * invalidateTag(CACHE_TAGS.DASHBOARD)
 * invalidateTag(CACHE_TAGS.ENROLLMENTS)
 */
export function invalidateTag(tag: CacheTag): void {
  nextRevalidateTag(tag, "max");
}

/**
 * Invalidate multiple cache tags at once.
 *
 * @example
 * invalidateTags(CACHE_TAGS.DASHBOARD, CACHE_TAGS.ENROLLMENTS)
 */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    nextRevalidateTag(tag, "max");
  }
}
