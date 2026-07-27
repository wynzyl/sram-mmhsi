import "server-only";

import { db } from "@/lib/db";
import { eq, and, isNull, desc, asc, sql, inArray } from "drizzle-orm";
import {
  teacherAssignments,
  schoolYears,
  subjects,
  sections,
  gradeSheets,
  gradeSheetEntries,
  gradeApprovals,
  gradeLevels,
  students,
  users,
  sectionAdvisers,
  enrollments,
  curriculumAdoptions,
  gradingPeriodSystems,
  subjectOfferings,
  studentSubjectEnrollments,
} from "@/lib/db/schema";
import type { GradingSystemType } from "@/lib/constants/grading-systems";
import type { GradeSheetView, GradeSheetEntryView } from "./grades.schema";

// ─── Type Definitions ─────────────────────────────────────────────────────────

/**
 * Teacher assignment row for the assignments management page
 */
export type TeacherAssignmentListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  schoolYearId: string;
  schoolYearLabel: string;
  isActiveYear: boolean;
  createdAt: Date;
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
 * Get the grading system type for a school year.
 * Returns "quarterly" (Q1-Q4) or "trimester" (T1-T3).
 * Defaults to "quarterly" if not configured or table doesn't exist.
 */
export async function getGradingSystemType(
  schoolYearId: string
): Promise<GradingSystemType> {
  try {
    const config = await db.query.gradingPeriodSystems.findFirst({
      where: eq(gradingPeriodSystems.schoolYearId, schoolYearId),
      columns: { systemType: true },
    });

    return (config?.systemType as GradingSystemType) ?? "quarterly";
  } catch {
    // Table may not exist yet - migrations not applied
    return "quarterly";
  }
}

/**
 * Check if a teacher is assigned to a section.
 * Checks both legacy teacherAssignments table and new subjectOfferings table.
 */
export async function isTeacherAssignedToSection(
  teacherId: string,
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  // Check legacy teacherAssignments table
  const [legacyAssignment] = await db
    .select({ id: teacherAssignments.id })
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.teacherId, teacherId),
        eq(teacherAssignments.sectionId, sectionId),
        eq(teacherAssignments.schoolYearId, schoolYearId),
        isNull(teacherAssignments.deletedAt)
      )
    )
    .limit(1);

  if (legacyAssignment) {
    return true;
  }

  // Check new subjectOfferings table
  const [subjectOfferingAssignment] = await db
    .select({ id: subjectOfferings.id })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.teacherId, teacherId),
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .limit(1);

  return !!subjectOfferingAssignment;
}

// ─── Grade Sheet Queries ─────────────────────────────────────────────────────

/**
 * Get grade sheets for an adviser's sections.
 * Used for the adviser's grade entry dashboard.
 */
export async function getAdviserGradeSheets(
  adviserId: string,
  schoolYearId: string
): Promise<GradeSheetView[]> {
  // First get sections where user is adviser
  const adviserSections = await db
    .select({ sectionId: sectionAdvisers.sectionId })
    .from(sectionAdvisers)
    .where(
      and(
        eq(sectionAdvisers.userId, adviserId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt)
      )
    );

  if (adviserSections.length === 0) {
    return [];
  }

  const sectionIds = adviserSections.map((s) => s.sectionId);

  const rows = await db
    .select({
      id: gradeSheets.id,
      sectionId: gradeSheets.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: gradeSheets.schoolYearId,
      schoolYearLabel: schoolYears.label,
      adviserId: gradeSheets.adviserId,
      adviserName: users.username,
      gradingPeriod: gradeSheets.gradingPeriod,
      status: gradeSheets.status,
      submittedAt: gradeSheets.submittedAt,
      coordinatorApprovedAt: gradeSheets.coordinatorApprovedAt,
      principalApprovedAt: gradeSheets.principalApprovedAt,
      publishedAt: gradeSheets.publishedAt,
      lockedAt: gradeSheets.lockedAt,
      returnedAt: gradeSheets.returnedAt,
      returnRemarks: gradeSheets.returnRemarks,
      createdAt: gradeSheets.createdAt,
    })
    .from(gradeSheets)
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(gradeSheets.adviserId, users.id))
    .where(
      and(
        inArray(gradeSheets.sectionId, sectionIds),
        eq(gradeSheets.schoolYearId, schoolYearId)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(gradeSheets.gradingPeriod));

  return rows as GradeSheetView[];
}

/**
 * Get grade sheets pending principal review.
 * Returns all sheets with submitted status (direct submission from advisers).
 */
export async function getPrincipalPendingReviews(
  schoolYearId: string
): Promise<GradeSheetView[]> {
  const rows = await db
    .select({
      id: gradeSheets.id,
      sectionId: gradeSheets.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: gradeSheets.schoolYearId,
      schoolYearLabel: schoolYears.label,
      adviserId: gradeSheets.adviserId,
      adviserName: users.username,
      gradingPeriod: gradeSheets.gradingPeriod,
      status: gradeSheets.status,
      submittedAt: gradeSheets.submittedAt,
      coordinatorApprovedAt: gradeSheets.coordinatorApprovedAt,
      principalApprovedAt: gradeSheets.principalApprovedAt,
      publishedAt: gradeSheets.publishedAt,
      lockedAt: gradeSheets.lockedAt,
      returnedAt: gradeSheets.returnedAt,
      returnRemarks: gradeSheets.returnRemarks,
      createdAt: gradeSheets.createdAt,
    })
    .from(gradeSheets)
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(gradeSheets.adviserId, users.id))
    .where(
      and(
        eq(gradeSheets.schoolYearId, schoolYearId),
        eq(gradeSheets.status, "submitted")
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(gradeSheets.gradingPeriod));

  return rows as GradeSheetView[];
}

/**
 * Get a grade sheet by ID with all details.
 */
export async function getGradeSheetById(
  gradeSheetId: string
): Promise<GradeSheetView | null> {
  const [row] = await db
    .select({
      id: gradeSheets.id,
      sectionId: gradeSheets.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: gradeSheets.schoolYearId,
      schoolYearLabel: schoolYears.label,
      adviserId: gradeSheets.adviserId,
      adviserName: users.username,
      gradingPeriod: gradeSheets.gradingPeriod,
      status: gradeSheets.status,
      submittedAt: gradeSheets.submittedAt,
      coordinatorApprovedAt: gradeSheets.coordinatorApprovedAt,
      principalApprovedAt: gradeSheets.principalApprovedAt,
      publishedAt: gradeSheets.publishedAt,
      lockedAt: gradeSheets.lockedAt,
      returnedAt: gradeSheets.returnedAt,
      returnRemarks: gradeSheets.returnRemarks,
      createdAt: gradeSheets.createdAt,
    })
    .from(gradeSheets)
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(gradeSheets.adviserId, users.id))
    .where(eq(gradeSheets.id, gradeSheetId))
    .limit(1);

  return row as GradeSheetView | null;
}

/**
 * Get grade sheet entries for a grade sheet.
 * Includes studentSubjectEnrollmentId when available for SSE traceability.
 */
export async function getGradeSheetEntries(
  gradeSheetId: string
): Promise<GradeSheetEntryView[]> {
  const rows = await db
    .select({
      id: gradeSheetEntries.id,
      gradeSheetId: gradeSheetEntries.gradeSheetId,
      studentId: gradeSheetEntries.studentId,
      studentRef: students.referenceNumber,
      studentName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      subjectId: gradeSheetEntries.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      grade: gradeSheetEntries.grade,
      remarks: gradeSheetEntries.remarks,
      studentSubjectEnrollmentId: gradeSheetEntries.studentSubjectEnrollmentId,
    })
    .from(gradeSheetEntries)
    .innerJoin(students, eq(gradeSheetEntries.studentId, students.id))
    .innerJoin(subjects, eq(gradeSheetEntries.subjectId, subjects.id))
    .where(eq(gradeSheetEntries.gradeSheetId, gradeSheetId))
    .orderBy(asc(students.lastName), asc(students.firstName), asc(subjects.name));

  return rows as GradeSheetEntryView[];
}

/**
 * Get published grades for a student in a school year.
 * Used for student portal.
 * Includes studentSubjectEnrollmentId for SSE traceability when available.
 */
export async function getPublishedGradesForStudent(
  studentId: string,
  schoolYearId: string
): Promise<GradeSheetEntryView[]> {
  const rows = await db
    .select({
      id: gradeSheetEntries.id,
      gradeSheetId: gradeSheetEntries.gradeSheetId,
      studentId: gradeSheetEntries.studentId,
      studentRef: students.referenceNumber,
      studentName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      subjectId: gradeSheetEntries.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      grade: gradeSheetEntries.grade,
      remarks: gradeSheetEntries.remarks,
      gradingPeriod: gradeSheets.gradingPeriod,
      studentSubjectEnrollmentId: gradeSheetEntries.studentSubjectEnrollmentId,
    })
    .from(gradeSheetEntries)
    .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
    .innerJoin(students, eq(gradeSheetEntries.studentId, students.id))
    .innerJoin(subjects, eq(gradeSheetEntries.subjectId, subjects.id))
    .where(
      and(
        eq(gradeSheetEntries.studentId, studentId),
        eq(gradeSheets.schoolYearId, schoolYearId),
        inArray(gradeSheets.status, ["published", "locked"])
      )
    )
    .orderBy(asc(subjects.name), asc(gradeSheets.gradingPeriod));

  return rows as GradeSheetEntryView[];
}

/**
 * Get approval history for a grade sheet.
 */
export async function getGradeSheetApprovalHistory(
  gradeSheetId: string
): Promise<{
  id: string;
  action: string;
  remarks: string | null;
  actorName: string;
  actorRole: string;
  createdAt: Date;
}[]> {
  const rows = await db
    .select({
      id: gradeApprovals.id,
      action: gradeApprovals.action,
      remarks: gradeApprovals.remarks,
      actorName: users.username,
      actorRole: gradeApprovals.actorRole,
      createdAt: gradeApprovals.createdAt,
    })
    .from(gradeApprovals)
    .innerJoin(users, eq(gradeApprovals.actorId, users.id))
    .where(eq(gradeApprovals.gradeSheetId, gradeSheetId))
    .orderBy(desc(gradeApprovals.createdAt));

  return rows;
}

// ─── Teacher Assignments Management ──────────────────────────────────────────

import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { calculatePagination, calculateOffset } from "@/lib/types/pagination";

/**
 * Get all teacher assignments with full details for the management page.
 * Ordered by school year (newest first), then grade level, then section, then subject.
 *
 * @deprecated Use getPaginatedTeacherAssignments for large datasets
 */
export async function getAllTeacherAssignments(
  schoolYearId?: string
): Promise<TeacherAssignmentListItem[]> {
  const whereConditions = [isNull(teacherAssignments.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(teacherAssignments.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      id: teacherAssignments.id,
      teacherId: teacherAssignments.teacherId,
      teacherName: users.username,
      teacherEmail: users.email,
      subjectId: teacherAssignments.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      sectionId: teacherAssignments.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: teacherAssignments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: teacherAssignments.createdAt,
    })
    .from(teacherAssignments)
    .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(and(...whereConditions))
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(sections.name),
      asc(subjects.name)
    );

  return rows as TeacherAssignmentListItem[];
}

/**
 * Get paginated teacher assignments with full details.
 * Recommended for the management page to avoid loading all records into memory.
 */
export async function getPaginatedTeacherAssignments(
  pagination: PaginationParams,
  schoolYearId?: string
): Promise<PaginatedResult<TeacherAssignmentListItem>> {
  const whereConditions = [isNull(teacherAssignments.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(teacherAssignments.schoolYearId, schoolYearId));
  }

  // Get total count for pagination metadata
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teacherAssignments)
    .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(and(...whereConditions));

  const totalRecords = countResult?.count ?? 0;
  const offset = calculateOffset(pagination.page, pagination.pageSize);

  // Get paginated data
  const rows = await db
    .select({
      id: teacherAssignments.id,
      teacherId: teacherAssignments.teacherId,
      teacherName: users.username,
      teacherEmail: users.email,
      subjectId: teacherAssignments.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      sectionId: teacherAssignments.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: teacherAssignments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: teacherAssignments.createdAt,
    })
    .from(teacherAssignments)
    .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(and(...whereConditions))
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(sections.name),
      asc(subjects.name)
    )
    .limit(pagination.pageSize)
    .offset(offset);

  return {
    data: rows as TeacherAssignmentListItem[],
    pagination: calculatePagination(pagination.page, pagination.pageSize, totalRecords),
  };
}

/**
 * Get all active subjects for the teacher assignment form dropdown.
 * Filters by curriculum adoptions for the specified school year.
 * Only returns subjects from curriculums that are adopted for this school year,
 * matching the grade level specified in the adoption.
 */
export async function getSubjectsForAssignment(
  schoolYearId: string
): Promise<{ id: string; name: string; code: string; gradeLevelId: string; gradeLevelName: string }[]> {
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
  // This ensures we only get subjects that are actually adopted for this school year
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

// ─── Adviser Grade Entry Queries (NEW) ─────────────────────────────────────────

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
 * Get sections where the user is an adviser for a school year.
 * Used for the adviser's grade entry dashboard.
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
 * Get all sections for the teacher assignment form dropdown.
 */
export async function getSectionsForAssignment(
  schoolYearId: string
): Promise<{ id: string; name: string; gradeLevelId: string; gradeLevelName: string }[]> {
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
      and(
        eq(sections.schoolYearId, schoolYearId),
        isNull(sections.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows;
}

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
 * Get enrolled students in a section for a school year.
 * Used for the adviser's grade entry grid.
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

/**
 * Subject for grade entry grid
 */
export type GradeLevelSubject = {
  id: string;
  name: string;
  code: string;
  sequenceOrder: number;
};

/**
 * Get subjects for a grade level from the active curriculum for a school year.
 * Used for the adviser's grade entry grid columns.
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
 * Get section details including grade level info.
 * Used for the adviser's grade entry page header.
 */
export async function getSectionDetails(
  sectionId: string
): Promise<{
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
    .where(
      and(
        eq(sections.id, sectionId),
        isNull(sections.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
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

// ─── Grade Sheet Data for Grade Entry ──────────────────────────────────────────

/**
 * Grade sheet data for grade entry page
 */
export type GradeSheetData = {
  id: string;
  status: string;
  returnRemarks: string | null;
  entries: Array<{
    studentId: string;
    subjectId: string;
    grade: string | null;
  }>;
};

/**
 * Get grade sheet for a section/period with entries.
 * Returns null if no grade sheet exists.
 */
export async function getGradeSheetForPeriod(
  sectionId: string,
  schoolYearId: string,
  gradingPeriod: string
): Promise<GradeSheetData | null> {
  const sheet = await db.query.gradeSheets.findFirst({
    where: and(
      eq(gradeSheets.sectionId, sectionId),
      eq(gradeSheets.schoolYearId, schoolYearId),
      sql`${gradeSheets.gradingPeriod} = ${gradingPeriod}`
    ),
    columns: {
      id: true,
      status: true,
      returnRemarks: true,
    },
  });

  if (!sheet) {
    return null;
  }

  const entries = await db
    .select({
      studentId: gradeSheetEntries.studentId,
      subjectId: gradeSheetEntries.subjectId,
      grade: gradeSheetEntries.grade,
    })
    .from(gradeSheetEntries)
    .where(eq(gradeSheetEntries.gradeSheetId, sheet.id));

  return {
    id: sheet.id,
    status: sheet.status,
    returnRemarks: sheet.returnRemarks,
    entries: entries.map((e) => ({
      studentId: e.studentId,
      subjectId: e.subjectId,
      grade: e.grade ? String(e.grade) : null,
    })),
  };
}

/**
 * Period completion status
 */
export type PeriodCompletionStatus = {
  period: string;
  hasGradeSheet: boolean;
  status: string | null; // Grade sheet status
  isComplete: boolean; // Period is approved/published (unlocks next period)
  totalExpected: number;
  totalEntered: number;
};

/**
 * Get completion status for all periods of a section.
 * Used to determine if later periods can be edited.
 *
 * Performance: Uses a single aggregated query instead of N queries per period.
 */
export async function getPeriodsCompletionStatus(
  sectionId: string,
  schoolYearId: string,
  periods: readonly string[],
  studentCount: number,
  subjectCount: number
): Promise<Map<string, PeriodCompletionStatus>> {
  const result = new Map<string, PeriodCompletionStatus>();
  const totalExpected = studentCount * subjectCount;

  // Initialize all periods as having no grade sheet
  for (const period of periods) {
    result.set(period, {
      period,
      hasGradeSheet: false,
      status: null,
      isComplete: false,
      totalExpected,
      totalEntered: 0,
    });
  }

  // Statuses that indicate a period is complete (unlocks next period)
  const COMPLETE_STATUSES = ["principal_approved", "published", "locked"];

  // Single query to get all grade sheets and their entry counts for this section/year
  // This replaces N queries (2 per period) with 1 aggregated query
  const sheetStats = await db
    .select({
      gradingPeriod: gradeSheets.gradingPeriod,
      sheetId: gradeSheets.id,
      status: gradeSheets.status,
      entryCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${gradeSheetEntries}
        WHERE ${gradeSheetEntries.gradeSheetId} = ${gradeSheets.id}
        AND ${gradeSheetEntries.grade} IS NOT NULL
      )`.as("entry_count"),
    })
    .from(gradeSheets)
    .where(
      and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId)
      )
    );

  // Update results with actual data
  // A period is "complete" only when its grade sheet is approved/published
  for (const stat of sheetStats) {
    const totalEntered = stat.entryCount ?? 0;
    result.set(stat.gradingPeriod, {
      period: stat.gradingPeriod,
      hasGradeSheet: true,
      status: stat.status,
      isComplete: COMPLETE_STATUSES.includes(stat.status),
      totalExpected,
      totalEntered,
    });
  }

  return result;
}

// ─── SSE-Based Subject Queries ─────────────────────────────────────────────────

/**
 * Subject from subject offerings for grade entry grid.
 * Used when section has subject offerings configured.
 */
export type SubjectOfferingForGrades = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectUnits: string;
  isCore: boolean;
  sequenceOrder: number;
  teacherId: string | null;
  teacherName: string | null;
};

/**
 * Get subjects for a section from subject offerings.
 * This is the SSE-aware alternative to getSubjectsForGradeLevel.
 * Returns null if no subject offerings exist for the section (fallback to curriculum-based).
 */
export async function getSubjectsFromOfferingsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<SubjectOfferingForGrades[] | null> {
  // Check if section has subject offerings
  const offeringsExist = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true)
      )
    );

  if (!offeringsExist[0]?.count || offeringsExist[0].count === 0) {
    // No offerings exist - caller should fallback to curriculum-based subjects
    return null;
  }

  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sequenceOrder: subjectOfferings.sequenceOrder,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  return rows as SubjectOfferingForGrades[];
}

/**
 * Student with SSE info for grade entry grid.
 */
export type StudentWithSSE = {
  id: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enrollmentId: string;
  strandId: string | null;
  strandCode: string | null;
  /** Map of subjectId -> studentSubjectEnrollmentId */
  subjectEnrollments: Map<string, string>;
};

/**
 * Get enrolled students with their SSE records for a section.
 * This provides the mapping between students, subjects, and their SSE IDs
 * for proper grade entry traceability.
 */
export async function getStudentsWithSSEForSection(
  sectionId: string,
  schoolYearId: string
): Promise<StudentWithSSE[]> {
  // Get students with enrollments
  const studentRows = await db
    .select({
      id: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      fullName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      enrollmentId: enrollments.id,
      strandId: enrollments.strandId,
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

  if (studentRows.length === 0) {
    return [];
  }

  // Get all SSE records for these enrollments
  const enrollmentIds = studentRows.map((s) => s.enrollmentId);
  const sseRows = await db
    .select({
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      subjectId: subjectOfferings.subjectId,
      sseId: studentSubjectEnrollments.id,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      subjectOfferings,
      eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
    )
    .where(
      and(
        inArray(studentSubjectEnrollments.enrollmentId, enrollmentIds),
        eq(studentSubjectEnrollments.isActive, true)
      )
    );

  // Build SSE lookup by enrollmentId
  const sseLookup = new Map<string, Map<string, string>>();
  for (const sse of sseRows) {
    if (!sseLookup.has(sse.enrollmentId)) {
      sseLookup.set(sse.enrollmentId, new Map());
    }
    sseLookup.get(sse.enrollmentId)!.set(sse.subjectId, sse.sseId);
  }

  // Combine student info with SSE lookup
  return studentRows.map((student) => ({
    id: student.id,
    studentRef: student.studentRef,
    firstName: student.firstName,
    lastName: student.lastName,
    fullName: student.fullName,
    enrollmentId: student.enrollmentId,
    strandId: student.strandId,
    strandCode: null, // Can be joined if needed
    subjectEnrollments: sseLookup.get(student.enrollmentId) ?? new Map(),
  }));
}

// ─── SHS Strand-Based Grade Entry Queries ──────────────────────────────────────

import { strands } from "@/lib/db/schema";
import type { ShsStrandCode } from "@/lib/constants/strands";

/**
 * Subject offering with strand info for SHS grade entry.
 */
export type SHSSubjectOffering = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectUnits: string;
  isCore: boolean;
  sequenceOrder: number;
  strandId: string | null;
  strandCode: string | null;
  teacherId: string | null;
  teacherName: string | null;
};

/**
 * SHS grade entry subjects organized by category.
 */
export type SHSGradeEntrySubjects = {
  /** Core subjects that all students take (isCore = true) */
  universalCore: SHSSubjectOffering[];
  /** Strand-specific subjects grouped by strand code */
  strandSubjects: Map<ShsStrandCode, SHSSubjectOffering[]>;
  /** All available strands in this section */
  availableStrands: ShsStrandCode[];
};

/**
 * Get subjects for SHS grade entry, organized by universal core vs strand-specific.
 *
 * This query fetches all subject offerings for a section and categorizes them:
 * - universalCore: subjects with isCore = true (all students take these)
 * - strandSubjects: subjects with isCore = false, grouped by strandCode
 *
 * Returns null if no subject offerings exist for the section.
 */
export async function getSubjectsForSHSGradeEntry(
  sectionId: string,
  schoolYearId: string
): Promise<SHSGradeEntrySubjects | null> {
  // Get all active subject offerings with strand info
  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sequenceOrder: subjectOfferings.sequenceOrder,
      strandId: subjectOfferings.strandId,
      strandCode: strands.code,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(strands, eq(subjectOfferings.strandId, strands.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  if (rows.length === 0) {
    return null;
  }

  // Categorize subjects (deduplicate by subject code to handle duplicate offerings)
  const universalCore: SHSSubjectOffering[] = [];
  const strandSubjects = new Map<ShsStrandCode, SHSSubjectOffering[]>();
  const availableStrands = new Set<ShsStrandCode>();

  // Track seen subject codes to prevent duplicates
  const seenCoreCodes = new Set<string>();
  const seenStrandCodes = new Map<ShsStrandCode, Set<string>>();

  for (const row of rows) {
    if (row.isCore) {
      // Universal core subject - deduplicate by subject code
      if (!seenCoreCodes.has(row.subjectCode)) {
        seenCoreCodes.add(row.subjectCode);
        universalCore.push(row as SHSSubjectOffering);
      }
    } else if (row.strandCode) {
      // Strand-specific subject - deduplicate by strand + subject code
      const strandCode = row.strandCode as ShsStrandCode;
      availableStrands.add(strandCode);

      // Initialize seen set for this strand if needed
      if (!seenStrandCodes.has(strandCode)) {
        seenStrandCodes.set(strandCode, new Set<string>());
      }
      const seenForStrand = seenStrandCodes.get(strandCode)!;

      if (!seenForStrand.has(row.subjectCode)) {
        seenForStrand.add(row.subjectCode);
        const existing = strandSubjects.get(strandCode) || [];
        existing.push(row as SHSSubjectOffering);
        strandSubjects.set(strandCode, existing);
      }
    }
  }

  // Sort strands by defined order
  const { SHS_STRAND_ORDER } = await import("@/lib/constants/strands");
  const sortedStrands = Array.from(availableStrands).sort(
    (a, b) => SHS_STRAND_ORDER[a] - SHS_STRAND_ORDER[b]
  );

  return {
    universalCore,
    strandSubjects,
    availableStrands: sortedStrands,
  };
}

/**
 * Student in section with strand info for SHS grade entry.
 */
export type SHSSectionStudent = {
  id: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enrollmentId: string;
  strandId: string | null;
  strandCode: ShsStrandCode | null;
};

/**
 * Get enrolled students in a section with their strand assignments.
 * Used for SHS grade entry to filter students by strand.
 */
export async function getStudentsWithStrandsInSection(
  sectionId: string,
  schoolYearId: string
): Promise<SHSSectionStudent[]> {
  const rows = await db
    .select({
      id: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      fullName: sql<string>`${students.lastName} || ', ' || ${students.firstName}`,
      enrollmentId: enrollments.id,
      strandId: enrollments.strandId,
      strandCode: strands.code,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .leftJoin(strands, eq(enrollments.strandId, strands.id))
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return rows.map((row) => ({
    ...row,
    strandCode: row.strandCode as ShsStrandCode | null,
  }));
}
