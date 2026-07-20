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
  coordinatorAssignments,
} from "@/lib/db/schema";
import type { GradeSheetView, GradeSheetEntryView } from "./grades.schema";
import { GRADE_LEVEL_TO_GROUP, type GradeGroup } from "@/lib/constants/grade-groups";

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
 * Get grade sheets pending coordinator review.
 * Filters by the coordinator's assigned grade groups.
 */
export async function getCoordinatorPendingReviews(
  coordinatorId: string,
  schoolYearId: string
): Promise<GradeSheetView[]> {
  // Get coordinator's assigned grade groups
  const assignments = await db
    .select({ gradeGroup: coordinatorAssignments.gradeGroup })
    .from(coordinatorAssignments)
    .where(
      and(
        eq(coordinatorAssignments.userId, coordinatorId),
        eq(coordinatorAssignments.schoolYearId, schoolYearId),
        isNull(coordinatorAssignments.deletedAt)
      )
    );

  if (assignments.length === 0) {
    return [];
  }

  const gradeGroups = assignments.map((a) => a.gradeGroup);

  // Get grade level names for these groups
  const gradeLevelNames = Object.entries(GRADE_LEVEL_TO_GROUP)
    .filter(([, group]) => gradeGroups.includes(group as GradeGroup))
    .map(([name]) => name);

  if (gradeLevelNames.length === 0) {
    return [];
  }

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
        eq(gradeSheets.status, "submitted"),
        inArray(gradeLevels.name, gradeLevelNames)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(gradeSheets.gradingPeriod));

  return rows as GradeSheetView[];
}

/**
 * Get grade sheets pending principal review.
 * Returns all sheets with coordinator_approved status.
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
        eq(gradeSheets.status, "coordinator_approved")
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
