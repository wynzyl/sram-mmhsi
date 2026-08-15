import "server-only";

/**
 * Adviser Grade Entry Queries
 *
 * Queries for adviser-based grade entry:
 * - Adviser sections
 * - Students in section
 * - Subjects for grade level
 * - Section details
 */

import { db } from "@/lib/db";
import { eq, and, asc, isNull, sql } from "drizzle-orm";
import {
  sectionAdvisers,
  sections,
  gradeLevels,
  schoolYears,
  enrollments,
  students,
  subjects,
  curriculumAdoptions,
} from "@/lib/db/schema";

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Adviser section card for the grades dashboard
 */
export type AdviserSectionCard = {
  id: string;
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  schoolYearId: string;
  schoolYearLabel: string;
};

/**
 * Student in section for grade entry grid
 */
export type SectionStudent = {
  id: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

/**
 * Subject for grade entry grid
 */
export type GradeLevelSubject = {
  id: string;
  name: string;
  code: string;
  sequenceOrder: number;
};

// ─── Adviser Section Queries ─────────────────────────────────────────────────

/**
 * Get sections where the user is an adviser for a school year.
 */
export async function getAdviserSections(
  userId: string,
  schoolYearId: string
): Promise<AdviserSectionCard[]> {
  const rows = await db
    .select({
      id: sectionAdvisers.id,
      sectionId: sectionAdvisers.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: sectionAdvisers.schoolYearId,
      schoolYearLabel: schoolYears.label,
    })
    .from(sectionAdvisers)
    .innerJoin(sections, eq(sectionAdvisers.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sectionAdvisers.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(sectionAdvisers.userId, userId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt),
        isNull(sections.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows;
}

/**
 * Verify user is an adviser for a section.
 */
export async function isAdviserForSection(
  userId: string,
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  const adviser = await db.query.sectionAdvisers.findFirst({
    where: and(
      eq(sectionAdvisers.userId, userId),
      eq(sectionAdvisers.sectionId, sectionId),
      eq(sectionAdvisers.schoolYearId, schoolYearId),
      isNull(sectionAdvisers.deletedAt)
    ),
    columns: { id: true },
  });

  return !!adviser;
}

/**
 * Check if a section has ANY adviser assigned for a school year.
 * Used to gate grade entry - no adviser means no grade entry allowed.
 */
export async function sectionHasAdviser(
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  const adviser = await db.query.sectionAdvisers.findFirst({
    where: and(
      eq(sectionAdvisers.sectionId, sectionId),
      eq(sectionAdvisers.schoolYearId, schoolYearId),
      isNull(sectionAdvisers.deletedAt)
    ),
    columns: { id: true },
  });
  return !!adviser;
}

// ─── Section Details Queries ─────────────────────────────────────────────────

/**
 * Get section details including grade level info.
 */
export async function getSectionDetails(sectionId: string): Promise<{
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
} | null> {
  const [row] = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      schoolYearId: sections.schoolYearId,
      schoolYearLabel: schoolYears.label,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
    .where(and(eq(sections.id, sectionId), isNull(sections.deletedAt)))
    .limit(1);

  return row ?? null;
}

/**
 * Get all sections for the teacher assignment form dropdown.
 */
export async function getSectionsForAssignment(schoolYearId: string): Promise<
  { id: string; name: string; gradeLevelId: string; gradeLevelName: string }[]
> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(
      and(eq(sections.schoolYearId, schoolYearId), isNull(sections.deletedAt))
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows;
}

// ─── Students in Section ─────────────────────────────────────────────────────

/**
 * Get enrolled students in a section for a school year.
 */
export async function getStudentsInSection(
  sectionId: string,
  schoolYearId: string
): Promise<SectionStudent[]> {
  const rows = await db
    .select({
      id: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      fullName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return rows;
}

// ─── Subjects for Grade Level ────────────────────────────────────────────────

/**
 * Get subjects for a grade level from the active curriculum for a school year.
 */
export async function getSubjectsForGradeLevel(
  gradeLevelId: string,
  schoolYearId: string
): Promise<GradeLevelSubject[]> {
  // Find the active curriculum adoption for this school year AND grade level
  const adoption = await db.query.curriculumAdoptions.findFirst({
    where: and(
      eq(curriculumAdoptions.schoolYearId, schoolYearId),
      eq(curriculumAdoptions.gradeLevelId, gradeLevelId),
      isNull(curriculumAdoptions.deletedAt)
    ),
    columns: { curriculumId: true },
  });

  if (!adoption) {
    return [];
  }

  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      sequenceOrder: subjects.sequenceOrder,
    })
    .from(subjects)
    .where(
      and(
        eq(subjects.curriculumId, adoption.curriculumId),
        eq(subjects.gradeLevelId, gradeLevelId),
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(asc(subjects.sequenceOrder), asc(subjects.name));

  return rows;
}

/**
 * Get all active subjects for the teacher assignment form dropdown.
 * Filters by curriculum adoptions for the specified school year.
 */
export async function getSubjectsForAssignment(schoolYearId: string): Promise<
  { id: string; name: string; code: string; gradeLevelId: string; gradeLevelName: string }[]
> {
  // Get curriculum adoptions for the school year
  const adoptions = await db
    .select({
      curriculumId: curriculumAdoptions.curriculumId,
      gradeLevelId: curriculumAdoptions.gradeLevelId,
    })
    .from(curriculumAdoptions)
    .where(
      and(
        eq(curriculumAdoptions.schoolYearId, schoolYearId),
        isNull(curriculumAdoptions.deletedAt)
      )
    );

  if (adoptions.length === 0) {
    return [];
  }

  // Build conditions for subjects: curriculum + grade level must match adoption
  const adoptionConditions = adoptions.map(
    (a) =>
      and(
        eq(subjects.curriculumId, a.curriculumId),
        eq(subjects.gradeLevelId, a.gradeLevelId)
      )
  );

  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      gradeLevelId: subjects.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
    })
    .from(subjects)
    .innerJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(
      and(
        isNull(subjects.deletedAt),
        sql`(${sql.join(adoptionConditions, sql` OR `)})`
      )
    )
    .orderBy(asc(gradeLevels.order), asc(subjects.name));

  return rows as { id: string; name: string; code: string; gradeLevelId: string; gradeLevelName: string }[];
}
