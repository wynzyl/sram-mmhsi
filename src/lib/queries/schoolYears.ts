import { cache } from "react";
import { desc, eq, and, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";

/**
 * Internal uncached function to fetch school years.
 */
async function _getSchoolYearsUncached() {
  return db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      isActive: schoolYears.isActive,
    })
    .from(schoolYears)
    .orderBy(desc(schoolYears.startDate));
}

/**
 * Get all school years with caching.
 * School years rarely change, so 1 hour cache is safe.
 * Invalidated via revalidateTag('school-years') when school years are modified.
 */
export const getSchoolYears = unstable_cache(
  _getSchoolYearsUncached,
  ["school-years-list"],
  {
    revalidate: 3600, // 1 hour
    tags: [CACHE_TAGS.SCHOOL_YEARS],
  }
);

/**
 * Get the active school year.
 * Uses React cache() for request-level deduplication.
 */
export const getActiveSchoolYear = cache(async () => {
  const [active] = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      startDate: schoolYears.startDate,
      endDate: schoolYears.endDate,
    })
    .from(schoolYears)
    .where(
      and(
        eq(schoolYears.isActive, true),
        isNull(schoolYears.deletedAt)
      )
    )
    .limit(1);

  return active ?? null;
});
