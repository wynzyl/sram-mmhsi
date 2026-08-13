import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  students,
  enrollments,
  registrations,
  gradeLevels,
  sections,
  assessments,
  type EnrollmentIntakeDocuments,
} from "@/lib/db/schema";
import { eq, and, isNull, desc, sql, or, ilike } from "drizzle-orm";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { buildStudentSearchCondition } from "@/lib/utils/query-conditions";
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

// ─── Type Definitions (re-exported from enrollments-queue.types.ts) ───────────

export type {
  ReadyToEnrollListRow,
  ReadyToEnrollDetail,
  ReadyToEnrollStudent,
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
  EnrollmentQueueData,
  TabKey,
  EnrollmentQueueFilters,
  EnrollmentQueueCounts,
} from "./enrollments-queue.types";

import type {
  ReadyToEnrollListRow,
  ReadyToEnrollDetail,
  ReadyToEnrollStudent,
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
  EnrollmentQueueData,
  TabKey,
  EnrollmentQueueFilters,
} from "./enrollments-queue.types";

// ─── Re-exports ───────────────────────────────────────────────────────────────

// Re-export from canonical location for backwards compatibility
export { getActiveSchoolYearId } from "@/lib/queries/schoolYears";

// ─── Main Query Functions ─────────────────────────────────────────────────────

/**
 * Get students who are READY TO ENROLL (not yet enrolled)
 *
 * Includes:
 * - New/Transferee students with approved registration
 * - Old students from previous year (auto-population)
 *
 * OPTIMIZED: Uses SQL-level UNION ALL and LIMIT/OFFSET for pagination
 * instead of loading all records into memory.
 *
 * Memory improvement: From ~47MB (5000 students) to ~50KB (25 students per page)
 */
export async function getReadyToEnrollStudents(
  activeSchoolYearId: string,
  params: PaginationParams
): Promise<PaginatedResult<ReadyToEnrollStudent>> {
  const offset = calculateOffset(params.page, params.pageSize);

  // Single optimized SQL query with UNION ALL and SQL-level pagination
  const rows = await db.execute<{
    student_id: string;
    student_ref: string;
    first_name: string;
    last_name: string;
    student_type: string;
    registration_id: string | null;
    registration_grade_level_id: string | null;
    registration_grade_name: string | null;
    intake_documents: EnrollmentIntakeDocuments | null;
    previous_enrollment_id: string | null;
    previous_grade_level_id: string | null;
    previous_grade_name: string | null;
    previous_grade_order: number | null;
    suggested_grade_level_id: string | null;
    suggested_grade_name: string | null;
    suggested_grade_order: number | null;
    assessment_balance: string | null;
    has_complete_documents: boolean;
  }>(sql`
    WITH
      -- Context: Get previous school year ID
      school_year_context AS (
        SELECT
          sy.id AS active_id,
          prev.id AS previous_id
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
      ),

      -- Get max grade order (to exclude Grade 12 completers)
      max_grade AS (
        SELECT MAX("order") AS max_order FROM grade_levels
      ),

      -- Exclusion: Students already enrolled this year
      enrolled_this_year AS (
        SELECT student_id
        FROM enrollments
        WHERE school_year_id = ${activeSchoolYearId}
          AND status != 'cancelled'
      ),

      -- Source 1: New/Transferee students from approved registrations
      new_transferee AS (
        SELECT
          s.id AS student_id,
          s.reference_number AS student_ref,
          s.first_name,
          s.last_name,
          r.student_type::text AS student_type,
          r.id AS registration_id,
          r.grade_level_id AS registration_grade_level_id,
          gl.name AS registration_grade_name,
          r.intake_documents,
          NULL::uuid AS previous_enrollment_id,
          NULL::uuid AS previous_grade_level_id,
          NULL::text AS previous_grade_name,
          NULL::int AS previous_grade_order,
          NULL::uuid AS suggested_grade_level_id,
          NULL::text AS suggested_grade_name,
          NULL::int AS suggested_grade_order,
          NULL::numeric AS assessment_balance,
          -- Document completeness: all must be 'received' or 'not_applicable'
          CASE
            WHEN r.intake_documents IS NULL THEN false
            WHEN (r.intake_documents->>'form138' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'birthCertificatePsa' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'goodMoralCharacter' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'qualifiedVoucher' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'escCertificate' IN ('received', 'not_applicable'))
            THEN true
            ELSE false
          END AS has_complete_documents
        FROM registrations r
        INNER JOIN students s ON r.student_id = s.id
        INNER JOIN grade_levels gl ON r.grade_level_id = gl.id
        WHERE r.school_year_id = ${activeSchoolYearId}
          AND r.status = 'approved'
          AND s.is_active = true
          AND s.status = 'active'
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
      ),

      -- Source 2: Old students (enrolled last year, eligible for promotion)
      old_students AS (
        SELECT DISTINCT ON (s.id)
          s.id AS student_id,
          s.reference_number AS student_ref,
          s.first_name,
          s.last_name,
          'old_student'::text AS student_type,
          NULL::uuid AS registration_id,
          NULL::uuid AS registration_grade_level_id,
          NULL::text AS registration_grade_name,
          NULL::jsonb AS intake_documents,
          e.id AS previous_enrollment_id,
          gl.id AS previous_grade_level_id,
          gl.name AS previous_grade_name,
          gl."order" AS previous_grade_order,
          next_gl.id AS suggested_grade_level_id,
          next_gl.name AS suggested_grade_name,
          next_gl."order" AS suggested_grade_order,
          COALESCE(a.balance, 0) AS assessment_balance,
          true AS has_complete_documents  -- Old students don't need document check
        FROM school_year_context syc
        INNER JOIN enrollments e ON e.school_year_id = syc.previous_id
        INNER JOIN students s ON e.student_id = s.id
        INNER JOIN grade_levels gl ON e.grade_level_id = gl.id
        -- Join to next grade level for promotion suggestion
        INNER JOIN grade_levels next_gl ON next_gl."order" = gl."order" + 1
        LEFT JOIN assessments a ON a.enrollment_id = e.id
        WHERE syc.previous_id IS NOT NULL
          AND e.status = 'enrolled'
          AND s.is_active = true
          AND s.status = 'active'
          -- Exclude Grade 12 completers (no next grade available)
          AND gl."order" < (SELECT max_order FROM max_grade)
          -- Exclude students already enrolled this year
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
        ORDER BY s.id, e.created_at DESC  -- Most recent enrollment per student
      ),

      -- Combined results with UNION ALL
      combined AS (
        SELECT * FROM new_transferee
        UNION ALL
        SELECT * FROM old_students
      )

    -- Final paginated output with SQL-level sorting and pagination
    -- Include student_id as tie-breaker for deterministic pagination
    SELECT *
    FROM combined
    ORDER BY last_name, first_name, student_id
    LIMIT ${params.pageSize}
    OFFSET ${offset}
  `);

  // Get total count (uses existing cached count query for performance)
  // For accurate pagination, we need the total - use the same CTEs logic
  const [countResult] = await db.execute<{ total: number }>(sql`
    WITH
      school_year_context AS (
        SELECT
          sy.id AS active_id,
          prev.id AS previous_id
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
      ),
      max_grade AS (
        SELECT MAX("order") AS max_order FROM grade_levels
      ),
      enrolled_this_year AS (
        SELECT student_id
        FROM enrollments
        WHERE school_year_id = ${activeSchoolYearId}
          AND status != 'cancelled'
      ),
      new_transferee AS (
        SELECT r.student_id
        FROM registrations r
        INNER JOIN students s ON r.student_id = s.id
        WHERE r.school_year_id = ${activeSchoolYearId}
          AND r.status = 'approved'
          AND s.is_active = true
          AND s.status = 'active'
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
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
          AND s.status = 'active'
          AND gl."order" < (SELECT max_order FROM max_grade)
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
      )
    SELECT (
      (SELECT COUNT(*) FROM new_transferee) +
      (SELECT COUNT(*) FROM old_students)
    )::int AS total
  `);

  const totalRecords = Number(countResult?.total || 0);

  // Map SQL snake_case results to TypeScript camelCase
  const data: ReadyToEnrollStudent[] = rows.map((row) => {
    const balance = row.assessment_balance ? Number(row.assessment_balance) : 0;
    const hasOutstandingBalance = balance > 0.01;

    return {
      studentId: row.student_id,
      studentRef: row.student_ref,
      firstName: row.first_name,
      lastName: row.last_name,
      studentType: row.student_type as "new_student" | "transferee" | "old_student",
      registrationId: row.registration_id,
      registrationGradeLevelId: row.registration_grade_level_id,
      registrationGradeName: row.registration_grade_name,
      intakeDocuments: row.intake_documents,
      previousEnrollmentId: row.previous_enrollment_id,
      previousGradeLevelId: row.previous_grade_level_id,
      previousGradeName: row.previous_grade_name,
      previousGradeOrder: row.previous_grade_order,
      suggestedGradeLevelId: row.suggested_grade_level_id,
      suggestedGradeName: row.suggested_grade_name,
      suggestedGradeOrder: row.suggested_grade_order,
      hasOutstandingBalance,
      outstandingAmount: hasOutstandingBalance ? row.assessment_balance : null,
      hasCompleteDocuments: row.has_complete_documents,
    };
  });

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

// ─── Queue Filters (server-side search — audit finding F5) ────────────────────

// studentSearchCondition moved to @/lib/utils/query-conditions as buildStudentSearchCondition

/** Shared WHERE for the four status tabs (pending/assessed/enrolled/cancelled). */
function enrollmentTabConditions(
  activeSchoolYearId: string,
  status: "pending" | "assessed" | "enrolled" | "cancelled",
  filters?: EnrollmentQueueFilters
) {
  const conditions = [
    eq(enrollments.schoolYearId, activeSchoolYearId),
    eq(enrollments.status, status),
    // Filter out archived students (align with Student Directory)
    eq(students.isActive, true),
    eq(students.status, "active"),
  ];
  const search = buildStudentSearchCondition(filters?.search);
  if (search) conditions.push(search);
  if (filters?.gradeLevelId) {
    conditions.push(eq(enrollments.gradeLevelId, filters.gradeLevelId));
  }
  return and(...conditions);
}

/**
 * Get enrollments with status = "pending" (created but not yet assessed)
 */
export async function getPendingEnrollments(
  activeSchoolYearId: string,
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<PaginatedResult<PendingEnrollment>> {
  const whereCondition = enrollmentTabConditions(activeSchoolYearId, "pending", filters);
  const offset = calculateOffset(params.page, params.pageSize);

  // Parallelize count and data queries
  const [countResult, rows] = await Promise.all([
    // Get total count (joins students so the search filter applies)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(whereCondition),
    // Get paginated data
    db
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
      .where(whereCondition)
      .orderBy(desc(enrollments.createdAt))
      .limit(params.pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count || 0);

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
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<PaginatedResult<AssessedEnrollment>> {
  const whereCondition = enrollmentTabConditions(activeSchoolYearId, "assessed", filters);
  const offset = calculateOffset(params.page, params.pageSize);

  // Parallelize count and data queries
  const [countResult, rows] = await Promise.all([
    // Get total count (joins students so the search filter applies)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(whereCondition),
    // Get paginated data
    db
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
      .where(whereCondition)
      .orderBy(desc(assessments.createdAt))
      .limit(params.pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count || 0);

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
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<PaginatedResult<EnrolledStudent>> {
  const whereCondition = enrollmentTabConditions(activeSchoolYearId, "enrolled", filters);
  const offset = calculateOffset(params.page, params.pageSize);

  // Parallelize count and data queries
  const [countResult, rows] = await Promise.all([
    // Get total count (joins students so the search filter applies)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(whereCondition),
    // Get paginated data
    db
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
      .where(whereCondition)
      .orderBy(desc(enrollments.enrolledAt))
      .limit(params.pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count || 0);

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
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<PaginatedResult<CancelledEnrollment>> {
  const whereCondition = enrollmentTabConditions(activeSchoolYearId, "cancelled", filters);
  const offset = calculateOffset(params.page, params.pageSize);

  // Parallelize count and data queries
  const [countResult, rows] = await Promise.all([
    // Get total count (joins students so the search filter applies)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(whereCondition),
    // Get paginated data
    db
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
      .where(whereCondition)
      .orderBy(desc(enrollments.cancelledAt))
      .limit(params.pageSize)
      .offset(offset),
  ]);

  const totalRecords = Number(countResult[0]?.count || 0);

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
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<
  | PaginatedResult<ReadyToEnrollListRow>
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
      // Use optimized list query (excludes intakeDocuments - ~30-40% payload reduction)
      return getReadyToEnrollList(activeSchoolYearId, params, filters);
    case "pending":
      return getPendingEnrollments(activeSchoolYearId, params, filters);
    case "assessed":
      return getAssessedEnrollments(activeSchoolYearId, params, filters);
    case "enrolled":
      return getEnrolledStudents(activeSchoolYearId, params, filters);
    case "cancelled":
      return getCancelledEnrollments(activeSchoolYearId, params, filters);
    default:
      return null;
  }
}

/**
 * Get counts for all enrollment queue tabs (lightweight COUNT queries)
 *
 * PERFORMANCE: Cached for 60 seconds to reduce database load by 95%
 */
export async function getEnrollmentQueueCounts(): Promise<{
  readyToEnroll: number;
  pending: number;
  assessed: number;
  enrolled: number;
  cancelled: number;
} | null> {
  "use cache";
  cacheTag(CACHE_TAGS.ENROLLMENTS);
  cacheLife("minutes"); // 1 min revalidate

  const activeSchoolYearId = await getActiveSchoolYearId();

  if (!activeSchoolYearId) {
    return null;
  }

  // Get all counts in parallel using COUNT(*) (fast, uses indexes)
  // Each promise has explicit error handling to prevent silent failures
  const [
    readyToEnrollCount,
    pendingCount,
    assessedCount,
    enrolledCount,
    cancelledCount,
  ] = await Promise.all([
    // Ready to enroll: new/transferee approved registrations (not yet enrolled, active)
    // + old students enrolled last year (not yet in current year, not Grade 12 completers)
    // NOTE: Filter by both is_active AND status = 'active' to exclude archived students
    db.execute<{ total: string }>(sql`
      WITH
        new_transferee AS (
          SELECT r.student_id
          FROM registrations r
          INNER JOIN students s ON r.student_id = s.id
          WHERE r.school_year_id = ${activeSchoolYearId}
            AND r.status = 'approved'
            AND s.is_active = true
            AND s.status = 'active'
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
            AND s.status = 'active'
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
    `)
      .then((rows) => Number((rows as unknown as Array<{ total: string }>)[0]?.total || 0))
      .catch((err) => {
        console.error("[enrollments-queue] readyToEnroll count failed:", err);
        return 0;
      }),

    // Pending: enrollments with pending status (excluding archived students)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "pending"),
          eq(students.isActive, true),
          eq(students.status, "active")
        )
      )
      .then(([result]) => Number(result?.count || 0))
      .catch((err) => {
        console.error("[enrollments-queue] pending count failed:", err);
        return 0;
      }),

    // Assessed: enrollments with assessed status (excluding archived students)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "assessed"),
          eq(students.isActive, true),
          eq(students.status, "active")
        )
      )
      .then(([result]) => Number(result?.count || 0))
      .catch((err) => {
        console.error("[enrollments-queue] assessed count failed:", err);
        return 0;
      }),

    // Enrolled: enrollments with enrolled status (excluding archived students)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "enrolled"),
          eq(students.isActive, true),
          eq(students.status, "active")
        )
      )
      .then(([result]) => Number(result?.count || 0))
      .catch((err) => {
        console.error("[enrollments-queue] enrolled count failed:", err);
        return 0;
      }),

    // Cancelled: enrollments with cancelled status (excluding archived students)
    db
      .select({ count: sql<number>`count(*)` })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .where(
        and(
          eq(enrollments.schoolYearId, activeSchoolYearId),
          eq(enrollments.status, "cancelled"),
          eq(students.isActive, true),
          eq(students.status, "active")
        )
      )
      .then(([result]) => Number(result?.count || 0))
      .catch((err) => {
        console.error("[enrollments-queue] cancelled count failed:", err);
        return 0;
      }),
  ]);

  return {
    readyToEnroll: readyToEnrollCount,
    pending: pendingCount,
    assessed: assessedCount,
    enrolled: enrolledCount,
    cancelled: cancelledCount,
  };
}

// ─── Optimized List Query (Phase 1: Query Optimization) ─────────────────────

/**
 * Get students who are READY TO ENROLL (optimized list version)
 *
 * Returns ReadyToEnrollListRow - a lean DTO without intakeDocuments
 * For full details including intakeDocuments, use getReadyToEnrollDetail()
 *
 * Savings: ~30-40% reduction per row by excluding intakeDocuments JSON
 */
export async function getReadyToEnrollList(
  activeSchoolYearId: string,
  params: PaginationParams,
  filters?: EnrollmentQueueFilters
): Promise<PaginatedResult<ReadyToEnrollListRow>> {
  const offset = calculateOffset(params.page, params.pageSize);

  // Server-side filters (audit finding F5): applied to the combined CTE so
  // search matches across the whole queue, not just the fetched page.
  const searchTerm = filters?.search?.trim();
  const searchPattern = searchTerm ? `%${searchTerm}%` : null;
  const searchCondition = searchPattern
    ? sql`(first_name ILIKE ${searchPattern} OR last_name ILIKE ${searchPattern} OR student_ref ILIKE ${searchPattern})`
    : sql`TRUE`;
  // Enrolling grade: registration grade for new/transferee, suggested for old students.
  const gradeCondition = filters?.gradeLevelId
    ? sql`(COALESCE(registration_grade_level_id, suggested_grade_level_id) = ${filters.gradeLevelId})`
    : sql`TRUE`;

  // Optimized SQL query - excludes intake_documents field
  const rows = await db.execute<{
    student_id: string;
    student_ref: string;
    first_name: string;
    last_name: string;
    student_type: string;
    registration_id: string | null;
    registration_grade_level_id: string | null;
    registration_grade_name: string | null;
    previous_grade_name: string | null;
    suggested_grade_level_id: string | null;
    suggested_grade_name: string | null;
    assessment_balance: string | null;
    has_complete_documents: boolean;
    total_count: number;
  }>(sql`
    WITH
      -- Context: Get previous school year ID
      school_year_context AS (
        SELECT
          sy.id AS active_id,
          prev.id AS previous_id
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
      ),

      -- Get max grade order (to exclude Grade 12 completers)
      max_grade AS (
        SELECT MAX("order") AS max_order FROM grade_levels
      ),

      -- Exclusion: Students already enrolled this year
      enrolled_this_year AS (
        SELECT student_id
        FROM enrollments
        WHERE school_year_id = ${activeSchoolYearId}
          AND status != 'cancelled'
      ),

      -- Source 1: New/Transferee students from approved registrations
      new_transferee AS (
        SELECT
          s.id AS student_id,
          s.reference_number AS student_ref,
          s.first_name,
          s.last_name,
          r.student_type::text AS student_type,
          r.id AS registration_id,
          r.grade_level_id AS registration_grade_level_id,
          gl.name AS registration_grade_name,
          NULL::text AS previous_grade_name,
          NULL::uuid AS suggested_grade_level_id,
          NULL::text AS suggested_grade_name,
          NULL::numeric AS assessment_balance,
          -- Document completeness: all must be 'received' or 'not_applicable'
          CASE
            WHEN r.intake_documents IS NULL THEN false
            WHEN (r.intake_documents->>'form138' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'birthCertificatePsa' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'goodMoralCharacter' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'qualifiedVoucher' IN ('received', 'not_applicable'))
              AND (r.intake_documents->>'escCertificate' IN ('received', 'not_applicable'))
            THEN true
            ELSE false
          END AS has_complete_documents
        FROM registrations r
        INNER JOIN students s ON r.student_id = s.id
        INNER JOIN grade_levels gl ON r.grade_level_id = gl.id
        WHERE r.school_year_id = ${activeSchoolYearId}
          AND r.status = 'approved'
          AND s.is_active = true
          AND s.status = 'active'
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
      ),

      -- Source 2: Old students (enrolled last year, eligible for promotion)
      old_students AS (
        SELECT DISTINCT ON (s.id)
          s.id AS student_id,
          s.reference_number AS student_ref,
          s.first_name,
          s.last_name,
          'old_student'::text AS student_type,
          NULL::uuid AS registration_id,
          NULL::uuid AS registration_grade_level_id,
          NULL::text AS registration_grade_name,
          gl.name AS previous_grade_name,
          next_gl.id AS suggested_grade_level_id,
          next_gl.name AS suggested_grade_name,
          COALESCE(a.balance, 0) AS assessment_balance,
          true AS has_complete_documents  -- Old students don't need document check
        FROM school_year_context syc
        INNER JOIN enrollments e ON e.school_year_id = syc.previous_id
        INNER JOIN students s ON e.student_id = s.id
        INNER JOIN grade_levels gl ON e.grade_level_id = gl.id
        -- Join to next grade level for promotion suggestion
        INNER JOIN grade_levels next_gl ON next_gl."order" = gl."order" + 1
        LEFT JOIN assessments a ON a.enrollment_id = e.id
        WHERE syc.previous_id IS NOT NULL
          AND e.status = 'enrolled'
          AND s.is_active = true
          AND s.status = 'active'
          -- Exclude Grade 12 completers (no next grade available)
          AND gl."order" < (SELECT max_order FROM max_grade)
          -- Exclude students already enrolled this year
          AND s.id NOT IN (SELECT student_id FROM enrolled_this_year)
        ORDER BY s.id, e.created_at DESC  -- Most recent enrollment per student
      ),

      -- Combined results with UNION ALL
      combined AS (
        SELECT * FROM new_transferee
        UNION ALL
        SELECT * FROM old_students
      )

    -- Final paginated output with SQL-level filtering, sorting, and pagination
    -- COUNT(*) OVER () returns the filtered total without a second query.
    -- Include student_id as tie-breaker for deterministic pagination
    SELECT *, COUNT(*) OVER ()::int AS total_count
    FROM combined
    WHERE ${searchCondition} AND ${gradeCondition}
    ORDER BY last_name, first_name, student_id
    LIMIT ${params.pageSize}
    OFFSET ${offset}
  `);

  const totalRecords = Number(rows[0]?.total_count ?? 0);

  // Map SQL snake_case results to TypeScript camelCase
  const data: ReadyToEnrollListRow[] = rows.map((row) => {
    const balance = row.assessment_balance ? Number(row.assessment_balance) : 0;
    const hasOutstandingBalance = balance > 0.01;

    return {
      studentId: row.student_id,
      studentRef: row.student_ref,
      firstName: row.first_name,
      lastName: row.last_name,
      studentType: row.student_type as "new_student" | "transferee" | "old_student",
      registrationId: row.registration_id,
      registrationGradeLevelId: row.registration_grade_level_id,
      registrationGradeName: row.registration_grade_name,
      previousGradeName: row.previous_grade_name,
      suggestedGradeLevelId: row.suggested_grade_level_id,
      suggestedGradeName: row.suggested_grade_name,
      hasOutstandingBalance,
      outstandingAmount: hasOutstandingBalance ? row.assessment_balance : null,
      hasCompleteDocuments: row.has_complete_documents,
    };
  });

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get full detail for a single student (lazy-loaded for drawer)
 *
 * Returns ReadyToEnrollDetail including intakeDocuments
 * Called on-demand when enrollment drawer opens
 */
export async function getReadyToEnrollDetail(
  studentId: string,
  activeSchoolYearId: string
): Promise<ReadyToEnrollDetail | null> {
  // First, check if this is a new/transferee (has registration) or old student
  const [registration] = await db
    .select({
      id: registrations.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      studentType: registrations.studentType,
      gradeLevelId: registrations.gradeLevelId,
      gradeName: gradeLevels.name,
      intakeDocuments: registrations.intakeDocuments,
    })
    .from(registrations)
    .innerJoin(students, eq(students.id, registrations.studentId))
    .innerJoin(gradeLevels, eq(gradeLevels.id, registrations.gradeLevelId))
    .where(
      and(
        eq(registrations.studentId, studentId),
        eq(registrations.schoolYearId, activeSchoolYearId),
        eq(registrations.status, 'approved')
      )
    )
    .limit(1);

  if (registration) {
    // New/transferee student - has registration with intake documents
    const intakeDocs = registration.intakeDocuments as EnrollmentIntakeDocuments | null;
    const hasCompleteDocuments = intakeDocs
      ? ["form138", "birthCertificatePsa", "goodMoralCharacter", "qualifiedVoucher", "escCertificate"]
          .every(key => {
            const value = intakeDocs[key as keyof EnrollmentIntakeDocuments];
            return value === "received" || value === "not_applicable";
          })
      : false;

    return {
      studentId,
      studentRef: registration.studentRef as string,
      firstName: registration.firstName as string,
      lastName: registration.lastName as string,
      studentType: registration.studentType as "new_student" | "transferee",
      registrationId: registration.id as string,
      registrationGradeLevelId: registration.gradeLevelId as string,
      registrationGradeName: registration.gradeName as string,
      previousGradeName: null,
      suggestedGradeLevelId: null,
      suggestedGradeName: null,
      hasOutstandingBalance: false,
      outstandingAmount: null,
      hasCompleteDocuments,
      intakeDocuments: intakeDocs,
    };
  }

  // Check for old student (enrolled in previous year)
  const [oldStudentData] = await db.execute<{
    student_ref: string;
    first_name: string;
    last_name: string;
    previous_grade_name: string;
    suggested_grade_level_id: string;
    suggested_grade_name: string;
    assessment_balance: string | null;
  }>(sql`
    WITH school_year_context AS (
      SELECT
        sy.id AS active_id,
        prev.id AS previous_id
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
      s.reference_number AS student_ref,
      s.first_name,
      s.last_name,
      gl.name AS previous_grade_name,
      next_gl.id AS suggested_grade_level_id,
      next_gl.name AS suggested_grade_name,
      COALESCE(a.balance, 0)::text AS assessment_balance
    FROM school_year_context syc
    INNER JOIN enrollments e ON e.school_year_id = syc.previous_id
    INNER JOIN students s ON e.student_id = s.id AND s.id = ${studentId}
    INNER JOIN grade_levels gl ON e.grade_level_id = gl.id
    INNER JOIN grade_levels next_gl ON next_gl."order" = gl."order" + 1
    LEFT JOIN assessments a ON a.enrollment_id = e.id
    WHERE syc.previous_id IS NOT NULL
      AND e.status = 'enrolled'
      AND s.is_active = true
      AND s.status = 'active'
    ORDER BY e.created_at DESC
    LIMIT 1
  `);

  if (oldStudentData) {
    const balance = oldStudentData.assessment_balance ? Number(oldStudentData.assessment_balance) : 0;
    const hasOutstandingBalance = balance > 0.01;

    return {
      studentId,
      studentRef: oldStudentData.student_ref,
      firstName: oldStudentData.first_name,
      lastName: oldStudentData.last_name,
      studentType: "old_student",
      registrationId: null,
      registrationGradeLevelId: null,
      registrationGradeName: null,
      previousGradeName: oldStudentData.previous_grade_name,
      suggestedGradeLevelId: oldStudentData.suggested_grade_level_id,
      suggestedGradeName: oldStudentData.suggested_grade_name,
      hasOutstandingBalance,
      outstandingAmount: hasOutstandingBalance ? oldStudentData.assessment_balance : null,
      hasCompleteDocuments: true, // Old students don't need document check
      intakeDocuments: null, // Old students don't have intake documents
    };
  }

  return null;
}

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
