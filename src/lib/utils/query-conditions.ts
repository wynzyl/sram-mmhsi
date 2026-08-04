import "server-only";
import { or, ilike, type SQL } from "drizzle-orm";
import { students } from "@/lib/db/schema";

/**
 * Build ILIKE search condition for student name and reference number.
 * Returns undefined if search term is empty/blank.
 *
 * @param search - Search term (will be trimmed)
 * @returns Drizzle OR condition or undefined
 *
 * @example
 * ```typescript
 * const searchWhere = buildStudentSearchCondition(params.search);
 * await db.select().from(students).where(and(otherConditions, searchWhere));
 * ```
 */
export function buildStudentSearchCondition(
  search: string | undefined
): SQL | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  const pattern = `%${term}%`;
  return or(
    ilike(students.firstName, pattern),
    ilike(students.lastName, pattern),
    ilike(students.referenceNumber, pattern)
  );
}
