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
import { eq, and, ne, isNull, desc, sql } from "drizzle-orm";

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
 */
export async function getReadyToEnrollStudents(
  activeSchoolYearId: string
): Promise<ReadyToEnrollStudent[]> {

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

  // Step 4: Get old students from previous school year(s)
  // Logic: Find students who were enrolled in a previous year but NOT in current year
  const oldStudentRows = await db
    .select({
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      previousEnrollmentId: enrollments.id,
      previousGradeLevelId: gradeLevels.id,
      previousGradeName: gradeLevels.name,
      previousGradeOrder: gradeLevels.order,
      previousSchoolYearId: enrollments.schoolYearId,
      schoolYearStartDate: schoolYears.startDate,
      assessmentBalance: assessments.balance,
    })
    .from(enrollments)
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .leftJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
    .where(
      and(
        ne(enrollments.schoolYearId, activeSchoolYearId), // Previous year(s)
        eq(enrollments.status, "enrolled"), // Must have completed enrollment
        eq(students.isActive, true)
      )
    )
    .orderBy(desc(schoolYears.startDate)); // Most recent year first

  // Step 5: Get all grade levels for promotion calculation
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

  // Step 6: Process old students (take most recent enrollment per student)
  const oldStudentMap = new Map<string, ReadyToEnrollStudent>();

  for (const row of oldStudentRows) {
    // Skip if student already in current year
    if (enrolledStudentIds.has(row.studentId)) continue;

    // Skip if we already processed this student (we want most recent enrollment only)
    if (oldStudentMap.has(row.studentId)) continue;

    // Calculate suggested next grade
    const nextGradeOrder = row.previousGradeOrder + 1;
    const suggestedGrade = nextGradeOrder <= maxGradeOrder
      ? gradeLevelByOrder.get(nextGradeOrder)
      : null;

    // Skip Grade 12 completers (no next grade)
    if (!suggestedGrade) continue;

    // Calculate outstanding balance
    const balance = row.assessmentBalance ? Number(row.assessmentBalance) : 0;
    const hasOutstandingBalance = balance > 0.01; // Epsilon for floating point

    oldStudentMap.set(row.studentId, {
      studentId: row.studentId,
      studentRef: row.studentRef,
      firstName: row.firstName,
      lastName: row.lastName,
      studentType: "old_student",
      registrationId: null,
      registrationGradeLevelId: null,
      registrationGradeName: null,
      intakeDocuments: null,
      previousEnrollmentId: row.previousEnrollmentId,
      previousGradeLevelId: row.previousGradeLevelId,
      previousGradeName: row.previousGradeName,
      previousGradeOrder: row.previousGradeOrder,
      suggestedGradeLevelId: suggestedGrade.id,
      suggestedGradeName: suggestedGrade.name,
      suggestedGradeOrder: suggestedGrade.order,
      hasOutstandingBalance,
      outstandingAmount: hasOutstandingBalance ? row.assessmentBalance : null,
      hasCompleteDocuments: true, // Old students don't need document check
    });
  }

  const eligibleOldStudents = Array.from(oldStudentMap.values());

  // Step 7: Combine and return
  return [...eligibleNewTransferee, ...eligibleOldStudents].sort((a, b) =>
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );
}

/**
 * Get enrollments with status = "pending" (created but not yet assessed)
 */
export async function getPendingEnrollments(
  activeSchoolYearId: string
): Promise<PendingEnrollment[]> {
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
    .orderBy(desc(enrollments.createdAt));

  return rows.map((r) => ({
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
}

/**
 * Get enrollments with status = "assessed" (has assessment, awaiting payment)
 */
export async function getAssessedEnrollments(
  activeSchoolYearId: string
): Promise<AssessedEnrollment[]> {
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
    .orderBy(desc(assessments.createdAt));

  return rows.map((r) => ({
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
}

/**
 * Get enrollments with status = "enrolled" (fully enrolled)
 */
export async function getEnrolledStudents(
  activeSchoolYearId: string
): Promise<EnrolledStudent[]> {
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
    .orderBy(desc(enrollments.enrolledAt));

  return rows.map((r) => ({
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
}

/**
 * Get enrollments with status = "cancelled"
 */
export async function getCancelledEnrollments(
  activeSchoolYearId: string
): Promise<CancelledEnrollment[]> {
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
    .orderBy(desc(enrollments.cancelledAt));

  return rows.map((r) => ({
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
}

/**
 * Main function: Get all enrollment queue data for the active school year
 */
export async function getEnrollmentQueueData(): Promise<EnrollmentQueueData | null> {
  const activeSchoolYearId = await getActiveSchoolYearId();

  if (!activeSchoolYearId) {
    return null; // No active school year configured
  }

  const [readyToEnroll, pending, assessed, enrolled, cancelled] = await Promise.all([
    getReadyToEnrollStudents(activeSchoolYearId),
    getPendingEnrollments(activeSchoolYearId),
    getAssessedEnrollments(activeSchoolYearId),
    getEnrolledStudents(activeSchoolYearId),
    getCancelledEnrollments(activeSchoolYearId),
  ]);

  return {
    readyToEnroll,
    pending,
    assessed,
    enrolled,
    cancelled,
  };
}
