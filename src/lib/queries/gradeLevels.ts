import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { gradeLevels } from "@/lib/db/schema";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";

export type GradeLevelOption = {
  id: string;
  name: string;
  order: number;
};

/**
 * Get all grade levels with caching.
 * Grade levels are static configuration, so 1 hour cache is safe.
 * Invalidated via revalidateTag('grade-levels') when grade levels are modified.
 */
export async function getGradeLevels(): Promise<GradeLevelOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.GRADE_LEVELS);
  cacheLife("hours"); // 1 hour revalidate

  return db
    .select({
      id: gradeLevels.id,
      name: gradeLevels.name,
      order: gradeLevels.order,
    })
    .from(gradeLevels)
    .orderBy(gradeLevels.order);
}

/**
 * Get grade levels as a map for quick lookup by ID.
 * Useful when you need to look up grade level names by ID.
 * Uses React cache() for request-level deduplication.
 */
export const getGradeLevelsMap = cache(async (): Promise<Map<string, GradeLevelOption>> => {
  const levels = await getGradeLevels();
  return new Map(levels.map((gl) => [gl.id, gl]));
});
