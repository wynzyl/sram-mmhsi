import "server-only";

import { db } from "@/lib/db";
import { eq, isNull, asc, and, count } from "drizzle-orm";
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

/**
 * Get subjects filtered by grade level ID
 */
export async function getSubjectsByGradeLevel(
  gradeLevelId: string
): Promise<SubjectListRow[]> {
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
    .where(
      and(isNull(subjects.deletedAt), eq(subjects.gradeLevelId, gradeLevelId))
    )
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

/**
 * Get total count of active subjects
 */
export async function getTotalSubjectsCount(): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(subjects)
    .where(isNull(subjects.deletedAt));

  return result?.count ?? 0;
}

/**
 * Get count of subjects for a specific grade level
 */
export async function getSubjectsCountByGradeLevel(
  gradeLevelId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(subjects)
    .where(
      and(isNull(subjects.deletedAt), eq(subjects.gradeLevelId, gradeLevelId))
    );

  return result?.count ?? 0;
}
