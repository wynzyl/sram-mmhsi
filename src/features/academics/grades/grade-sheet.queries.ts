import "server-only";

/**
 * Grade Sheet Queries
 *
 * Queries for grade sheet CRUD and approval workflow:
 * - Get grade sheets (adviser, principal review)
 * - Get grade sheet entries
 * - Approval history
 */

import { db } from "@/lib/db";
import { eq, and, asc, desc, sql, inArray } from "drizzle-orm";
import {
  gradeSheets,
  gradeSheetEntries,
  gradeApprovals,
  sections,
  gradeLevels,
  schoolYears,
  subjects,
  students,
  users,
  sectionAdvisers,
  subjectOfferings,
} from "@/lib/db/schema";
import type { GradeSheetView, GradeSheetEntryView } from "./grades.schema";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { calculatePagination, calculateOffset } from "@/lib/types/pagination";

// ─── Grade Sheet List Queries ────────────────────────────────────────────────

/**
 * Get grade sheets for an adviser's sections.
 * Used for the adviser's grade entry dashboard.
 */
export async function getAdviserGradeSheets(
  adviserId: string,
  schoolYearId: string,
  pagination?: PaginationParams
): Promise<GradeSheetView[] | PaginatedResult<GradeSheetView>> {
  // First get sections where user is adviser
  const adviserSections = await db
    .select({ sectionId: sectionAdvisers.sectionId })
    .from(sectionAdvisers)
    .where(
      and(
        eq(sectionAdvisers.userId, adviserId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        sql`${sectionAdvisers.deletedAt} IS NULL`
      )
    );

  if (adviserSections.length === 0) {
    if (pagination) {
      return {
        data: [],
        pagination: calculatePagination(pagination.page, pagination.pageSize, 0),
      };
    }
    return [];
  }

  const sectionIds = adviserSections.map((s) => s.sectionId);
  const whereClause = and(
    inArray(gradeSheets.sectionId, sectionIds),
    eq(gradeSheets.schoolYearId, schoolYearId)
  );

  const baseQuery = db
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
    .where(whereClause)
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(gradeSheets.gradingPeriod));

  if (!pagination) {
    const rows = await baseQuery;
    return rows as GradeSheetView[];
  }

  const offset = calculateOffset(pagination.page, pagination.pageSize);
  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(gradeSheets).where(whereClause),
    baseQuery.limit(pagination.pageSize).offset(offset),
  ]);

  return {
    data: rows as GradeSheetView[],
    pagination: calculatePagination(pagination.page, pagination.pageSize, countResult[0]?.count ?? 0),
  };
}

/**
 * Get grade sheets pending principal review.
 */
export async function getPrincipalPendingReviews(
  schoolYearId: string,
  pagination?: PaginationParams
): Promise<GradeSheetView[] | PaginatedResult<GradeSheetView>> {
  const whereClause = and(
    eq(gradeSheets.schoolYearId, schoolYearId),
    eq(gradeSheets.status, "submitted")
  );

  const baseQuery = db
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
    .where(whereClause)
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(gradeSheets.gradingPeriod));

  if (!pagination) {
    const rows = await baseQuery;
    return rows as GradeSheetView[];
  }

  const offset = calculateOffset(pagination.page, pagination.pageSize);
  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(gradeSheets).where(whereClause),
    baseQuery.limit(pagination.pageSize).offset(offset),
  ]);

  return {
    data: rows as GradeSheetView[],
    pagination: calculatePagination(pagination.page, pagination.pageSize, countResult[0]?.count ?? 0),
  };
}

/**
 * Get a grade sheet by ID with all details.
 */
export async function getGradeSheetById(gradeSheetId: string): Promise<GradeSheetView | null> {
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

// ─── Grade Sheet Entry Queries ───────────────────────────────────────────────

/**
 * Get grade sheet entries for a grade sheet.
 */
export async function getGradeSheetEntries(gradeSheetId: string): Promise<GradeSheetEntryView[]> {
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

// ─── Approval History ────────────────────────────────────────────────────────

/**
 * Get approval history for a grade sheet.
 */
export async function getGradeSheetApprovalHistory(gradeSheetId: string): Promise<{
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

// ─── Grade Sheet Data for Grade Entry ────────────────────────────────────────

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

  // Only return entries for subjects that have active, non-deleted offerings
  const entries = await db
    .select({
      studentId: gradeSheetEntries.studentId,
      subjectId: gradeSheetEntries.subjectId,
      grade: gradeSheetEntries.grade,
    })
    .from(gradeSheetEntries)
    .where(
      and(
        eq(gradeSheetEntries.gradeSheetId, sheet.id),
        sql`EXISTS (
          SELECT 1 FROM ${subjectOfferings}
          WHERE ${subjectOfferings.subjectId} = ${gradeSheetEntries.subjectId}
            AND ${subjectOfferings.sectionId} = ${sectionId}
            AND ${subjectOfferings.schoolYearId} = ${schoolYearId}
            AND ${subjectOfferings.isActive} = true
            AND ${subjectOfferings.deletedAt} IS NULL
        )`
      )
    );

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
  status: string | null;
  isComplete: boolean;
  totalExpected: number;
  totalEntered: number;
};

/**
 * Get completion status for all periods of a section.
 * Uses a single aggregated query for performance.
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
    result.set(period, {
      period,
      hasGradeSheet: false,
      status: null,
      isComplete: false,
      totalExpected,
      totalEntered: 0,
    });
  }

  const COMPLETE_STATUSES = ["principal_approved", "published", "locked"];

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

  for (const stat of sheetStats) {
    result.set(stat.gradingPeriod, {
      period: stat.gradingPeriod,
      hasGradeSheet: true,
      status: stat.status,
      isComplete: COMPLETE_STATUSES.includes(stat.status),
      totalExpected,
      totalEntered: stat.entryCount ?? 0,
    });
  }

  return result;
}
