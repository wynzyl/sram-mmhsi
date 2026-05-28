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
  paymentAllocations,
  users,
  systemSettings,
} from "@/lib/db/schema";
import { eq, and, isNull, desc, sql, inArray } from "drizzle-orm";
import {
  type PaginationParams,
  type PaginatedResult,
  calculatePagination,
  calculateOffset,
} from "@/lib/types/pagination";
import type { CancellationReason } from "@/lib/constants/cancellation-reasons";

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type CancellationRequestListItem = {
  id: string;
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  studentName: string;
  gradeLevelName: string;
  schoolYearLabel: string;
  reasonType: CancellationReason;
  remarks: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requestedAt: Date;
  requestedByName: string;
  reviewedAt: Date | null;
  reviewedByName: string | null;
};

export type CancellationRequestDetail = CancellationRequestListItem & {
  enrollmentStatus: "pending" | "assessed" | "enrolled" | "cancelled";
  reviewRemarks: string | null;
  // Assessment info (if exists)
  assessment: {
    id: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
    billingStatus: string;
  } | null;
  // Refund calculation preview (computed)
  refundPreview: RefundCalculation | null;
};

export type RefundCalculation = {
  isEligibleForRefund: boolean;
  cutoffDate: Date;
  refundableAmount: number;
  nonRefundableAmount: number;
  totalPaid: number;
  itemBreakdown: Array<{
    description: string;
    paidAmount: number;
    isRefundable: boolean;
    willRefund: boolean;
  }>;
};

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
  const [result] = await db
    .select({
      id: enrollmentCancellationRequests.id,
      requestedBy: enrollmentCancellationRequests.requestedBy,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
    })
    .from(enrollmentCancellationRequests)
    .where(
      and(
        eq(enrollmentCancellationRequests.enrollmentId, enrollmentId),
        eq(enrollmentCancellationRequests.status, "pending"),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  if (!result) return null;

  // Get user name
  const [user] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, result.requestedBy))
    .limit(1);

  return {
    ...result,
    requestedByName: user?.username ?? "Unknown",
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

  // Get total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .where(and(...conditions));

  const totalRecords = Number(countResult?.count || 0);

  // Get paginated data with joins
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
      requestedBy: enrollmentCancellationRequests.requestedBy,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      reviewedBy: enrollmentCancellationRequests.reviewedBy,
    })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .where(and(...conditions))
    .orderBy(desc(enrollmentCancellationRequests.requestedAt))
    .limit(params.pageSize)
    .offset(offset);

  // Fetch user names for requestedBy and reviewedBy
  const userIds = new Set<string>();
  rows.forEach((r) => {
    userIds.add(r.requestedBy);
    if (r.reviewedBy) userIds.add(r.reviewedBy);
  });

  const userNames = new Map<string, string>();
  if (userIds.size > 0) {
    const usersData = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, Array.from(userIds)));

    usersData.forEach((u) => userNames.set(u.id, u.username));
  }

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
    requestedByName: userNames.get(r.requestedBy) ?? "Unknown",
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedBy ? userNames.get(r.reviewedBy) ?? "Unknown" : null,
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
      requestedBy: enrollmentCancellationRequests.requestedBy,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      reviewedBy: enrollmentCancellationRequests.reviewedBy,
      reviewRemarks: enrollmentCancellationRequests.reviewRemarks,
      enrollmentStatus: enrollments.status,
    })
    .from(enrollmentCancellationRequests)
    .innerJoin(enrollments, eq(enrollmentCancellationRequests.enrollmentId, enrollments.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(enrollmentCancellationRequests.id, requestId),
        isNull(enrollmentCancellationRequests.deletedAt)
      )
    )
    .limit(1);

  if (!row) return null;

  // Get user names
  const userIds = [row.requestedBy];
  if (row.reviewedBy) userIds.push(row.reviewedBy);

  const usersData = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, userIds));

  const userNames = new Map<string, string>();
  usersData.forEach((u) => userNames.set(u.id, u.username));

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
    requestedByName: userNames.get(row.requestedBy) ?? "Unknown",
    reviewedAt: row.reviewedAt,
    reviewedByName: row.reviewedBy ? userNames.get(row.reviewedBy) ?? "Unknown" : null,
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

  // Get payment allocations
  const paymentIds = paymentsData.map((p) => p.id);
  let allocations: { paymentId: string; assessmentItemId: string | null; amount: string }[] = [];

  if (paymentIds.length > 0) {
    allocations = await db
      .select({
        paymentId: paymentAllocations.paymentId,
        assessmentItemId: paymentAllocations.assessmentItemId,
        amount: paymentAllocations.amount,
      })
      .from(paymentAllocations)
      .where(inArray(paymentAllocations.paymentId, paymentIds));
  }

  // Create item map for quick lookup
  const itemMap = new Map(items.map((item) => [item.id, item]));

  // Calculate amounts per item
  const itemPaidAmounts = new Map<string, number>();
  for (const alloc of allocations) {
    if (alloc.assessmentItemId) {
      const current = itemPaidAmounts.get(alloc.assessmentItemId) || 0;
      itemPaidAmounts.set(alloc.assessmentItemId, current + Number(alloc.amount));
    }
  }

  // Calculate breakdown
  let refundableAmount = 0;
  let nonRefundableAmount = 0;
  const itemBreakdown: RefundCalculation["itemBreakdown"] = [];

  for (const item of items) {
    if (item.isDiscount) continue; // Skip discount lines

    const paidAmount = itemPaidAmounts.get(item.id) || 0;
    const willRefund = isEligibleForRefund && item.isRefundable && paidAmount > 0;

    if (paidAmount > 0) {
      if (item.isRefundable) {
        refundableAmount += paidAmount;
      } else {
        nonRefundableAmount += paidAmount;
      }

      itemBreakdown.push({
        description: item.description,
        paidAmount,
        isRefundable: item.isRefundable,
        willRefund,
      });
    }
  }

  const totalPaid = refundableAmount + nonRefundableAmount;

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
  const rows = await db
    .select({
      id: enrollmentCancellationRequests.id,
      reasonType: enrollmentCancellationRequests.reasonType,
      remarks: enrollmentCancellationRequests.remarks,
      status: enrollmentCancellationRequests.status,
      requestedAt: enrollmentCancellationRequests.requestedAt,
      requestedBy: enrollmentCancellationRequests.requestedBy,
      reviewedAt: enrollmentCancellationRequests.reviewedAt,
      reviewedBy: enrollmentCancellationRequests.reviewedBy,
      reviewRemarks: enrollmentCancellationRequests.reviewRemarks,
    })
    .from(enrollmentCancellationRequests)
    .where(eq(enrollmentCancellationRequests.enrollmentId, enrollmentId))
    .orderBy(desc(enrollmentCancellationRequests.requestedAt));

  // Get user names
  const userIds = new Set<string>();
  rows.forEach((r) => {
    userIds.add(r.requestedBy);
    if (r.reviewedBy) userIds.add(r.reviewedBy);
  });

  const userNames = new Map<string, string>();
  if (userIds.size > 0) {
    const usersData = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.id, Array.from(userIds)));

    usersData.forEach((u) => userNames.set(u.id, u.username));
  }

  return rows.map((r) => ({
    id: r.id,
    reasonType: r.reasonType as CancellationReason,
    remarks: r.remarks,
    status: r.status,
    requestedAt: r.requestedAt,
    requestedByName: userNames.get(r.requestedBy) ?? "Unknown",
    reviewedAt: r.reviewedAt,
    reviewedByName: r.reviewedBy ? userNames.get(r.reviewedBy) ?? "Unknown" : null,
    reviewRemarks: r.reviewRemarks,
  }));
}
