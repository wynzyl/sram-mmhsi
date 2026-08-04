import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { desc, eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";

/**
 * Get all school years with caching.
 * School years rarely change, so 1 hour cache is safe.
 * Invalidated via revalidateTag('school-years') when school years are modified.
 */
export async function getSchoolYears() {
  "use cache";
  cacheTag(CACHE_TAGS.SCHOOL_YEARS);
  cacheLife("hours"); // 1 hour revalidate

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

/**
 * Get only the active school year ID.
 * Uses React cache() for request-level deduplication.
 * Convenience function for operations that only need the ID.
 */
export const getActiveSchoolYearId = cache(async (): Promise<string | null> => {
  const [row] = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(
      and(
        eq(schoolYears.isActive, true),
        isNull(schoolYears.deletedAt)
      )
    )
    .limit(1);

  return row?.id ?? null;
});
