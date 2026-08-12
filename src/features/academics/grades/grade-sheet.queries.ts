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
 *
 * Performance: Combined sheet + entries into single query using LEFT JOIN,
 * eliminating sequential query pattern.
 */
export async function getGradeSheetForPeriod(
  sectionId: string,
  schoolYearId: string,
  gradingPeriod: string
): Promise<GradeSheetData | null> {
  // Single query with LEFT JOIN for sheet + entries
  const rows = await db
    .select({
      // Sheet fields
      sheetId: gradeSheets.id,
      status: gradeSheets.status,
      returnRemarks: gradeSheets.returnRemarks,
      // Entry fields (may be null if no entries)
      entryStudentId: gradeSheetEntries.studentId,
      entrySubjectId: gradeSheetEntries.subjectId,
      entryGrade: gradeSheetEntries.grade,
    })
    .from(gradeSheets)
    .leftJoin(
      gradeSheetEntries,
      and(
        eq(gradeSheetEntries.gradeSheetId, gradeSheets.id),
        // Only include entries for subjects with active, non-deleted offerings
        sql`EXISTS (
          SELECT 1 FROM ${subjectOfferings}
          WHERE ${subjectOfferings.subjectId} = ${gradeSheetEntries.subjectId}
            AND ${subjectOfferings.sectionId} = ${sectionId}
            AND ${subjectOfferings.schoolYearId} = ${schoolYearId}
            AND ${subjectOfferings.isActive} = true
            AND ${subjectOfferings.deletedAt} IS NULL
        )`
      )
    )
    .where(
      and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId),
        sql`${gradeSheets.gradingPeriod} = ${gradingPeriod}`
      )
    );

  if (rows.length === 0) {
    return null;
  }

  // Extract sheet info from first row
  const firstRow = rows[0];
  const sheetId = firstRow.sheetId;
  const status = firstRow.status;
  const returnRemarks = firstRow.returnRemarks;

  // Build entries array from all rows (handle case where LEFT JOIN returned no entries)
  const entries: Array<{ studentId: string; subjectId: string; grade: string | null }> = [];
  for (const row of rows) {
    if (row.entryStudentId && row.entrySubjectId) {
      entries.push({
        studentId: row.entryStudentId,
        subjectId: row.entrySubjectId,
        grade: row.entryGrade ? String(row.entryGrade) : null,
      });
    }
  }

  return {
    id: sheetId,
    status,
    returnRemarks,
    entries,
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
};

/**
 * Get per-period grade sheet status for a section — the lock/unlock chain the
 * grading period selector renders.
 *
 * Reports only what that selector reads: whether a sheet exists, its status, and
 * whether the status counts as complete. It deliberately does NOT report
 * expected/entered grade totals. For SHS those are per student and per period —
 * core subjects plus only the student's own strand, counting only offerings
 * active in that period — which one section-wide number cannot express. The
 * accurate figure is computed where it is actually used: `SHSGradeEntryTabs`
 * for the on-screen progress, and `validateGradeSheetCompleteness` for the
 * submission gate.
 *
 * Performance: Added inArray filter to only fetch sheets for requested periods,
 * reducing data transfer when only a subset of periods is needed.
 */
export async function getPeriodsCompletionStatus(
  sectionId: string,
  schoolYearId: string,
  periods: readonly string[]
): Promise<Map<string, PeriodCompletionStatus>> {
  const result = new Map<string, PeriodCompletionStatus>();

  for (const period of periods) {
    result.set(period, {
      period,
      hasGradeSheet: false,
      status: null,
      isComplete: false,
    });
  }

  const COMPLETE_STATUSES = ["principal_approved", "published", "locked"];

  // Filter to only requested periods at DB level
  // Cast periods to the grading period enum type for type safety
  type GradingPeriodType = typeof gradeSheets.gradingPeriod.enumValues[number];
  const periodValues = periods as unknown as GradingPeriodType[];

  const sheetStats = await db
    .select({
      gradingPeriod: gradeSheets.gradingPeriod,
      status: gradeSheets.status,
    })
    .from(gradeSheets)
    .where(
      and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId),
        inArray(gradeSheets.gradingPeriod, periodValues)
      )
    );

  for (const stat of sheetStats) {
    result.set(stat.gradingPeriod, {
      period: stat.gradingPeriod,
      hasGradeSheet: true,
      status: stat.status,
      isComplete: COMPLETE_STATUSES.includes(stat.status),
    });
  }

  return result;
}

// ─── Unified Page Data Fetcher ───────────────────────────────────────────────

import type { SectionStudent, GradeLevelSubject } from "./adviser.queries";
import type { SHSSectionStudent, SHSGradeEntrySubjects } from "./shs.queries";
import {
  getStudentsInSection,
  getSubjectsForGradeLevel,
} from "./adviser.queries";
import {
  getStudentsWithStrandsInSection,
  getSubjectsForSHSGradeEntry,
  getGradingSystemType,
} from "./shs.queries";
import { requiresStrandSelection } from "@/lib/constants/strands";
import { QUARTERLY_PERIODS, TRIMESTER_PERIODS } from "@/lib/constants/grading-periods";
import type { GradingSystemType } from "@/lib/constants/grading-systems";

/**
 * Regular (non-SHS) grade entry page data.
 */
export type RegularGradeEntryPageData = {
  type: "regular";
  students: SectionStudent[];
  subjects: GradeLevelSubject[];
  gradeSheetData: GradeSheetData | null;
  completionStatus: Map<string, PeriodCompletionStatus>;
  gradingSystemType: GradingSystemType;
  periods: readonly string[];
  canEdit: boolean;
  isReturnedForRevision: boolean;
};

/**
 * SHS (strand-based) grade entry page data.
 */
export type SHSGradeEntryPageData = {
  type: "shs";
  students: SHSSectionStudent[];
  subjects: SHSGradeEntrySubjects | null;
  gradeSheetData: GradeSheetData | null;
  completionStatus: Map<string, PeriodCompletionStatus>;
  gradingSystemType: GradingSystemType;
  periods: readonly string[];
  canEdit: boolean;
  isReturnedForRevision: boolean;
};

/**
 * Discriminated union for grade entry page data.
 */
export type GradeEntryPageData = RegularGradeEntryPageData | SHSGradeEntryPageData;

/**
 * Section info required for page data fetching.
 */
type SectionInfo = {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
};

/**
 * Unified data fetcher for the grade entry page.
 *
 * Fetches all data needed for the grade entry page in a single function,
 * using parallel queries where possible. Returns a discriminated union
 * that can be used to render the appropriate component (SHS vs regular).
 *
 * Performance: Included completionStatus in Promise.all to eliminate
 * sequential query after the main parallel batch.
 *
 * @param section - Section details (from getSectionDetails)
 * @param selectedPeriod - The grading period to fetch data for
 * @returns Discriminated union of SHS or regular grade entry data
 */
export async function getGradeEntryPageData(
  section: SectionInfo,
  selectedPeriod: string
): Promise<GradeEntryPageData> {
  const isShs = requiresStrandSelection(section.gradeLevelName);

  // Fetch grading system type first (needed for both paths)
  const gradingSystemType = await getGradingSystemType(section.schoolYearId);
  const periods = gradingSystemType === "trimester" ? TRIMESTER_PERIODS : QUARTERLY_PERIODS;

  if (isShs) {
    // SHS: Use strand-based queries with term filtering
    // All 4 queries run in parallel
    const [shsStudents, shsSubjects, gradeSheetData, completionStatus] = await Promise.all([
      getStudentsWithStrandsInSection(section.id, section.schoolYearId),
      getSubjectsForSHSGradeEntry(section.id, section.schoolYearId, selectedPeriod),
      getGradeSheetForPeriod(section.id, section.schoolYearId, selectedPeriod),
      getPeriodsCompletionStatus(section.id, section.schoolYearId, periods),
    ]);

    // Determine if editing is allowed
    const periodIndex = (periods as readonly string[]).indexOf(selectedPeriod);
    const isReturnedForRevision = gradeSheetData?.status === "returned";
    const canEdit =
      isReturnedForRevision ||
      periodIndex === 0 ||
      (periodIndex > 0 && completionStatus.get(periods[periodIndex - 1])?.isComplete === true);

    return {
      type: "shs",
      students: shsStudents,
      subjects: shsSubjects,
      gradeSheetData,
      completionStatus,
      gradingSystemType,
      periods,
      canEdit,
      isReturnedForRevision,
    };
  }

  // Non-SHS: Use standard curriculum-based queries
  // All 4 queries run in parallel
  const [students, subjects, gradeSheetData, completionStatus] = await Promise.all([
    getStudentsInSection(section.id, section.schoolYearId),
    getSubjectsForGradeLevel(section.gradeLevelId, section.schoolYearId),
    getGradeSheetForPeriod(section.id, section.schoolYearId, selectedPeriod),
    getPeriodsCompletionStatus(section.id, section.schoolYearId, periods),
  ]);

  // Determine if editing is allowed
  const periodIndex = (periods as readonly string[]).indexOf(selectedPeriod);
  const isReturnedForRevision = gradeSheetData?.status === "returned";
  const canEdit =
    isReturnedForRevision ||
    periodIndex === 0 ||
    (periodIndex > 0 && completionStatus.get(periods[periodIndex - 1])?.isComplete === true);

  return {
    type: "regular",
    students,
    subjects,
    gradeSheetData,
    completionStatus,
    gradingSystemType,
    periods,
    canEdit,
    isReturnedForRevision,
  };
}
