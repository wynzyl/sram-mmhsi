import "server-only";
import { db } from "@/lib/db";
import {
  enrollmentCancellationRequests,
  enrollments,
  students,
  gradeLevels,
  schoolYears,
  assessments,
  assessmentItems,
  payments,
  users,
  systemSettings,
} from "@/lib/db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";
import type { CancellationReason } from "@/lib/constants/cancellation-reasons";

// ─── Type Definitions (re-exported from enrollment-cancellation.types.ts) ─────

export type {
  CancellationRequestListItem,
  CancellationRequestDetail,
  RefundCalculation,
  PendingCancellationInfo,
  EnrollmentForCancellation,
  CancellationRequestForValidation,
  CancellationHistoryItem,
} from "./enrollment-cancellation.types";

import type {
  CancellationRequestListItem,
  CancellationRequestDetail,
  RefundCalculation,
} from "./enrollment-cancellation.types";

// ─── System Settings Queries ──────────────────────────────────────────────────

/**
 * Get a system setting by key
 */
export async function getSystemSetting(key: string): Promise<string | null> {
  const [result] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  return result?.value ?? null;
}

/**
 * Get refund cutoff configuration
 */
export async function getRefundCutoffConfig(): Promise<{
  startDate: Date;
  cutoffDays: number;
  cutoffDate: Date;
} | null> {
  const [startDateSetting, cutoffDaysSetting] = await Promise.all([
    getSystemSetting("refund_cutoff_start_date"),
    getSystemSetting("refund_cutoff_days"),
  ]);

  if (!startDateSetting || !cutoffDaysSetting) {
    return null;
  }

  const startDate = new Date(startDateSetting);
  const cutoffDays = parseInt(cutoffDaysSetting, 10);

  if (isNaN(startDate.getTime()) || isNaN(cutoffDays)) {
    return null;
  }

  const cutoffDate = new Date(startDate);
  cutoffDate.setDate(cutoffDate.getDate() + cutoffDays);

  return {
    startDate,
    cutoffDays,
    cutoffDate,
  };
}

// ─── Pending Cancellation Check ───────────────────────────────────────────────

/**
 * Check if an enrollment has a pending cancellation request.
 * Used to block transactions while cancellation is pending.
 */
export async function hasPendingCancellationRequest(enrollmentId: string): Promise<boolean> {
  const [result] = await db
    .select({ id: enrollmentCancellationRequests.id })
    .from(enrollmentCancellationRequests)
    .where(
      and(
        eq(enrollmentCancellationRequests.enrollmentId, enrollmentId),
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  return !!result;
}

/**
 * Assert that an enrollment does not have a pending cancellation request.
 *
 * Throws a descriptive error if a cancellation request is pending for the enrollment.
 * Use this guard to block financial operations while cancellation is under review.
 *
 * @param enrollmentId - The enrollment ID to check (skips check if null/undefined)
 * @param operation - Description of the blocked operation (e.g., "post payment", "apply discount")
 * @throws Error if enrollment has a pending cancellation request
 *
 * @example
 * ```typescript
 * await assertNoPendingCancellation(assessment.enrollmentId, "post payment");
 * // Continue with payment...
 * ```
 */
export async function assertNoPendingCancellation(
  enrollmentId: string | null | undefined,
  operation: string
): Promise<void> {
  if (!enrollmentId) return;

  const hasPending = await hasPendingCancellationRequest(enrollmentId);
  if (hasPending) {
    throw new Error(
      `OPERATION_BLOCKED: Cannot ${operation} - enrollment has a pending cancellation request. ` +
        `Please wait for the request to be approved, rejected, or withdrawn.`
    );
  }
}

/**
 * Get enrollment IDs that have pending cancellation requests (batch query)
 * Useful for showing pending status in enrollment history tables
 */
export async function getEnrollmentsWithPendingCancellation(
  enrollmentIds: string[]
): Promise<Set<string>> {
  if (enrollmentIds.length === 0) return new Set();

  const results = await db
    .select({ enrollmentId: enrollmentCancellationRequests.enrollmentId })
    .from(enrollmentCancellationRequests)
    .where(
      and(
        inArray(enrollmentCancellationRequests.enrollmentId, enrollmentIds),
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    );

  return new Set(results.map((r) => r.enrollmentId));
}

/**
 * Get enrollment IDs with pending cancellation requests for a student (by student ID)
 * This allows the query to run in parallel with other student queries
 */
export async function getStudentEnrollmentsWithPendingCancellation(
  studentId: string
): Promise<Set<string>> {
  const results = await db
    .select({ enrollmentId: enrollmentCancellationRequests.enrollmentId })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    );

  return new Set(results.map((r) => r.enrollmentId));
}

/**
 * Get pending cancellation request for an enrollment (if exists)
 * Returns full details needed for UI display
 */
export async function getPendingCancellationRequest(
  enrollmentId: string
): Promise<{
  id: string;
  requestedBy: string;
  requestedAt: Date;
  reasonType: string;
  remarks: string | null;
  requestedByName: string;
} | null> {
  // Single query with JOIN to get user name (fixes N+1)
  const [result] = await db
    .select({
      id: enrollmentCancellationRequests.id,
      requestedBy: enrollmentCancellationRequests.requestedBy,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
      requestedByName: users.username,
    })
    .from(enrollmentCancellationRequests)
    .leftJoin(users, eq(enrollmentCancellationRequests.requestedBy, users.id))
    .where(
      and(
        eq(enrollmentCancellationRequests.enrollmentId, enrollmentId),
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  if (!result) return null;

  return {
    id: result.id,
    requestedBy: result.requestedBy,
    requestedAt: result.requestedAt,
    reasonType: result.reasonType,
    remarks: result.remarks,
    requestedByName: result.requestedByName ?? "Unknown",
  };
}

// ─── Cancellation Request Queries ─────────────────────────────────────────────

/**
 * Get paginated list of cancellation requests for admin inbox
 */
export async function getCancellationRequests(
  params: PaginationParams,
  filters?: {
    status?: "pending" | "approved" | "rejected" | "cancelled";
    schoolYearId?: string;
  }
): Promise<PaginatedResult<CancellationRequestListItem>> {
  const offset = calculateOffset(params.page, params.pageSize);

  // Build conditions
  const conditions = [isNull(enrollmentCancellationRequests.deletedAt)];

  if (filters?.status) {
    conditions.push(eq(enrollmentCancellationRequests.status, filters.status));
  }

  if (filters?.schoolYearId) {
    conditions.push(eq(enrollments.schoolYearId, filters.schoolYearId));
  }

  // Create aliases for user joins (requestedBy and reviewedBy are different users)
  const requestedByUser = alias(users, "requested_by_user");
  const reviewedByUser = alias(users, "reviewed_by_user");

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .where(and(...conditions));

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data with joins (single query, no N+1)
  const rows = await db
    .select({
      id: enrollmentCancellationRequests.id,
      enrollmentId: enrollmentCancellationRequests.enrollmentId,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
      status: enrollmentCancellationRequests.status,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      requestedByName: requestedByUser.username,
      reviewedByName: reviewedByUser.username,
    })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .leftJoin(requestedByUser, eq(enrollmentCancellationRequests.requestedBy, requestedByUser.id))
    .leftJoin(reviewedByUser, eq(enrollmentCancellationRequests.reviewedBy, reviewedByUser.id))
    .where(and(...conditions))
    .orderBy(desc(enrollmentCancellationRequests.requestedAt))
    .limit(params.pageSize)
    .offset(offset);

  const data: CancellationRequestListItem[] = rows.map((r) => ({
    id: r.id,
    enrollmentId: r.enrollmentId,
    studentId: r.studentId,
    studentRef: r.studentRef,
    studentName: `${r.lastName}, ${r.firstName}`,
    gradeLevelName: r.gradeLevelName,
    schoolYearLabel: r.schoolYearLabel,
    reasonType: r.reasonType as CancellationReason,
    remarks: r.remarks,
    status: r.status as "pending" | "approved" | "rejected" | "cancelled",
    requestedAt: r.requestedAt,
    requestedByName: r.requestedByName ?? "Unknown",
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedByName ?? null,
  }));

  return {
    data,
    pagination: calculatePagination(params.page, params.pageSize, totalRecords),
  };
}

/**
 * Get count of pending cancellation requests (for badge display)
 */
export async function getPendingCancellationRequestsCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollmentCancellationRequests)
    .where(
      and(
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    );

  return Number(result?.count || 0);
}

/**
 * Get detailed cancellation request by ID (for review page)
 */
export async function getCancellationRequestById(
  requestId: string
): Promise<CancellationRequestDetail | null> {
  // Create aliases for user joins
  const requestedByUser = alias(users, "requested_by_user");
  const reviewedByUser = alias(users, "reviewed_by_user");

  // Single query with JOINs for user names (fixes N+1)
  const [row] = await db
    .select({
      id: enrollmentCancellationRequests.id,
      enrollmentId: enrollmentCancellationRequests.enrollmentId,
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      gradeLevelName: gradeLevels.name,
      schoolYearLabel: schoolYears.label,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
      status: enrollmentCancellationRequests.status,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      reviewRemarks: enrollmentCancellationRequests.reviewRemarks,
      enrollmentStatus: enrollments.status,
      requestedByName: requestedByUser.username,
      reviewedByName: reviewedByUser.username,
    })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .leftJoin(requestedByUser, eq(enrollmentCancellationRequests.requestedBy, requestedByUser.id))
    .leftJoin(reviewedByUser, eq(enrollmentCancellationRequests.reviewedBy, reviewedByUser.id))
    .where(
      and(
        eq(enrollmentCancellationRequests.id, requestId),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  if (!row) return null;

  // Get assessment info
  const [assessment] = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
    })
    .from(assessments)
    .where(
      and(eq(assessments.enrollmentId, row.enrollmentId), isNull(assessments.cancelledAt))
    )
    .limit(1);

  // Calculate refund preview if assessment exists
  let refundPreview: RefundCalculation | null = null;
  if (assessment) {
    refundPreview = await calculateRefundPreview(assessment.id);
  }

  return {
    id: row.id,
    enrollmentId: row.enrollmentId,
    studentId: row.studentId,
    studentRef: row.studentRef,
    studentName: `${row.lastName}, ${row.firstName}`,
    gradeLevelName: row.gradeLevelName,
    schoolYearLabel: row.schoolYearLabel,
    reasonType: row.reasonType as CancellationReason,
    remarks: row.remarks,
    status: row.status as "pending" | "approved" | "rejected" | "cancelled",
    requestedAt: row.requestedAt,
    requestedByName: row.requestedByName ?? "Unknown",
    reviewedAt: row.reviewedAt,
    reviewedByName: row.reviewedByName ?? null,
    enrollmentStatus: row.enrollmentStatus as "pending" | "assessed" | "enrolled" | "cancelled",
    reviewRemarks: row.reviewRemarks,
    assessment: assessment
      ? {
          id: assessment.id,
          totalAmount: assessment.totalAmount,
          totalPaid: assessment.totalPaid,
          balance: assessment.balance,
          billingStatus: assessment.billingStatus,
        }
      : null,
    refundPreview,
  };
}

// ─── Refund Calculation ───────────────────────────────────────────────────────

/**
 * Calculate refund preview for an assessment
 * Used for displaying refund breakdown before approval
 */
export async function calculateRefundPreview(assessmentId: string): Promise<RefundCalculation | null> {
  // Get cutoff configuration
  const cutoffConfig = await getRefundCutoffConfig();
  if (!cutoffConfig) {
    return null;
  }

  const now = new Date();
  const isEligibleForRefund = now <= cutoffConfig.cutoffDate;

  // Get assessment items with refundability
  const items = await db
    .select({
      id: assessmentItems.id,
      description: assessmentItems.description,
      amount: assessmentItems.amount,
      isRefundable: assessmentItems.isRefundable,
      isDiscount: assessmentItems.isDiscount,
    })
    .from(assessmentItems)
    .where(eq(assessmentItems.assessmentId, assessmentId));

  // Get all posted payments and their allocations
  const paymentsData = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      status: payments.status,
      kind: payments.kind,
    })
    .from(payments)
    .where(
      and(
        eq(payments.assessmentId, assessmentId),
        eq(payments.status, "posted"),
        eq(payments.kind, "payment") // Only original payments, not reversals
      )
    );

  // Calculate total paid from payments (lump-sum approach - no allocations needed)
  const totalPaid = paymentsData.reduce((sum, p) => sum + Number(p.amount), 0);

  // Calculate total non-refundable item amounts (fees that are forfeited first)
  let totalNonRefundableItemAmount = 0;

  for (const item of items) {
    if (item.isDiscount) continue;
    if (!item.isRefundable) {
      totalNonRefundableItemAmount += Number(item.amount);
    }
  }

  // Non-refundable fees are deducted first, remainder is refunded
  // Cap non-refundable at total paid (can't forfeit more than was paid)
  const nonRefundableAmount = Math.min(totalNonRefundableItemAmount, totalPaid);
  const refundableAmount = totalPaid - nonRefundableAmount;

  // Build item breakdown for UI display
  const itemBreakdown: RefundCalculation["itemBreakdown"] = [];

  for (const item of items) {
    if (item.isDiscount) continue;

    const itemAmount = Number(item.amount);
    // For lump-sum payments, we show the item's fee amount (not what was paid per item)
    // Since non-refundable is deducted first, calculate what portion is effectively "paid"
    const willRefund = isEligibleForRefund && item.isRefundable && refundableAmount > 0;

    itemBreakdown.push({
      description: item.description,
      paidAmount: itemAmount, // Show fee amount for reference
      isRefundable: item.isRefundable,
      willRefund,
    });
  }

  return {
    isEligibleForRefund,
    cutoffDate: cutoffConfig.cutoffDate,
    refundableAmount: isEligibleForRefund ? refundableAmount : 0,
    nonRefundableAmount: nonRefundableAmount + (isEligibleForRefund ? 0 : refundableAmount),
    totalPaid,
    itemBreakdown,
  };
}

// ─── Enrollment Query Helpers ─────────────────────────────────────────────────

/**
 * Get enrollment with assessment for cancellation processing
 */
export async function getEnrollmentForCancellation(enrollmentId: string): Promise<{
  id: string;
  studentId: string;
  schoolYearId: string;
  status: string;
  assessment: {
    id: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
  } | null;
} | null> {
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) return null;

  const [assessment] = await db
    .select({
      id: assessments.id,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
    })
    .from(assessments)
    .where(
      and(eq(assessments.enrollmentId, enrollmentId), isNull(assessments.cancelledAt))
    )
    .limit(1);

  return {
    ...enrollment,
    assessment: assessment ?? null,
  };
}

/**
 * Get cancellation request by ID (minimal for validation)
 */
export async function getCancellationRequestForValidation(requestId: string): Promise<{
  id: string;
  enrollmentId: string;
  status: string;
  requestedBy: string;
} | null> {
  const [result] = await db
    .select({
      id: enrollmentCancellationRequests.id,
      enrollmentId: enrollmentCancellationRequests.enrollmentId,
      status: enrollmentCancellationRequests.status,
      requestedBy: enrollmentCancellationRequests.requestedBy,
    })
    .from(enrollmentCancellationRequests)
    .where(
      and(
        eq(enrollmentCancellationRequests.id, requestId),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  return result ?? null;
}

/**
 * Get cancellation history for an enrollment
 */
export async function getEnrollmentCancellationHistory(
  enrollmentId: string
): Promise<
  Array<{
    id: string;
    reasonType: CancellationReason;
    remarks: string | null;
    status: string;
    requestedAt: Date;
    requestedByName: string;
    reviewedAt: Date | null;
    reviewedByName: string | null;
    reviewRemarks: string | null;
  }>
> {
  // Create aliases for user joins
  const requestedByUser = alias(users, "requested_by_user");
  const reviewedByUser = alias(users, "reviewed_by_user");

  // Single query with JOINs for user names (fixes N+1)
  const rows = await db
    .select({
      id: enrollmentCancellationRequests.id,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
      status: enrollmentCancellationRequests.status,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      reviewRemarks: enrollmentCancellationRequests.reviewRemarks,
      requestedByName: requestedByUser.username,
      reviewedByName: reviewedByUser.username,
    })
    .from(enrollmentCancellationRequests)
    .leftJoin(requestedByUser, eq(enrollmentCancellationRequests.requestedBy, requestedByUser.id))
    .leftJoin(reviewedByUser, eq(enrollmentCancellationRequests.reviewedBy, reviewedByUser.id))
    .where(eq(enrollmentCancellationRequests.enrollmentId, enrollmentId))
    .orderBy(desc(enrollmentCancellationRequests.requestedAt));

  return rows.map((r) => ({
    id: r.id,
    reasonType: r.reasonType as CancellationReason,
    remarks: r.remarks,
    status: r.status,
    requestedAt: r.requestedAt,
    requestedByName: r.requestedByName ?? "Unknown",
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedByName ?? null,
    reviewRemarks: r.reviewRemarks,
  }));
}
