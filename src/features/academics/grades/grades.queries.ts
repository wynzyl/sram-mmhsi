import "server-only";

import { db } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { teacherAssignments, schoolYears, subjects, sections } from "@/lib/db/schema";

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * Teacher assignment row for the grades dashboard
 */
export type TeacherAssignmentCard = {
  id: string;
  subject: {
    name: string | null;
    code: string | null;
  };
  section: {
    name: string | null;
  };
};

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get active school year
 */
export async function getActiveSchoolYear(): Promise<{
  id: string;
  label: string;
} | null> {
  const activeSY = await db.query.schoolYears.findFirst({
    where: eq(schoolYears.isActive, true),
    columns: { id: true, label: true },
  });

  return activeSY ?? null;
}

/**
 * Get teacher assignments for the current user in a school year
 */
export async function getTeacherAssignments(
  teacherId: string,
  schoolYearId: string
): Promise<TeacherAssignmentCard[]> {
  const rows = await db
    .select({
      id: teacherAssignments.id,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      sectionName: sections.name,
    })
    .from(teacherAssignments)
    .leftJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .leftJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .where(
      and(
        eq(teacherAssignments.teacherId, teacherId),
        eq(teacherAssignments.schoolYearId, schoolYearId),
        isNull(teacherAssignments.deletedAt),
        isNull(subjects.deletedAt)
      )
    );

  return rows.map((row) => ({
    id: row.id,
    subject: {
      name: row.subjectName,
      code: row.subjectCode,
    },
    section: {
      name: row.sectionName,
    },
  }));
}
