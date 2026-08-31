/**
 * Archive Queries
 *
 * Database queries for the archive directory and related data.
 */

import "server-only";
import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  gradeLevels,
  payments,
  schoolYears,
  studentDiscounts,
  students,
} from "@/lib/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNull,
  ne,
  or,
  sql,
  sum,
} from "drizzle-orm";
import {
  STUDENT_STATUSES,
  type StudentStatus,
} from "@/lib/constants/student-status";
import type { ArchiveFilterInput, ArchiveSummary } from "./archive.schema";

export const ARCHIVE_DIRECTORY_PAGE_SIZE = 20;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ArchivedStudentRow = {
  id: string;
  referenceNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  isSpecialEducation: boolean;
  hasEscDiscount: boolean;
  status: StudentStatus;
  archivedAt: Date | null;
  archiveReason: string | null;
  archivedSchoolYearLabel: string | null;
  outstandingBalance: string;
  lastEnrollmentGradeLevel: string | null;
  lastEnrollmentSchoolYear: string | null;
};

export type ArchiveSchoolYearOption = { id: string; label: string; isActive: boolean };

// ─── Queries ────────────────────────────────────────────────────────────────

/**
 * Fetch paginated list of archived students
 */
export async function fetchArchivedStudentsPage(
  params: ArchiveFilterInput
): Promise<{
  rows: ArchivedStudentRow[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  schoolYearOptions: ArchiveSchoolYearOption[];
}> {
  const currentPage = Math.max(1, params.page);
  const pageSize = params.pageSize || ARCHIVE_DIRECTORY_PAGE_SIZE;
  const offset = (currentPage - 1) * pageSize;

  // Build filter conditions
  const conditions: ReturnType<typeof eq>[] = [
    isNull(students.deletedAt),
    ne(students.status, "active"),
  ];

  // archiveFilterSchema rejects "active", so params.status is archive-only here.
  if (params.status) {
    conditions.push(eq(students.status, params.status as StudentStatus));
  }

  if (params.schoolYearId) {
    conditions.push(eq(students.archivedSchoolYearId, params.schoolYearId));
  }

  if (params.search?.trim()) {
    const searchTerm = params.search.trim();
    conditions.push(
      or(
        ilike(students.firstName, `%${searchTerm}%`),
        ilike(students.lastName, `%${searchTerm}%`),
        ilike(students.referenceNumber, `%${searchTerm}%`)
      )!
    );
  }

  const whereClause = and(...conditions);

  // Subquery for outstanding balance
  const balanceSubquery = db
    .select({
      studentId: assessments.studentId,
      totalBalance: sum(assessments.balance).as("total_balance"),
    })
    .from(assessments)
    .where(
      and(
        eq(assessments.billingStatus, "outstanding"),
        isNull(assessments.cancelledAt)
      )
    )
    .groupBy(assessments.studentId)
    .as("balance_sq");

  // Subquery for last enrollment info.
  // DISTINCT ON (student_id) guarantees exactly one row per student — the most
  // recent non-cancelled enrollment — so the join below cannot duplicate a
  // student's archive row or cause a list/count pagination mismatch.
  const lastEnrollmentSubquery = db
    .selectDistinctOn([enrollments.studentId], {
      studentId: enrollments.studentId,
      gradeLevelId: enrollments.gradeLevelId,
      schoolYearId: enrollments.schoolYearId,
    })
    .from(enrollments)
    .where(
      and(
        ne(enrollments.status, "cancelled"),
        isNull(enrollments.cancelledAt)
      )
    )
    .orderBy(asc(enrollments.studentId), desc(enrollments.createdAt))
    .as("last_enrollment_sq");

  const [schoolYearOptions, listRows, countResult] = await Promise.all([
    // School year options for filter dropdown
    db
      .select({ id: schoolYears.id, label: schoolYears.label, isActive: schoolYears.isActive })
      .from(schoolYears)
      .where(isNull(schoolYears.deletedAt))
      .orderBy(desc(schoolYears.startDate)),

    // Main query with joins
    db
      .select({
        id: students.id,
        referenceNumber: students.referenceNumber,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        suffix: students.suffix,
        isSpecialEducation: students.isSpecialEducation,
        hasEscDiscount: sql<boolean>`EXISTS(
          SELECT 1 FROM "discount_requests" dr
          INNER JOIN "discount_types" dt ON dr.discount_type_id = dt.id
          INNER JOIN "enrollments" e2 ON dr.enrollment_id = e2.id
          WHERE e2.student_id = "students".id
            AND dt.code LIKE 'ESC_%'
            AND dr.status = 'approved'
        )`.as("has_esc_discount"),
        status: students.status,
        archivedAt: students.archivedAt,
        archiveReason: students.archiveReason,
        archivedSchoolYearLabel: sql<string | null>`archived_sy.label`.as(
          "archived_school_year_label"
        ),
        outstandingBalance: sql<string>`COALESCE(${balanceSubquery.totalBalance}, '0')`.as(
          "outstanding_balance"
        ),
        lastEnrollmentGradeLevel: sql<string | null>`last_gl.name`.as(
          "last_enrollment_grade_level"
        ),
        lastEnrollmentSchoolYear: sql<string | null>`last_sy.label`.as(
          "last_enrollment_school_year"
        ),
      })
      .from(students)
      .leftJoin(
        sql`${schoolYears} AS archived_sy`,
        eq(students.archivedSchoolYearId, sql`archived_sy.id`)
      )
      .leftJoin(balanceSubquery, eq(students.id, balanceSubquery.studentId))
      .leftJoin(
        lastEnrollmentSubquery,
        eq(students.id, lastEnrollmentSubquery.studentId)
      )
      .leftJoin(
        sql`${gradeLevels} AS last_gl`,
        eq(lastEnrollmentSubquery.gradeLevelId, sql`last_gl.id`)
      )
      .leftJoin(
        sql`${schoolYears} AS last_sy`,
        eq(lastEnrollmentSubquery.schoolYearId, sql`last_sy.id`)
      )
      .where(whereClause)
      .orderBy(desc(students.archivedAt), asc(students.lastName))
      .limit(pageSize)
      .offset(offset),

    // Count query
    db
      .select({ count: count() })
      .from(students)
      .where(whereClause),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    rows: listRows as ArchivedStudentRow[],
    totalCount,
    totalPages,
    currentPage,
    schoolYearOptions,
  };
}

/**
 * Get archive summary statistics
 */
export async function getArchiveSummary(): Promise<ArchiveSummary> {
  // Count by status
  const statusCounts = await db
    .select({
      status: students.status,
      count: count(),
    })
    .from(students)
    .where(and(isNull(students.deletedAt), ne(students.status, "active")))
    .groupBy(students.status);

  // Count by school year
  const schoolYearCounts = await db
    .select({
      schoolYearId: students.archivedSchoolYearId,
      schoolYearLabel: schoolYears.label,
      count: count(),
    })
    .from(students)
    .leftJoin(schoolYears, eq(students.archivedSchoolYearId, schoolYears.id))
    .where(and(isNull(students.deletedAt), ne(students.status, "active")))
    .groupBy(students.archivedSchoolYearId, schoolYears.label);

  // Build by-status map
  const byStatus = {} as Record<StudentStatus, number>;
  for (const status of STUDENT_STATUSES) {
    byStatus[status] = 0;
  }
  let total = 0;
  for (const row of statusCounts) {
    byStatus[row.status as StudentStatus] = row.count;
    total += row.count;
  }

  // Build by-school-year array
  const bySchoolYear = schoolYearCounts
    .filter((row) => row.schoolYearId !== null)
    .map((row) => ({
      schoolYearId: row.schoolYearId!,
      schoolYearLabel: row.schoolYearLabel ?? "Unknown",
      count: row.count,
    }));

  return {
    total,
    byStatus,
    bySchoolYear,
  };
}

/**
 * Get a single archived student by ID with full details.
 * Note: Does NOT filter by status so the page can handle redirects for restored students.
 */
export async function getArchivedStudent(studentId: string) {
  const [student] = await db
    .select({
      id: students.id,
      referenceNumber: students.referenceNumber,
      lrn: students.lrn,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      suffix: students.suffix,
      dateOfBirth: students.dateOfBirth,
      gender: students.gender,
      address: students.address,
      mobileNumber: students.mobileNumber,
      email: students.email,
      status: students.status,
      archivedAt: students.archivedAt,
      archiveReason: students.archiveReason,
      archivedSchoolYearId: students.archivedSchoolYearId,
      archivedSchoolYearLabel: schoolYears.label,
      createdAt: students.createdAt,
    })
    .from(students)
    .leftJoin(schoolYears, eq(students.archivedSchoolYearId, schoolYears.id))
    .where(
      and(
        eq(students.id, studentId),
        isNull(students.deletedAt),
      ),
    );

  return student ?? null;
}

/**
 * Get candidates for batch graduation archive
 * Returns students enrolled in the specified grade level during the specified school year
 */
export async function getGraduationCandidates(
  schoolYearId: string,
  gradeLevelId?: string
): Promise<
  Array<{
    studentId: string;
    referenceNumber: string;
    firstName: string;
    lastName: string;
    gradeLevelName: string;
    enrollmentStatus: string;
  }>
> {
  // If no grade level specified, get the highest grade level (Grade 12 / SHS)
  let targetGradeLevelId = gradeLevelId;
  if (!targetGradeLevelId) {
    const [highestGrade] = await db
      .select({ id: gradeLevels.id })
      .from(gradeLevels)
      .orderBy(desc(gradeLevels.order))
      .limit(1);
    targetGradeLevelId = highestGrade?.id;
  }

  if (!targetGradeLevelId) {
    return [];
  }

  const candidates = await db
    .select({
      studentId: students.id,
      referenceNumber: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelName: gradeLevels.name,
      enrollmentStatus: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.gradeLevelId, targetGradeLevelId),
        eq(enrollments.status, "enrolled"),
        eq(students.status, "active"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return candidates;
}

/**
 * Get candidates for batch no-show cancellation
 * Returns enrollments that were created but never received any payment.
 * Includes:
 * - Pending enrollments (registered but never assessed)
 * - Assessed enrollments with $0 paid
 */
export async function getNoShowCandidates(schoolYearId: string): Promise<
  Array<{
    enrollmentId: string;
    studentId: string;
    referenceNumber: string;
    firstName: string;
    lastName: string;
    gradeLevelName: string;
    enrollmentStatus: "pending" | "assessed";
    assessmentId: string | null;
    totalAmount: string | null;
  }>
> {
  const candidates = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      referenceNumber: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelName: gradeLevels.name,
      enrollmentStatus: enrollments.status,
      assessmentId: assessments.id,
      totalAmount: assessments.totalAmount,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(
      assessments,
      and(
        eq(assessments.enrollmentId, enrollments.id),
        isNull(assessments.cancelledAt)
      )
    )
    .where(
      and(
        eq(enrollments.schoolYearId, schoolYearId),
        // Include both pending and assessed (with no payment)
        or(
          // Pending enrollments (never assessed)
          eq(enrollments.status, "pending"),
          // Assessed enrollments with $0 paid
          and(
            eq(enrollments.status, "assessed"),
            eq(assessments.totalPaid, "0")
          )
        ),
        eq(students.status, "active"),
        isNull(students.deletedAt)
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return candidates as Array<{
    enrollmentId: string;
    studentId: string;
    referenceNumber: string;
    firstName: string;
    lastName: string;
    gradeLevelName: string;
    enrollmentStatus: "pending" | "assessed";
    assessmentId: string | null;
    totalAmount: string | null;
  }>;
}

/**
 * Get candidates for batch archive of non-returning students
 * Returns active students who were enrolled in the previous school year
 * but have NO enrollment in the current school year.
 */
export async function getNonReturningStudents(
  previousSchoolYearId: string,
  currentSchoolYearId: string
): Promise<
  Array<{
    studentId: string;
    referenceNumber: string;
    firstName: string;
    lastName: string;
    gradeLevelName: string;
    lastEnrollmentStatus: string;
  }>
> {
  // Subquery: students who have an enrollment in the current school year
  const studentsInCurrentYear = db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, currentSchoolYearId),
        ne(enrollments.status, "cancelled")
      )
    );

  // Main query: find students enrolled in previous year but NOT in current year
  const candidates = await db
    .select({
      studentId: students.id,
      referenceNumber: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelName: gradeLevels.name,
      lastEnrollmentStatus: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        // Was enrolled in previous school year
        eq(enrollments.schoolYearId, previousSchoolYearId),
        // With a non-cancelled enrollment
        ne(enrollments.status, "cancelled"),
        // Student is currently active
        eq(students.status, "active"),
        isNull(students.deletedAt),
        // NOT in current school year (using NOT IN subquery)
        sql`${students.id} NOT IN (${studentsInCurrentYear})`
      )
    )
    .orderBy(asc(students.lastName), asc(students.firstName));

  return candidates;
}

/**
 * Fetch active (non-deleted) school year options for archive filters and batch dialogs.
 * Ordered by most recent start date first.
 */
export async function getArchiveSchoolYearOptions(): Promise<
  Array<{ id: string; label: string; isActive: boolean }>
> {
  return db
    .select({ id: schoolYears.id, label: schoolYears.label, isActive: schoolYears.isActive })
    .from(schoolYears)
    .where(isNull(schoolYears.deletedAt))
    .orderBy(desc(schoolYears.startDate));
}

/**
 * Fetch grade level options for archive batch dialogs, ordered by grade order.
 * `gradeLevels` is a static reference table with no soft-delete column.
 */
export async function getArchiveGradeLevelOptions(): Promise<
  Array<{ id: string; name: string }>
> {
  return db
    .select({ id: gradeLevels.id, name: gradeLevels.name })
    .from(gradeLevels)
    .orderBy(asc(gradeLevels.order));
}

/**
 * Fetch a student's recent enrollment history (most recent school years first)
 * for the archived-student detail page.
 */
export async function getStudentEnrollmentHistory(studentId: string) {
  return db
    .select({
      id: enrollments.id,
      status: enrollments.status,
      schoolYearLabel: schoolYears.label,
      gradeLevelName: gradeLevels.name,
      enrolledAt: enrollments.enrolledAt,
      cancelledAt: enrollments.cancelledAt,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(enrollments.studentId, studentId))
    .orderBy(desc(schoolYears.startDate))
    .limit(10);
}

/**
 * Sum a student's outstanding (non-cancelled) assessment balances.
 * Returns the raw decimal string total, or "0" when none.
 */
export async function getStudentOutstandingBalanceTotal(
  studentId: string
): Promise<string> {
  const [result] = await db
    .select({ total: sum(assessments.balance) })
    .from(assessments)
    .where(
      and(
        eq(assessments.studentId, studentId),
        eq(assessments.billingStatus, "outstanding"),
        isNull(assessments.cancelledAt)
      )
    );

  return result?.total ?? "0";
}

/**
 * Fetch a student's most recent non-reversed payments for the archived-student
 * detail page. (`payments` has no soft-delete column; reversed payments are
 * excluded via status.)
 */
export async function getStudentRecentPayments(studentId: string) {
  return db
    .select({
      id: payments.id,
      orNumber: payments.orNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      status: payments.status,
    })
    .from(payments)
    .where(and(eq(payments.studentId, studentId), ne(payments.status, "reversed")))
    .orderBy(desc(payments.paymentDate))
    .limit(5);
}

/**
 * Check if a student has any valid enrollment history (for document request eligibility).
 *
 * A student has "valid enrollment" if they have at least one enrollment that:
 * - Has status = 'enrolled' (first payment automatically transitions assessed → enrolled), OR
 * - Has an associated assessment with totalPaid > 0
 *
 * This is used to determine if archived students can create document requests.
 * Students with only pending enrollments, assessed enrollments with no payment,
 * or no enrollments at all are NOT eligible.
 */
export async function hasValidEnrollmentHistory(
  studentId: string
): Promise<boolean> {
  // Query for any enrollment that is either:
  // 1. Already enrolled status, OR
  // 2. Has an assessment with some payment (totalPaid > 0)
  const [result] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .leftJoin(
      assessments,
      and(
        eq(assessments.enrollmentId, enrollments.id),
        isNull(assessments.cancelledAt)
      )
    )
    .where(
      and(
        eq(enrollments.studentId, studentId),
        isNull(enrollments.cancelledAt),
        or(
          eq(enrollments.status, "enrolled"),
          sql`(${assessments.totalPaid} IS NOT NULL AND CAST(${assessments.totalPaid} AS DECIMAL) > 0)`
        )
      )
    )
    .limit(1);

  return !!result;
}
