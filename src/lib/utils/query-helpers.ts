import "server-only";
import { db } from "@/lib/db";
import { schoolYears } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * Retrieves the currently active school year.
 * Returns null if no school year is active.
 *
 * @returns Active school year record or null
 *
 * @example
 * ```typescript
 * const activeYear = await getActiveSchoolYear();
 * if (!activeYear) {
 *   return { message: "No active school year configured" };
 * }
 * ```
 */
export async function getActiveSchoolYear() {
  const [year] = await db
    .select()
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  return year ?? null;
}

/**
 * Retrieves the ID of the currently active school year.
 * Convenience function for operations that only need the ID.
 *
 * @returns Active school year ID or null
 *
 * @example
 * ```typescript
 * const schoolYearId = await getActiveSchoolYearId();
 * if (!schoolYearId) {
 *   return { message: "No active school year" };
 * }
 *
 * await db.insert(enrollments).values({
 *   schoolYearId,
 *   // ... other fields
 * });
 * ```
 */
export async function getActiveSchoolYearId(): Promise<string | null> {
  const [row] = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  return row?.id ?? null;
}
