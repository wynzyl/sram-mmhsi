import {
  revalidateTag as nextRevalidateTag,
  updateTag as nextUpdateTag,
} from "next/cache";

/**
 * Centralized cache tag definitions for consistent tag-based revalidation.
 *
 * CACHING STRATEGY (per CACHING-FIX-PLAN.md):
 * - Use `forceUpdateTag()` for read-your-own-writes (enrollments, assessments, payments)
 * - Use `invalidateTag()` for dashboard summaries (stale-while-revalidate)
 * - Do NOT cache transaction-heavy pages aggressively
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/revalidateTag
 * @see https://nextjs.org/docs/app/api-reference/functions/updateTag
 */
/**
 * Only add a tag here once a query uses `'use cache'` directive with
 * `cacheTag(TAG)`. Tags with no subscriber are no-ops at runtime but tempt
 * callers into pile-on invalidation in action handlers.
 *
 * Subscribers (kept in sync manually):
 * - DASHBOARD       -> src/lib/queries/admin-dashboard.ts (getAdminDashboardMetrics)
 * - ENROLLMENTS     -> src/features/enrollments/enrollments-queue.queries.ts (getEnrollmentQueueCounts)
 * - SCHOOL_YEARS    -> src/lib/queries/schoolYears.ts (getSchoolYears)
 * - GRADE_LEVELS    -> src/lib/queries/gradeLevels.ts (getGradeLevels)
 * - FEE_TEMPLATES   -> src/features/finance/fee-templates/fee-templates.queries.ts (getFeeTemplatesForDropdown)
 * - FEE_ITEM_TYPES  -> src/features/finance/fee-templates/fee-templates.queries.ts (getAllFeeItemTypes)
 * - DISCOUNT_TYPES  -> src/features/discounts/discounts.queries.ts (getActiveDiscountTypes, getAllDiscountTypes)
 * - DOCUMENT_REQUESTS -> src/features/documents/document-requests.queries.ts (getDocumentRequestById, getDocumentRequestsSummary)
 * - CURRICULUMS     -> src/features/academics/curriculums/curriculums.queries.ts (listCurriculums, getCurriculumById, getPublishedCurriculumsForDropdown)
 * - CURRICULUM_ADOPTIONS -> src/features/academics/curriculums/curriculums.queries.ts (getAdoptionMatrix)
 * - SECTIONS        -> src/features/academics/sections/sections.queries.ts (getAllSections, getSectionById, etc.)
 * - STRANDS         -> src/features/academics/strands/strands.queries.ts (getActiveStrands, getAllStrands)
 * - SUBJECT_OFFERINGS -> src/features/academics/subject-offerings/subject-offerings.queries.ts (getSubjectOfferingsForSection)
 * - STUDENT_SUBJECT_ENROLLMENTS -> src/features/academics/student-subject-enrollments/student-subject-enrollments.queries.ts (getStudentSubjectEnrollments)
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

  /** Document requests (transactional — use forceUpdateTag for read-your-own-writes) */
  DOCUMENT_REQUESTS: "document-requests",

  /** Curriculum definitions and versions */
  CURRICULUMS: "curriculums",

  /** Curriculum adoptions (school year + grade level bindings) */
  CURRICULUM_ADOPTIONS: "curriculum-adoptions",

  /** Sections (classroom sections per grade level per school year) */
  SECTIONS: "sections",

  /** SHS academic strands (STEM, ABM, HUMSS, GAS, TVL-*) */
  STRANDS: "strands",

  /** Subject offerings (section + subject + school year operational layer) */
  SUBJECT_OFFERINGS: "subject-offerings",

  /** Student subject enrollments (student-subject enrollment records) */
  STUDENT_SUBJECT_ENROLLMENTS: "student-subject-enrollments",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Helper to get multiple tags as an array.
 *
 * @example
 * getCacheTags('DASHBOARD', 'PAYMENTS')
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
 * Invalidate multiple cache tags at once (stale-while-revalidate).
 *
 * @example
 * invalidateTags(CACHE_TAGS.DASHBOARD, CACHE_TAGS.ENROLLMENTS)
 */
export function invalidateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    nextRevalidateTag(tag, "max");
  }
}

/**
 * Force immediate cache invalidation for read-your-own-writes scenarios.
 *
 * Uses Next.js 16's `updateTag()` which is a BLOCKING operation that
 * expires the cache entry instantly. The very next render will see fresh data.
 *
 * USE THIS FOR:
 * - Enrollment status changes (pending → assessed → enrolled)
 * - Assessment mutations (create, cancel)
 * - Payment posting
 * - Discount application
 *
 * DO NOT USE FOR:
 * - Dashboard summaries (use invalidateTag instead)
 * - Reference data (fee schedules, grade levels)
 *
 * @example
 * // After cancelling assessment, enrollment status changes
 * forceUpdateTag(CACHE_TAGS.ENROLLMENTS);
 */
export function forceUpdateTag(tag: CacheTag): void {
  nextUpdateTag(tag);
}

/**
 * Force immediate cache invalidation for multiple tags.
 *
 * @example
 * forceUpdateTags(CACHE_TAGS.ENROLLMENTS, CACHE_TAGS.DASHBOARD);
 */
export function forceUpdateTags(...tags: CacheTag[]): void {
  for (const tag of tags) {
    nextUpdateTag(tag);
  }
}
