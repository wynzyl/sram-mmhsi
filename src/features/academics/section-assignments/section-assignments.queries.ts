import "server-only";
import { db } from "@/lib/db";
import {
  enrollments,
  students,
  sections,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, inArray } from "drizzle-orm";
import type {
  StudentForSectionAssignment,
  SectionWithCount,
  SectionOption,
  SectionAssignmentFilters,
} from "./section-assignments.schema";

// ─── Get Students for Section Assignment ──────────────────────────────────────

/**
 * Get enrolled students with optional filters for section assignment.
 * Returns students with "enrolled" or "assessed" status (eligible for section assignment).
 * Ordered by grade level, then last name, then first name.
 */
export async function getStudentsForSectionAssignment(
  filters: SectionAssignmentFilters
): Promise<StudentForSectionAssignment[]> {
  const { schoolYearId, gradeLevelId, sectionStatus } = filters;

  // Build where conditions
  const conditions = [
    eq(enrollments.schoolYearId, schoolYearId),
    inArray(enrollments.status, ["enrolled", "assessed"]),
    isNull(students.deletedAt),
  ];

  // Filter by grade level if specified
  if (gradeLevelId) {
    conditions.push(eq(enrollments.gradeLevelId, gradeLevelId));
  }

  // Filter by section status
  if (sectionStatus === "unassigned") {
    conditions.push(isNull(enrollments.sectionId));
  } else if (sectionStatus && sectionStatus !== "all") {
    // Specific section ID
    conditions.push(eq(enrollments.sectionId, sectionStatus));
  }

  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      gradeLevelId: enrollments.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      sectionId: enrollments.sectionId,
      sectionName: sections.name,
      enrollmentStatus: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(and(...conditions))
    .orderBy(
      asc(gradeLevels.order),
      asc(students.lastName),
      asc(students.firstName)
    );

  return rows;
}

// ─── Get Sections with Student Counts ─────────────────────────────────────────

/**
 * Get all sections for a school year with enrolled student counts.
 * Useful for displaying section capacity/distribution.
 */
export async function getSectionsWithCounts(
  schoolYearId: string,
  gradeLevelId?: string
): Promise<SectionWithCount[]> {
  const conditions = [
    eq(sections.schoolYearId, schoolYearId),
    isNull(sections.deletedAt),
  ];

  if (gradeLevelId) {
    conditions.push(eq(sections.gradeLevelId, gradeLevelId));
  }

  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      studentCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${enrollments}
        WHERE ${enrollments.sectionId} = ${sections.id}
          AND ${enrollments.status} IN ('enrolled', 'assessed')
      )`.mapWith(Number),
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(and(...conditions))
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows;
}

// ─── Get Available Sections for Grade Level ───────────────────────────────────

/**
 * Get sections available for assignment within a specific grade level.
 * Returns simple list for dropdown selection with student counts.
 */
export async function getAvailableSections(
  schoolYearId: string,
  gradeLevelId: string
): Promise<SectionOption[]> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      studentCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${enrollments}
        WHERE ${enrollments.sectionId} = ${sections.id}
          AND ${enrollments.status} IN ('enrolled', 'assessed')
      )`.mapWith(Number),
    })
    .from(sections)
    .where(
      and(
        eq(sections.schoolYearId, schoolYearId),
        eq(sections.gradeLevelId, gradeLevelId),
        isNull(sections.deletedAt)
      )
    )
    .orderBy(asc(sections.name));

  return rows;
}

// ─── Get Enrollment Grade Level ───────────────────────────────────────────────

/**
 * Get the grade level + school year for a set of enrollments.
 * Used to validate that all selected enrollments are in the same grade level AND
 * the same school year before assigning them to a section.
 * Returns null if the enrollments span more than one grade level or school year.
 */
export async function getEnrollmentGradeLevels(
  enrollmentIds: string[]
): Promise<{ gradeLevelId: string; schoolYearId: string } | null> {
  if (enrollmentIds.length === 0) return null;

  const rows = await db
    .selectDistinct({
      gradeLevelId: enrollments.gradeLevelId,
      schoolYearId: enrollments.schoolYearId,
    })
    .from(enrollments)
    .where(inArray(enrollments.id, enrollmentIds));

  // If more than one distinct (grade level, school year) pair, the selection is invalid.
  if (rows.length !== 1) {
    return null;
  }

  return rows[0];
}

// ─── Get Section Grade Level ──────────────────────────────────────────────────

/**
 * Get the grade level + school year for a section.
 * Used to validate that a section belongs to the same grade level and school year
 * as the enrollments being assigned to it.
 */
export async function getSectionGradeLevelId(
  sectionId: string
): Promise<{ gradeLevelId: string; schoolYearId: string } | null> {
  const [row] = await db
    .select({
      gradeLevelId: sections.gradeLevelId,
      schoolYearId: sections.schoolYearId,
    })
    .from(sections)
    .where(
      and(
        eq(sections.id, sectionId),
        isNull(sections.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}
