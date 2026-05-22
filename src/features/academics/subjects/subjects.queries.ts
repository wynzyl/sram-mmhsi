import "server-only";

import { db } from "@/lib/db";
import { eq, isNull, asc } from "drizzle-orm";
import { subjects, gradeLevels } from "@/lib/db/schema";

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * Subject row for the management table
 */
export type SubjectListRow = {
  id: string;
  name: string;
  code: string;
  gradeLevel: {
    name: string | null;
  };
  createdAt: Date;
};

/**
 * Grade level option for dropdowns
 */
export type GradeLevelDropdownOption = {
  id: string;
  name: string;
};

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get all grade levels for dropdown selection
 */
export async function getGradeLevelsForDropdown(): Promise<
  GradeLevelDropdownOption[]
> {
  const rows = await db.query.gradeLevels.findMany({
    columns: { id: true, name: true },
    orderBy: (gl, { asc }) => [asc(gl.order)],
  });

  return rows;
}

/**
 * Get all subjects with grade level info for the management table
 */
export async function getSubjectsList(): Promise<SubjectListRow[]> {
  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      gradeLevelName: gradeLevels.name,
      createdAt: subjects.createdAt,
    })
    .from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(isNull(subjects.deletedAt))
    .orderBy(asc(subjects.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code,
    gradeLevel: {
      name: row.gradeLevelName,
    },
    createdAt: row.createdAt,
  }));
}
