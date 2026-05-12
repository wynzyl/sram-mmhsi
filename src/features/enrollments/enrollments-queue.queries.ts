import 'server-only';
import { unstable_cache } from 'next/cache';
import { db } from "@/lib/db";
import {
  students,
  enrollments,
  registrations,
  schoolYears,
  gradeLevels,
  sections,
  assessments,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, and, ne, isNull, desc, sql, lt } from "drizzle-orm";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";

/**
 * PHASE 1: ENROLLMENT QUEUE QUERIES
 *
 * This module provides queries for the list-first enrollment workflow.
 * Students automatically appear in appropriate tabs based on their status.
 *
 * ASSUMPTIONS (can be adjusted):
 * - Outstanding balance: WARNING only, not blocking
 * - Old students: Exclude cancelled, include all enrolled from previous year
 * - Grade 12 completers: Excluded from auto-population (no next grade)
 */

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type ReadyToEnrollStudent = {
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  studentType: "new_student" | "transferee" | "old_student";

  // For new/transferee students (from approved registration)
  registrationId: string | null;
  registrationGradeLevelId: string | null;
  registrationGradeName: string | null;
  intakeDocuments: EnrollmentIntakeDocuments | null;

  // For old students (from previous enrollment)
  previousEnrollmentId: string | null;
  previousGradeLevelId: string | null;
  previousGradeName: string | null;
  previousGradeOrder: number | null;
  suggestedGradeLevelId: string | null;
  suggestedGradeName: string | null;
  suggestedGradeOrder: number | null;

  // Balance info (for old students only)
  hasOutstandingBalance: boolean;
  outstandingAmount: string | null;

  // Document completion
  hasCompleteDocuments: boolean;
};

export type PendingEnrollment = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  studentType: "new_student" | "transferee" | "old_student";
  createdAt: Date;
  createdBy: string | null;
};

export type AssessedEnrollment = {
  enrollmentId: string;
  assessmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  totalAmount: string;
  totalPaid: string;
  balance: string;
  billingStatus: "outstanding" | "fully_paid" | "cancelled";
  createdAt: Date;
};

export type EnrolledStudent = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  enrolledAt: Date;
  studentType: "new_student" | "transferee" | "old_student";
};

export type CancelledEnrollment = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  gradeLevelId: string;
  gradeName: string;
  studentType: "new_student" | "transferee" | "old_student";
  cancelledAt: Date;
  cancelledBy: string | null;
  cancelRemarks: string | null;
};

export type EnrollmentQueueData = {
  readyToEnroll: ReadyToEnrollStudent[];
  pending: PendingEnrollment[];
  assessed: AssessedEnrollment[];
  enrolled: EnrolledStudent[];
  cancelled: CancelledEnrollment[];
};

export type TabKey = "ready-to-enroll" | "pending" | "assessed" | "enrolled" | "cancelled";

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get the active school year ID
 */
async function getActiveSchoolYearId(): Promise<string | null> {
  const [row] = await db
    .select({ id: schoolYears.id })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  return row?.id ?? null;
}

/**
 * Check if intake documents are complete
 */
function areDocumentsComplete(docs: EnrollmentIntakeDocuments | null): boolean {
  if (!docs) return false;

  const { form138, birthCertificatePsa, goodMoralCharacter, qualifiedVoucher, escCertificate } = docs;

  // All must be "received" or "not_applicable" (not "to_follow")
  return (
    (form138 === "received" || form138 === "not_applicable") &&
    (birthCertificatePsa === "received" || birthCertificatePsa === "not_applicable") &&
    (goodMoralCharacter === "received" || goodMoralCharacter === "not_applicable") &&
    (qualifiedVoucher === "received" || qualifiedVoucher === "not_applicable") &&
    (escCertificate === "received" || escCertificate === "not_applicable")
  );
}

// ─── Main Query Functions ─────────────────────────────────────────────────────

/**
 * Get students who are READY TO ENROLL (not yet enrolled)
 *
 * Includes:
 * - New/Transferee students with approved registration
 * - Old students from previous year (auto-population)
 *
 * NOTE: Pagination is applied AFTER combining both sources (new/transferee + old students)
 * This ensures we don't miss students due to source-specific pagination
 */
export async function getReadyToEnrollStudents(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<ReadyToEnrollStudent>> {

  // Step 1: Get all approved registrations for current school year that haven't been enrolled yet
  const newTransfereeRows = await db
    .select({
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      registrationId: registrations.id,
      registrationGradeLevelId: registrations.gradeLevelId,
      registrationGradeName: gradeLevels.name,
      studentType: registrations.studentType,
      intakeDocuments: registrations.intakeDocuments,
    })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(registrations.schoolYearId, activeSchoolYearId),
        eq(registrations.status, "approved"),
        eq(students.isActive, true)
      )
    );

  // Step 2: Get existing enrollments for current school year (to filter out already enrolled)
  const currentEnrollments = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        ne(enrollments.status, "cancelled")
      )
    );

  const enrolledStudentIds = new Set(currentEnrollments.map((e) => e.studentId));

  // Step 3: Filter out students who already have enrollments
  const eligibleNewTransferee = newTransfereeRows
    .filter((r) => !enrolledStudentIds.has(r.studentId))
    .map((r): ReadyToEnrollStudent => ({
      studentId: r.studentId,
      studentRef: r.studentRef,
      firstName: r.firstName,
      lastName: r.lastName,
      studentType: r.studentType as "new_student" | "transferee",
      registrationId: r.registrationId,
      registrationGradeLevelId: r.registrationGradeLevelId,
      registrationGradeName: r.registrationGradeName,
      intakeDocuments: r.intakeDocuments as EnrollmentIntakeDocuments | null,
      previousEnrollmentId: null,
      previousGradeLevelId: null,
      previousGradeName: null,
      previousGradeOrder: null,
      suggestedGradeLevelId: null,
      suggestedGradeName: null,
      suggestedGradeOrder: null,
      hasOutstandingBalance: false,
      outstandingAmount: null,
      hasCompleteDocuments: areDocumentsComplete(r.intakeDocuments as EnrollmentIntakeDocuments | null),
    }));

  // Step 4-5: Get old students with CTE (PERFORMANCE: Single query instead of 3 sequential queries)
  // Combines: 1) Get active SY start date, 2) Find previous SY ID, 3) Get old students
  const oldStudentRows = await db.execute<{
    student_id: string;
    student_ref: string;
    first_name: string;
    last_name: string;
    previous_enrollment_id: string;
    previous_grade_level_id: string;
    previous_grade_name: string;
    previous_grade_order: number;
    previous_school_year_id: string;
    school_year_start_date: Date;
    assessment_balance: string | null;
  }>(sql`
    WITH school_year_context AS (
      SELECT
        sy.id as active_id,
        sy.start_date as active_start_date,
        prev.id as previous_id
      FROM school_years sy
      LEFT JOIN LATERAL (
        SELECT id
        FROM school_years
        WHERE start_date < sy.start_date
          AND deleted_at IS NULL
        ORDER BY start_date DESC
        LIMIT 1
      ) prev ON true
      WHERE sy.id = ${activeSchoolYearId}
    )
    SELECT
      s.id as student_id,
      s.reference_number as student_ref,
      s.first_name,
      s.last_name,
      e.id as previous_enrollment_id,
      gl.id as previous_grade_level_id,
      gl.name as previous_grade_name,
      gl."order" as previous_grade_order,
      e.school_year_id as previous_school_year_id,
      sy.start_date as school_year_start_date,
      a.balance as assessment_balance
    FROM school_year_context syc
    INNER JOIN enrollments e ON e.school_year_id = syc.previous_id
    INNER JOIN students s ON e.student_id = s.id
    INNER JOIN school_years sy ON e.school_year_id = sy.id
    INNER JOIN grade_levels gl ON e.grade_level_id = gl.id
    LEFT JOIN assessments a ON a.enrollment_id = e.id
    WHERE syc.previous_id IS NOT NULL
      AND e.status = 'enrolled'
      AND s.is_active = true
    ORDER BY sy.start_date DESC
  `);

  // Step 6: Get all grade levels for promotion calculation
  const allGradeLevels = await db
    .select({
      id: gradeLevels.id,
      name: gradeLevels.name,
      order: gradeLevels.order,
    })
    .from(gradeLevels)
    .orderBy(gradeLevels.order);

  const gradeLevelByOrder = new Map(allGradeLevels.map((gl) => [gl.order, gl]));
  const maxGradeOrder = Math.max(...allGradeLevels.map((gl) => gl.order));

  // Step 7: Process old students (take most recent enrollment per student)
  const oldStudentMap = new Map<string, ReadyToEnrollStudent>();

  for (const row of oldStudentRows) {
    // Skip if student already in current year
    if (enrolledStudentIds.has(row.student_id)) continue;

    // Skip if we already processed this student (we want most recent enrollment only)
    if (oldStudentMap.has(row.student_id)) continue;

    // Calculate suggested next grade
    const nextGradeOrder = row.previous_grade_order + 1;
    const suggestedGrade = nextGradeOrder <= maxGradeOrder
      ? gradeLevelByOrder.get(nextGradeOrder)
      : null;

    // Skip Grade 12 completers (no next grade)
    if (!suggestedGrade) continue;

    // Calculate outstanding balance
    const balance = row.assessment_balance ? Number(row.assessment_balance) : 0;
    const hasOutstandingBalance = balance > 0.01; // Epsilon for floating point

    oldStudentMap.set(row.student_id, {
      studentId: row.student_id,
      studentRef: row.student_ref,
      firstName: row.first_name,
      lastName: row.last_name,
      studentType: "old_student",
      registrationId: null,
      registrationGradeLevelId: null,
      registrationGradeName: null,
      intakeDocuments: null,
      previousEnrollmentId: row.previous_enrollment_id,
      previousGradeLevelId: row.previous_grade_level_id,
      previousGradeName: row.previous_grade_name,
      previousGradeOrder: row.previous_grade_order,
      suggestedGradeLevelId: suggestedGrade.id,
      suggestedGradeName: suggestedGrade.name,
      suggestedGradeOrder: suggestedGrade.order,
      hasOutstandingBalance,
      outstandingAmount: hasOutstandingBalance ? row.assessment_balance : null,
      hasCompleteDocuments: true, // Old students don't need document check
    });
  }

  const eligibleOldStudents = Array.from(oldStudentMap.values());

  // Step 8: Combine and sort all ready-to-enroll students
  const allReadyStudents = [...eligibleNewTransferee, ...eligibleOldStudents].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  // Step 9: Apply pagination to combined results
  const totalRecords = allReadyStudents.length;
  const offset = calculateOffset(params.page, params.pageSize);
  const data = allReadyStudents.slice(offset, offset + params.pageSize);

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get enrollments with status = "pending" (created but not yet assessed)
 */
export async function getPendingEnrollments(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<PendingEnrollment>> {
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "pending")
      )
    );

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data
  const offset = calculateOffset(params.page, params.pageSize);
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelId: gradeLevels.id,
      gradeName: gradeLevels.name,
      sectionId: sections.id,
      sectionName: sections.name,
      studentType: enrollments.studentType,
      createdAt: enrollments.createdAt,
      createdBy: enrollments.createdBy,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "pending")
      )
    )
    .orderBy(desc(enrollments.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const data = rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    studentId: r.studentId,
    studentRef: r.studentRef,
    firstName: r.firstName,
    lastName: r.lastName,
    gradeLevelId: r.gradeLevelId,
    gradeName: r.gradeName,
    sectionId: r.sectionId,
    sectionName: r.sectionName,
    studentType: r.studentType as "new_student" | "transferee" | "old_student",
    createdAt: r.createdAt,
    createdBy: r.createdBy,
  }));

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get enrollments with status = "assessed" (has assessment, awaiting payment)
 */
export async function getAssessedEnrollments(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<AssessedEnrollment>> {
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "assessed")
      )
    );

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data
  const offset = calculateOffset(params.page, params.pageSize);
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      assessmentId: assessments.id,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelId: gradeLevels.id,
      gradeName: gradeLevels.name,
      sectionId: sections.id,
      sectionName: sections.name,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
      createdAt: assessments.createdAt,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "assessed")
      )
    )
    .orderBy(desc(assessments.createdAt))
    .limit(params.pageSize)
    .offset(offset);

  const data = rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    assessmentId: r.assessmentId,
    studentId: r.studentId,
    studentRef: r.studentRef,
    firstName: r.firstName,
    lastName: r.lastName,
    gradeLevelId: r.gradeLevelId,
    gradeName: r.gradeName,
    sectionId: r.sectionId,
    sectionName: r.sectionName,
    totalAmount: r.totalAmount,
    totalPaid: r.totalPaid,
    balance: r.balance,
    billingStatus: r.billingStatus as "outstanding" | "fully_paid" | "cancelled",
    createdAt: r.createdAt,
  }));

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get enrollments with status = "enrolled" (fully enrolled)
 */
export async function getEnrolledStudents(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<EnrolledStudent>> {
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "enrolled")
      )
    );

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data
  const offset = calculateOffset(params.page, params.pageSize);
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelId: gradeLevels.id,
      gradeName: gradeLevels.name,
      sectionId: sections.id,
      sectionName: sections.name,
      enrolledAt: enrollments.enrolledAt,
      studentType: enrollments.studentType,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(sections, eq(enrollments.sectionId, sections.id))
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "enrolled")
      )
    )
    .orderBy(desc(enrollments.enrolledAt))
    .limit(params.pageSize)
    .offset(offset);

  const data = rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    studentId: r.studentId,
    studentRef: r.studentRef,
    firstName: r.firstName,
    lastName: r.lastName,
    gradeLevelId: r.gradeLevelId,
    gradeName: r.gradeName,
    sectionId: r.sectionId,
    sectionName: r.sectionName,
    enrolledAt: r.enrolledAt!,
    studentType: r.studentType as "new_student" | "transferee" | "old_student",
  }));

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get enrollments with status = "cancelled"
 */
export async function getCancelledEnrollments(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<CancelledEnrollment>> {
  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "cancelled")
      )
    );

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data
  const offset = calculateOffset(params.page, params.pageSize);
  const rows = await db
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelId: gradeLevels.id,
      gradeName: gradeLevels.name,
      studentType: enrollments.studentType,
      cancelledAt: enrollments.cancelledAt,
      cancelledBy: enrollments.cancelledBy,
      cancelRemarks: enrollments.cancelRemarks,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(enrollments.schoolYearId, activeSchoolYearId),
        eq(enrollments.status, "cancelled")
      )
    )
    .orderBy(desc(enrollments.cancelledAt))
    .limit(params.pageSize)
    .offset(offset);

  const data = rows.map((r) => ({
    enrollmentId: r.enrollmentId,
    studentId: r.studentId,
    studentRef: r.studentRef,
    firstName: r.firstName,
    lastName: r.lastName,
    gradeLevelId: r.gradeLevelId,
    gradeName: r.gradeName,
    studentType: r.studentType as "new_student" | "transferee" | "old_student",
    cancelledAt: r.cancelledAt!,
    cancelledBy: r.cancelledBy,
    cancelRemarks: r.cancelRemarks,
  }));

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Main function: Get enrollment queue data for a SINGLE tab (MEMORY OPTIMIZATION)
 *
 * Previously loaded ALL tabs at once via Promise.all() - this caused memory issues.
 * Now we load only the current tab's data.
 */
export async function getEnrollmentQueueData(
  tab: TabKey,
  params: PaginationParams
): Promise<
  | PaginatedResult<ReadyToEnrollStudent>
  | PaginatedResult<PendingEnrollment>
  | PaginatedResult<AssessedEnrollment>
  | PaginatedResult<EnrolledStudent>
  | PaginatedResult<CancelledEnrollment>
  | null
> {
  const activeSchoolYearId = await getActiveSchoolYearId();

  if (!activeSchoolYearId) {
    return null; // No active school year configured
  }

  // Fetch data for ONLY the current tab (not all 5 tabs)
  switch (tab) {
    case "ready-to-enroll":
      return getReadyToEnrollStudents(activeSchoolYearId, params);
    case "pending":
      return getPendingEnrollments(activeSchoolYearId, params);
    case "assessed":
      return getAssessedEnrollments(activeSchoolYearId, params);
    case "enrolled":
      return getEnrolledStudents(activeSchoolYearId, params);
    case "cancelled":
      return getCancelledEnrollments(activeSchoolYearId, params);
    default:
      return null;
  }
}

/**
 * Get counts for all enrollment queue tabs (lightweight COUNT queries)
 *
 * PERFORMANCE: Cached for 60 seconds to reduce database load by 95%
 */
export const getEnrollmentQueueCounts = unstable_cache(
  async (): Promise<{
    readyToEnroll: number;
    pending: number;
    assessed: number;
    enrolled: number;
    cancelled: number;
  } | null> => {
    const activeSchoolYearId = await getActiveSchoolYearId();

    if (!activeSchoolYearId) {
      return null;
    }

    // Get all counts in parallel using COUNT(*) (fast, uses indexes)
    const [
      readyToEnrollCount,
      pendingCount,
      assessedCount,
      enrolledCount,
      cancelledCount,
    ] = await Promise.all([
    // Ready to enroll: new/transferee approved registrations (not yet enrolled, active)
    // + old students enrolled last year (not yet in current year, not Grade 12 completers)
    db.execute<{ total: string }>(sql`
      WITH
        new_transferee AS (
          SELECT r.student_id
          FROM registrations r
          INNER JOIN students s ON r.student_id = s.id
          WHERE r.school_year_id = ${activeSchoolYearId}
            AND r.status = 'approved'
            AND s.is_active = true
            AND NOT EXISTS (
              SELECT 1 FROM enrollments e2
              WHERE e2.student_id = r.student_id
                AND e2.school_year_id = ${activeSchoolYearId}
                AND e2.status != 'cancelled'
            )
        ),
        school_year_context AS (
          SELECT
            sy.id AS active_id,
            prev.id AS previous_id
          FROM school_years sy
          LEFT JOIN LATERAL (
            SELECT id FROM school_years
            WHERE start_date < sy.start_date AND deleted_at IS NULL
            ORDER BY start_date DESC LIMIT 1
          ) prev ON true
          WHERE sy.id = ${activeSchoolYearId}
        ),
        max_grade AS (
          SELECT MAX("order") AS max_order FROM grade_levels
        ),
        old_students AS (
          SELECT DISTINCT e.student_id
          FROM school_year_context syc
          INNER JOIN enrollments e ON e.school_year_id = syc.previous_id
          INNER JOIN students s ON e.student_id = s.id
          INNER JOIN grade_levels gl ON e.grade_level_id = gl.id
          WHERE syc.previous_id IS NOT NULL
            AND e.status = 'enrolled'
            AND s.is_active = true
            AND gl."order" < (SELECT max_order FROM max_grade)
            AND NOT EXISTS (
              SELECT 1 FROM enrollments e2
              WHERE e2.student_id = e.student_id
                AND e2.school_year_id = ${activeSchoolYearId}
                AND e2.status != 'cancelled'
            )
        )
      SELECT (
        (SELECT COUNT(*) FROM new_transferee) +
        (SELECT COUNT(*) FROM old_students)
      )::int AS total
    `).then((rows) => Number((rows as unknown as Array<{ total: string }>)[0]?.total || 0)),

    // Pending: enrollments with pending status
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "pending")
        )
      )
      .then(([result]) => Number(result?.count || 0)),

    // Assessed: enrollments with assessed status
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "assessed")
        )
      )
      .then(([result]) => Number(result?.count || 0)),

    // Enrolled: enrollments with enrolled status
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "enrolled")
        )
      )
      .then(([result]) => Number(result?.count || 0)),

    // Cancelled: enrollments with cancelled status
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "cancelled")
        )
      )
      .then(([result]) => Number(result?.count || 0)),
    ]);

    return {
      readyToEnroll: readyToEnrollCount,
      pending: pendingCount,
      assessed: assessedCount,
      enrolled: enrolledCount,
      cancelled: cancelledCount,
    };
  },
  ['enrollment-queue-counts'],
  {
    revalidate: 60, // Cache for 60 seconds
    tags: ['enrollments'],
  }
);

/**
 * LEGACY: Get all enrollment queue data for the active school year
 * @deprecated Use getEnrollmentQueueData(tab, params) instead for better performance
 */
export async function getAllEnrollmentQueueData(): Promise<EnrollmentQueueData | null> {
  const activeSchoolYearId = await getActiveSchoolYearId();

  if (!activeSchoolYearId) {
    return null; // No active school year configured
  }

  // Default pagination for legacy function (fetch first page only)
  const defaultParams: PaginationParams = { page: 1, pageSize: 100 };

  const [readyToEnroll, pending, assessed, enrolled, cancelled] = await Promise.all([
    getReadyToEnrollStudents(activeSchoolYearId, defaultParams),
    getPendingEnrollments(activeSchoolYearId, defaultParams),
    getAssessedEnrollments(activeSchoolYearId, defaultParams),
    getEnrolledStudents(activeSchoolYearId, defaultParams),
    getCancelledEnrollments(activeSchoolYearId, defaultParams),
  ]);

  return {
    readyToEnroll: readyToEnroll.data,
    pending: pending.data,
    assessed: assessed.data,
    enrolled: enrolled.data,
    cancelled: cancelled.data,
  };
}
