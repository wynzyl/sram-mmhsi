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
} from "@/lib/db/schema";
import type { GradingSystemType } from "@/lib/constants/grading-systems";
import type { GradeSheetView, GradeSheetEntryView } from "./grades.schema";

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

// ─── Grade Sheet Queries (NEW) ───────────────────────────────────────────────

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

/**
 * Get all teacher assignments with full details for the management page.
 * Ordered by school year (newest first), then grade level, then section, then subject.
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
 * Get all active subjects for the teacher assignment form dropdown.
 * Filters by curriculum adoptions for the specified school year.
 */
export async function getSubjectsForAssignment(
  schoolYearId: string
): Promise<{ id: string; name: string; code: string; gradeLevelName: string }[]> {
  // Get subjects from published curriculums that are adopted for this school year
  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
    })
    .from(subjects)
    .innerJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(isNull(subjects.deletedAt))
    .orderBy(asc(gradeLevels.order), asc(subjects.name));

  return rows;
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
): Promise<{ id: string; name: string; gradeLevelName: string }[]> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
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
  // Find the active curriculum adoption for this school year
  const adoption = await db.query.curriculumAdoptions.findFirst({
    where: and(
      eq(curriculumAdoptions.schoolYearId, schoolYearId),
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
  isComplete: boolean; // All students have grades for all subjects
  totalExpected: number;
  totalEntered: number;
};

/**
 * Get completion status for all periods of a section.
 * Used to determine if later periods can be edited.
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

  for (const period of periods) {
    const sheet = await db.query.gradeSheets.findFirst({
      where: and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId),
        sql`${gradeSheets.gradingPeriod} = ${period}`
      ),
      columns: { id: true, status: true },
    });

    if (!sheet) {
      result.set(period, {
        period,
        hasGradeSheet: false,
        isComplete: false,
        totalExpected,
        totalEntered: 0,
      });
      continue;
    }

    // Count entries with grades
    const [countResult] = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(gradeSheetEntries)
      .where(
        and(
          eq(gradeSheetEntries.gradeSheetId, sheet.id),
          sql`${gradeSheetEntries.grade} IS NOT NULL`
        )
      );

    const totalEntered = countResult?.count ?? 0;

    result.set(period, {
      period,
      hasGradeSheet: true,
      isComplete: totalEntered >= totalExpected && totalExpected > 0,
      totalExpected,
      totalEntered,
    });
  }

  return result;
}
