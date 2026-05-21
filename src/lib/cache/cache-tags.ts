import { revalidateTag as nextRevalidateTag } from "next/cache";

/**
 * Centralized cache tag definitions for consistent tag-based revalidation.
 *
 * Usage:
 * - In queries with unstable_cache: tags: [CACHE_TAGS.DASHBOARD, CACHE_TAGS.PAYMENTS]
 * - In actions after mutations: invalidateTag(CACHE_TAGS.PAYMENTS)
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/revalidateTag
 */
export const CACHE_TAGS = {
  /** Admin/Staff dashboard metrics */
  DASHBOARD: "dashboard",

  /** Enrollment records and queue */
  ENROLLMENTS: "enrollments",

  /** Payment records (NEVER cache payment data, only use for invalidation) */
  PAYMENTS: "payments",

  /** Assessment records and ledgers */
  ASSESSMENTS: "assessments",

  /** Student records and directory */
  STUDENTS: "students",

  /** School year configuration */
  SCHOOL_YEARS: "school-years",

  /** Fee schedule definitions */
  FEE_SCHEDULES: "fee-schedules",

  /** Fee template definitions */
  FEE_TEMPLATES: "fee-templates",

  /** Receipt booklet records */
  BOOKLETS: "booklets",

  /** Grade level configuration */
  GRADE_LEVELS: "grade-levels",

  /** Section configuration */
  SECTIONS: "sections",

  /** Invoice records */
  INVOICES: "invoices",

  /** Registration records */
  REGISTRATIONS: "registrations",

  /** Grade/academic records */
  GRADES: "grades",
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
 * invalidateTag(CACHE_TAGS.PAYMENTS)
 */
export function invalidateTag(tag: CacheTag): void {
  nextRevalidateTag(tag, "max");
}

/**
 * Invalidate multiple cache tags at once.
 *
 * @example
 * invalidateTags(CACHE_TAGS.DASHBOARD, CACHE_TAGS.PAYMENTS, CACHE_TAGS.ENROLLMENTS)
 */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    nextRevalidateTag(tag, "max");
  }
}
