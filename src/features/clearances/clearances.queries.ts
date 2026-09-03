import "server-only";
import { db } from "@/lib/db";
import {
  studentClearances,
  students,
  enrollments,
  schoolYears,
  gradeLevels,
  assessments,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";
import type { ClearanceType, ClearanceStatus, ResolutionType } from "./clearances.schema";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type ClearanceListItem = {
  id: string;
  studentId: string;
  studentRef: string;
  studentName: string;
  enrollmentId: string | null;
  gradeLevelName: string | null;
  schoolYearLabel: string | null;
  clearanceType: ClearanceType;
  outstandingAmount: string;
  status: ClearanceStatus;
  resolutionType: ResolutionType | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  createdAt: Date;
};

export type ClearanceDetail = ClearanceListItem & {
  resolutionRemarks: string | null;
  createdByName: string | null;
};

export type StudentClearanceSummary = {
  totalClearances: number;
  pendingCount: number;
  clearedCount: number;
  waivedCount: number;
  totalOutstanding: number;
  clearances: ClearanceListItem[];
};

// ─── Clearance Queries ────────────────────────────────────────────────────────

/**
 * Get paginated list of clearances
 */
export async function getClearances(
  params: PaginationParams,
  filters?: {
    status?: ClearanceStatus;
    clearanceType?: ClearanceType;
    schoolYearId?: string;
    studentId?: string;
  }
): Promise<PaginatedResult<ClearanceListItem>> {
  const offset = calculateOffset(params.page, params.pageSize);

  // Build conditions
  const conditions = [isNull(studentClearances.deletedAt)];

  if (filters?.status) {
    conditions.push(eq(studentClearances.status, filters.status));
  }

  if (filters?.clearanceType) {
    conditions.push(eq(studentClearances.clearanceType, filters.clearanceType));
  }

  if (filters?.schoolYearId) {
    conditions.push(eq(studentClearances.schoolYearId, filters.schoolYearId));
  }

  if (filters?.studentId) {
    conditions.push(eq(studentClearances.studentId, filters.studentId));
  }

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(studentClearances)
    .where(and(...conditions));

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data
  const rows = await db
    .select({
      id: studentClearances.id,
      studentId: studentClearances.studentId,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      enrollmentId: studentClearances.enrollmentId,
      schoolYearId: studentClearances.schoolYearId,
      clearanceType: studentClearances.clearanceType,
      outstandingAmount: studentClearances.outstandingAmount,
      status: studentClearances.status,
      resolutionType: studentClearances.resolutionType,
      resolvedAt: studentClearances.resolvedAt,
      resolvedBy: studentClearances.resolvedBy,
      createdAt: studentClearances.createdAt,
    })
    .from(studentClearances)
    .innerJoin(students, eq(studentClearances.studentId, students.id))
    .where(and(...conditions))
    .orderBy(desc(studentClearances.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  // Collect IDs for parallel queries
  const enrollmentIds = rows.filter((r) => r.enrollmentId).map((r) => r.enrollmentId!);
  const schoolYearIds = rows
    .filter((r) => r.schoolYearId && !r.enrollmentId)
    .map((r) => r.schoolYearId!);
  const resolvedByIds = rows.filter((r) => r.resolvedBy).map((r) => r.resolvedBy!);

  // Run all lookup queries in parallel for better performance
  const [enrollmentInfo, syInfo, usersData] = await Promise.all([
    // Get enrollment info for each clearance
    enrollmentIds.length > 0
      ? db
          .select({
            id: enrollments.id,
            gradeLevelName: gradeLevels.name,
            schoolYearLabel: schoolYears.label,
          })
          .from(enrollments)
          .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
          .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
          .where(inArray(enrollments.id, enrollmentIds))
      : Promise.resolve([]),

    // Get school year labels for clearances without enrollment
    schoolYearIds.length > 0
      ? db
          .select({ id: schoolYears.id, label: schoolYears.label })
          .from(schoolYears)
          .where(inArray(schoolYears.id, schoolYearIds))
      : Promise.resolve([]),

    // Get resolved by user names
    resolvedByIds.length > 0
      ? db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, resolvedByIds))
      : Promise.resolve([]),
  ]);

  // Build lookup maps from parallel query results
  const enrollmentInfoMap = new Map<
    string,
    { gradeLevelName: string; schoolYearLabel: string }
  >();
  enrollmentInfo.forEach((e) =>
    enrollmentInfoMap.set(e.id, {
      gradeLevelName: e.gradeLevelName,
      schoolYearLabel: e.schoolYearLabel,
    })
  );

  const schoolYearMap = new Map<string, string>();
  syInfo.forEach((sy) => schoolYearMap.set(sy.id, sy.label));

  const resolvedByMap = new Map<string, string>();
  usersData.forEach((u) => resolvedByMap.set(u.id, u.username));

  const data: ClearanceListItem[] = rows.map((r) => {
    const enrollmentInfo = r.enrollmentId ? enrollmentInfoMap.get(r.enrollmentId) : null;

    return {
      id: r.id,
      studentId: r.studentId,
      studentRef: r.studentRef,
      studentName: `${r.lastName}, ${r.firstName}`,
      enrollmentId: r.enrollmentId,
      gradeLevelName: enrollmentInfo?.gradeLevelName ?? null,
      schoolYearLabel:
        enrollmentInfo?.schoolYearLabel ??
        (r.schoolYearId ? schoolYearMap.get(r.schoolYearId) ?? null : null),
      clearanceType: r.clearanceType as ClearanceType,
      outstandingAmount: r.outstandingAmount,
      status: r.status as ClearanceStatus,
      resolutionType: r.resolutionType as ResolutionType | null,
      resolvedAt: r.resolvedAt,
      resolvedByName: r.resolvedBy ? resolvedByMap.get(r.resolvedBy) ?? "Unknown" : null,
      createdAt: r.createdAt,
    };
  });

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Aggregate counters for the clearances overview cards.
 * Computed in SQL to avoid loading all rows into memory.
 */
export async function getClearanceCounters(filters?: {
  schoolYearId?: string;
}): Promise<{
  pendingCount: number;
  clearedCount: number;
  waivedCount: number;
  totalRecords: number;
  totalPendingOutstanding: number;
}> {
  const conditions = [isNull(studentClearances.deletedAt)];
  if (filters?.schoolYearId) {
    conditions.push(eq(studentClearances.schoolYearId, filters.schoolYearId));
  }

  const [row] = await db
    .select({
      pendingCount: sql<number>`count(*) filter (where ${studentClearances.status} = 'pending')`,
      clearedCount: sql<number>`count(*) filter (where ${studentClearances.status} = 'cleared')`,
      waivedCount: sql<number>`count(*) filter (where ${studentClearances.status} = 'waived')`,
      totalRecords: sql<number>`count(*)`,
      totalPendingOutstanding: sql<string>`coalesce(sum(${studentClearances.outstandingAmount}) filter (where ${studentClearances.status} = 'pending'), 0)`,
    })
    .from(studentClearances)
    .where(and(...conditions));

  return {
    pendingCount: Number(row?.pendingCount ?? 0),
    clearedCount: Number(row?.clearedCount ?? 0),
    waivedCount: Number(row?.waivedCount ?? 0),
    totalRecords: Number(row?.totalRecords ?? 0),
    totalPendingOutstanding: Number(row?.totalPendingOutstanding ?? 0),
  };
}

/**
 * Get count of pending clearances (for badge display)
 */
export async function getPendingClearancesCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(studentClearances)
    .where(
      and(
        eq(studentClearances.status, "pending"),
        isNull(studentClearances.deletedAt)
      )
    );

  return Number(result?.count || 0);
}

/**
 * Get clearance by ID (for detail page)
 */
export async function getClearanceById(clearanceId: string): Promise<ClearanceDetail | null> {
  const startTime = Date.now();

  const [row] = await db
    .select({
      id: studentClearances.id,
      studentId: studentClearances.studentId,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      enrollmentId: studentClearances.enrollmentId,
      schoolYearId: studentClearances.schoolYearId,
      clearanceType: studentClearances.clearanceType,
      outstandingAmount: studentClearances.outstandingAmount,
      status: studentClearances.status,
      resolutionType: studentClearances.resolutionType,
      resolutionRemarks: studentClearances.resolutionRemarks,
      resolvedAt: studentClearances.resolvedAt,
      resolvedBy: studentClearances.resolvedBy,
      createdAt: studentClearances.createdAt,
      createdBy: studentClearances.createdBy,
    })
    .from(studentClearances)
    .innerJoin(students, eq(studentClearances.studentId, students.id))
    .where(
      and(eq(studentClearances.id, clearanceId), isNull(studentClearances.deletedAt))
    )
    .limit(1);

  if (!row) return null;

  const mainQueryTime = Date.now() - startTime;

  // Get enrollment info
  let gradeLevelName: string | null = null;
  let schoolYearLabel: string | null = null;

  const enrollmentQueryStart = Date.now();
  if (row.enrollmentId) {
    const [enrollmentInfo] = await db
      .select({
        gradeLevelName: gradeLevels.name,
        schoolYearLabel: schoolYears.label,
      })
      .from(enrollments)
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
      .where(eq(enrollments.id, row.enrollmentId))
      .limit(1);

    if (enrollmentInfo) {
      gradeLevelName = enrollmentInfo.gradeLevelName;
      schoolYearLabel = enrollmentInfo.schoolYearLabel;
    }
  } else if (row.schoolYearId) {
    const [sy] = await db
      .select({ label: schoolYears.label })
      .from(schoolYears)
      .where(eq(schoolYears.id, row.schoolYearId))
      .limit(1);

    if (sy) {
      schoolYearLabel = sy.label;
    }
  }
  const enrollmentQueryTime = Date.now() - enrollmentQueryStart;

  // Get user names
  const usersQueryStart = Date.now();
  const userIds = [row.createdBy, row.resolvedBy].filter(Boolean) as string[];
  const userNames = new Map<string, string>();

  if (userIds.length > 0) {
    const usersData = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, userIds));

    usersData.forEach((u) => userNames.set(u.id, u.username));
  }
  const usersQueryTime = Date.now() - usersQueryStart;

  const totalTime = Date.now() - startTime;
  console.log(`[PERF] getClearanceById: total=${totalTime}ms (main=${mainQueryTime}ms, enrollment/sy=${enrollmentQueryTime}ms, users=${usersQueryTime}ms)`);

  return {
    id: row.id,
    studentId: row.studentId,
    studentRef: row.studentRef,
    studentName: `${row.lastName}, ${row.firstName}`,
    enrollmentId: row.enrollmentId,
    gradeLevelName,
    schoolYearLabel,
    clearanceType: row.clearanceType as ClearanceType,
    outstandingAmount: row.outstandingAmount,
    status: row.status as ClearanceStatus,
    resolutionType: row.resolutionType as ResolutionType | null,
    resolutionRemarks: row.resolutionRemarks,
    resolvedAt: row.resolvedAt,
    resolvedByName: row.resolvedBy ? userNames.get(row.resolvedBy) ?? "Unknown" : null,
    createdAt: row.createdAt,
    createdByName: row.createdBy ? userNames.get(row.createdBy) ?? "Unknown" : null,
  };
}

/**
 * Check if a student has any pending clearances
 */
export async function hasPendingClearances(studentId: string): Promise<boolean> {
  const [result] = await db
    .select({ id: studentClearances.id })
    .from(studentClearances)
    .where(
      and(
        eq(studentClearances.studentId, studentId),
        eq(studentClearances.status, "pending"),
        isNull(studentClearances.deletedAt)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get pending clearances for a student (for document release check)
 */
export async function getPendingClearancesForStudent(
  studentId: string
): Promise<ClearanceListItem[]> {
  const result = await getClearances(
    { page: 1, pageSize: 100 },
    { studentId, status: "pending" }
  );

  return result.data;
}

/**
 * Get clearance summary for a student
 * Uses SQL aggregation for counts (faster than client-side filtering)
 */
export async function getStudentClearanceSummary(
  studentId: string
): Promise<StudentClearanceSummary> {
  const startTime = Date.now();

  // Run counts query and clearances fetch in parallel
  const [countsResult, allClearances] = await Promise.all([
    // SQL aggregation for counts and total outstanding
    db
      .select({
        totalCount: sql<number>`COUNT(*)`.mapWith(Number),
        pendingCount: sql<number>`COUNT(*) FILTER (WHERE ${studentClearances.status} = 'pending')`.mapWith(Number),
        clearedCount: sql<number>`COUNT(*) FILTER (WHERE ${studentClearances.status} = 'cleared')`.mapWith(Number),
        waivedCount: sql<number>`COUNT(*) FILTER (WHERE ${studentClearances.status} = 'waived')`.mapWith(Number),
        totalOutstanding: sql<number>`COALESCE(SUM(${studentClearances.outstandingAmount}) FILTER (WHERE ${studentClearances.status} = 'pending'), 0)`.mapWith(Number),
      })
      .from(studentClearances)
      .where(
        and(
          eq(studentClearances.studentId, studentId),
          isNull(studentClearances.deletedAt)
        )
      ),
    // Fetch clearances list
    getClearances({ page: 1, pageSize: 1000 }, { studentId }),
  ]);

  const counts = countsResult[0];
  const totalTime = Date.now() - startTime;
  console.log(`[PERF] getStudentClearanceSummary: total=${totalTime}ms (parallel queries, records=${allClearances.data.length})`);

  return {
    totalClearances: counts?.totalCount ?? 0,
    pendingCount: counts?.pendingCount ?? 0,
    clearedCount: counts?.clearedCount ?? 0,
    waivedCount: counts?.waivedCount ?? 0,
    totalOutstanding: counts?.totalOutstanding ?? 0,
    clearances: allClearances.data,
  };
}

/**
 * Get clearance for validation
 */
export async function getClearanceForValidation(clearanceId: string): Promise<{
  id: string;
  studentId: string;
  status: string;
  outstandingAmount: string;
} | null> {
  const [result] = await db
    .select({
      id: studentClearances.id,
      studentId: studentClearances.studentId,
      status: studentClearances.status,
      outstandingAmount: studentClearances.outstandingAmount,
    })
    .from(studentClearances)
    .where(
      and(eq(studentClearances.id, clearanceId), isNull(studentClearances.deletedAt))
    )
    .limit(1);

  return result ?? null;
}

/**
 * Check if clearance already exists for enrollment + type
 */
export async function clearanceExistsForEnrollment(
  enrollmentId: string,
  clearanceType: ClearanceType
): Promise<boolean> {
  const [result] = await db
    .select({ id: studentClearances.id })
    .from(studentClearances)
    .where(
      and(
        eq(studentClearances.enrollmentId, enrollmentId),
        eq(studentClearances.clearanceType, clearanceType),
        isNull(studentClearances.deletedAt)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Get enrollments with outstanding balance for a school year (for batch EOY clearance)
 */
export async function getEnrollmentsWithBalance(schoolYearId: string): Promise<
  Array<{
    enrollmentId: string;
    studentId: string;
    balance: string;
  }>
> {
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: enrollments.studentId,
      balance: assessments.balance,
    })
    .from(enrollments)
    .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled"),
        isNull(assessments.cancelledAt),
        sql`${assessments.balance} > 0.01`
      )
    );

  return rows;
}
