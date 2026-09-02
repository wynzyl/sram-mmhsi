"use server";

import { CACHE_TAGS, invalidateTag, invalidateTags } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  enrollments,
  enrollmentCancellationRequests,
  assessments,
  assessmentItems,
  payments,
  studentClearances,
  schoolYears,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import {
  RequestEnrollmentCancellationSchema,
  ApproveEnrollmentCancellationSchema,
  RejectEnrollmentCancellationSchema,
  WithdrawCancellationRequestSchema,
  DirectCancelEnrollmentSchema,
} from "./enrollment-cancellation.schema";
import type {
  RequestEnrollmentCancellationFormState,
  ApproveEnrollmentCancellationFormState,
  RejectEnrollmentCancellationFormState,
  WithdrawCancellationRequestFormState,
  DirectCancelEnrollmentFormState,
} from "./enrollment-cancellation.schema";
import {
  hasPendingCancellationRequest,
  getRefundCutoffConfig,
  getCancellationRequestForValidation,
} from "./enrollment-cancellation.queries";
import { lockEnrollment } from "@/lib/utils/tx-helpers";
import {
  assertStudentMutable,
  StudentArchivedException,
  formatArchiveError,
} from "@/features/archive/archive.guards";

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Check if a school year is active. Cancellations are only allowed for active school years.
 */
async function isSchoolYearActive(schoolYearId: string): Promise<boolean> {
  const [schoolYear] = await db
    .select({ isActive: schoolYears.isActive })
    .from(schoolYears)
    .where(eq(schoolYears.id, schoolYearId))
    .limit(1);

  return schoolYear?.isActive ?? false;
}

// ─── Helper Types ─────────────────────────────────────────────────────────────

type RefundResult = {
  isEligibleForRefund: boolean;
  cutoffDate: Date;
  refundableAmount: number;
  forfeitedAmount: number;
  totalPaid: number;
};

// ─── Request Cancellation Action ──────────────────────────────────────────────

/**
 * Request cancellation for an enrolled enrollment.
 * For pending/assessed enrollments, use directCancelEnrollmentAction instead.
 */
export async function requestEnrollmentCancellationAction(
  _prevState: RequestEnrollmentCancellationFormState,
  formData: FormData
): Promise<RequestEnrollmentCancellationFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "enrollments:cancel")) {
    return { message: PERMISSION_ERRORS.ENROLLMENTS_REQUEST_CANCELLATION };
  }

  const result = parseFormData(RequestEnrollmentCancellationSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { enrollmentId, reasonType, remarks } = result.data;

  try {
    let requestId: string | undefined;

    await db.transaction(async (tx) => {
      // 1. Lock and fetch enrollment
      const enrollment = await lockEnrollment(tx, enrollmentId);

      if (!enrollment) {
        throw new Error("Enrollment not found.");
      }

      // 2. Check if student is archived (blocked action) — run inside the tx
      //    so the check shares the enrollment row lock and cannot race a concurrent archive.
      await assertStudentMutable(enrollment.studentId, "cancel_enrollment", tx);

      // 3. Validate school year is active
      const schoolYearActive = await isSchoolYearActive(enrollment.schoolYearId);
      if (!schoolYearActive) {
        throw new Error("Cannot cancel enrollments from inactive school years.");
      }

      // 3. Validate enrollment status
      if (enrollment.status !== "enrolled") {
        throw new Error(
          `Cancellation requests are only for enrolled enrollments. ` +
          `Current status is "${enrollment.status}". Use direct cancellation for pending/assessed enrollments.`
        );
      }

      // 4. Check for existing pending request
      const existingRequest = await hasPendingCancellationRequest(enrollmentId);
      if (existingRequest) {
        throw new Error("A cancellation request is already pending for this enrollment.");
      }

      // 4. Create cancellation request
      const [newRequest] = await tx
        .insert(enrollmentCancellationRequests)
        .values({
          enrollmentId,
          requestedBy: session.userId,
          requestedAt: new Date(),
          reasonType: reasonType as CancellationReason,
          remarks: remarks ?? null,
          status: "pending",
        })
        .returning({ id: enrollmentCancellationRequests.id });

      requestId = newRequest.id;

      // 5. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_cancellation_requested",
        targetEntity: "enrollment_cancellation_requests",
        targetId: newRequest.id,
        newState: {
          enrollmentId,
          reasonType,
          reasonLabel: CANCELLATION_REASON_LABELS[reasonType as CancellationReason],
          remarks,
        },
      }, { throwOnFail: true });
    });

    logger.info("[enrollment-cancellation] Cancellation request created", {
      requestId,
      enrollmentId,
      actorId: session.userId,
    });

    // Single revalidation - cache tags handle cross-page invalidation
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    return {
      success: true,
      message: "Cancellation request submitted. An administrator will review your request.",
      requestId,
    };
  } catch (error: unknown) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    logger.error("[enrollment-cancellation] Failed to create cancellation request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Direct Cancel Enrollment Action ──────────────────────────────────────────

/**
 * Directly cancel a pending or assessed enrollment (no approval required).
 * Applies refund policy if payments exist.
 */
export async function directCancelEnrollmentAction(
  _prevState: DirectCancelEnrollmentFormState,
  formData: FormData
): Promise<DirectCancelEnrollmentFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "enrollments:cancel")) {
    return { message: PERMISSION_ERRORS.ENROLLMENTS_CANCEL };
  }

  const result = parseFormData(DirectCancelEnrollmentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { enrollmentId, reasonType, remarks } = result.data;

  try {
    let refundResult: RefundResult | null = null;

    await db.transaction(async (tx) => {
      // 1. Lock and fetch enrollment
      const enrollment = await lockEnrollment(tx, enrollmentId);

      if (!enrollment) {
        throw new Error("Enrollment not found.");
      }

      // 2. Check if student is archived (blocked action) — run inside the tx
      //    so the check shares the enrollment row lock and cannot race a concurrent archive.
      await assertStudentMutable(enrollment.studentId, "cancel_enrollment", tx);

      // 3. Validate school year is active
      const schoolYearActive = await isSchoolYearActive(enrollment.schoolYearId);
      if (!schoolYearActive) {
        throw new Error("Cannot cancel enrollments from inactive school years.");
      }

      // 4. Validate enrollment status - only pending/assessed allowed for direct cancellation
      if (enrollment.status === "enrolled") {
        throw new Error(
          "Enrolled enrollments require admin approval. Please submit a cancellation request instead."
        );
      }

      if (enrollment.status === "cancelled") {
        throw new Error("This enrollment is already cancelled.");
      }

      if (!["pending", "assessed"].includes(enrollment.status)) {
        throw new Error(`Cannot cancel enrollment with status "${enrollment.status}".`);
      }

      // 4. Check if assessment exists and has payments
      const [assessment] = await tx
        .select({
          id: assessments.id,
          totalPaid: assessments.totalPaid,
          balance: assessments.balance,
        })
        .from(assessments)
        .where(
          and(eq(assessments.enrollmentId, enrollmentId), isNull(assessments.cancelledAt))
        )
        .limit(1);

      if (assessment && Number(assessment.totalPaid) > 0) {
        // Apply refund policy
        refundResult = await processRefundForCancellation(
          tx,
          assessment.id,
          session.userId,
          session.role
        );
      }

      // 4. Cancel assessment if exists
      if (assessment) {
        await tx
          .update(assessments)
          .set({
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            billingStatus: "cancelled",
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(assessments.id, assessment.id));
      }

      // 5. Cancel enrollment
      const cancelRemarksFull = buildCancelRemarks(reasonType as CancellationReason, remarks);
      await tx
        .update(enrollments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: session.userId,
          cancelRemarks: cancelRemarksFull,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(enrollments.id, enrollmentId));

      // 6. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_cancelled_direct",
        targetEntity: "enrollments",
        targetId: enrollmentId,
        previousState: { status: enrollment.status },
        newState: {
          status: "cancelled",
          reasonType,
          reasonLabel: CANCELLATION_REASON_LABELS[reasonType as CancellationReason],
          remarks,
          ...(refundResult && {
            refundDetails: {
              isEligibleForRefund: refundResult.isEligibleForRefund,
              cutoffDate: refundResult.cutoffDate.toISOString(),
              refundableAmount: refundResult.refundableAmount,
              forfeitedAmount: refundResult.forfeitedAmount,
              totalPaid: refundResult.totalPaid,
            },
          }),
        },
      }, { throwOnFail: true });
    });

    logger.info("[enrollment-cancellation] Enrollment cancelled directly", {
      enrollmentId,
      actorId: session.userId,
      refundResult,
    });

    // Single revalidation - cache tags handle cross-page invalidation.
    // STRANDS too: getAllStrands counts enrollments per track excluding
    // "cancelled", so cancelling one changes that track's enrollmentCount.
    invalidateTags(CACHE_TAGS.ENROLLMENTS, CACHE_TAGS.STRANDS);

    const result: DirectCancelEnrollmentFormState = {
      success: true,
      message: "Enrollment cancelled successfully.",
    };

    // TypeScript flow analysis breaks across async transaction callbacks,
    // so we use non-null assertion after checking. Variable was assigned in transaction.
    if (refundResult !== null) {
      const rf = refundResult as RefundResult;
      result.refundDetails = {
        isEligibleForRefund: rf.isEligibleForRefund,
        cutoffDate: rf.cutoffDate.toISOString(),
        refundableAmount: rf.refundableAmount,
        forfeitedAmount: rf.forfeitedAmount,
        totalPaid: rf.totalPaid,
      };
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    logger.error("[enrollment-cancellation] Failed to cancel enrollment directly", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Approve Cancellation Action ──────────────────────────────────────────────

/**
 * Approve a pending cancellation request.
 * Admin-only. Processes refund policy and creates clearance if needed.
 */
export async function approveEnrollmentCancellationAction(
  _prevState: ApproveEnrollmentCancellationFormState,
  formData: FormData
): Promise<ApproveEnrollmentCancellationFormState> {
  const session = await requireStaffSession();

  // Only admin/super_admin can approve
  if (!["admin", "super_admin"].includes(session.role)) {
    return { message: "Only administrators can approve cancellation requests." };
  }

  const result = parseFormData(ApproveEnrollmentCancellationSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { requestId, reviewRemarks } = result.data;

  try {
    let refundResult: RefundResult | null = null;
    let clearanceId: string | undefined;

    await db.transaction(async (tx) => {
      // 1. Fetch and validate request
      const request = await getCancellationRequestForValidation(requestId);

      if (!request) {
        throw new Error("Cancellation request not found.");
      }

      if (request.status !== "pending") {
        throw new Error(`Cannot approve a ${request.status} request. Only pending requests can be approved.`);
      }

      // 2. Block self-approval
      if (request.requestedBy === session.userId) {
        throw new Error("Self-approval is not allowed. Another administrator must approve this request.");
      }

      // 3. Lock and fetch enrollment
      const enrollment = await lockEnrollment(tx, request.enrollmentId);

      if (!enrollment) {
        throw new Error("Enrollment not found.");
      }

      if (enrollment.status !== "enrolled") {
        throw new Error(`Enrollment status has changed to "${enrollment.status}". Cannot proceed with approval.`);
      }

      // 4. Get assessment
      const [assessment] = await tx
        .select({
          id: assessments.id,
          totalPaid: assessments.totalPaid,
          balance: assessments.balance,
          studentId: assessments.studentId,
          schoolYearId: assessments.schoolYearId,
        })
        .from(assessments)
        .where(
          and(eq(assessments.enrollmentId, request.enrollmentId), isNull(assessments.cancelledAt))
        )
        .limit(1);

      // 5. Process refund if assessment has payments
      if (assessment && Number(assessment.totalPaid) > 0) {
        refundResult = await processRefundForCancellation(
          tx,
          assessment.id,
          session.userId,
          session.role
        );
      }

      // 6. Create clearance if there's outstanding balance
      if (assessment) {
        const outstandingBalance = Number(assessment.balance);
        if (outstandingBalance > 0.01) {
          const [clearance] = await tx
            .insert(studentClearances)
            .values({
              studentId: assessment.studentId,
              enrollmentId: request.enrollmentId,
              schoolYearId: assessment.schoolYearId,
              clearanceType: "enrollment_cancellation",
              outstandingAmount: assessment.balance,
              status: "pending",
              createdBy: session.userId,
            })
            .returning({ id: studentClearances.id });

          clearanceId = clearance.id;

          await logAudit({
            actor: session.userId,
            actorRole: session.role,
            action: "clearance_created_from_cancellation",
            targetEntity: "student_clearances",
            targetId: clearance.id,
            newState: {
              enrollmentId: request.enrollmentId,
              outstandingAmount: assessment.balance,
              reason: "Enrollment cancellation with balance",
            },
          }, { throwOnFail: true });
        }
      }

      // 7. Cancel assessment
      if (assessment) {
        await tx
          .update(assessments)
          .set({
            cancelledAt: new Date(),
            cancelledBy: session.userId,
            billingStatus: "cancelled",
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(eq(assessments.id, assessment.id));
      }

      // 8. Cancel enrollment
      await tx
        .update(enrollments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: session.userId,
          cancelRemarks: `Cancellation approved by admin. ${reviewRemarks || ""}`.trim(),
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(enrollments.id, request.enrollmentId));

      // 9. Update request status
      await tx
        .update(enrollmentCancellationRequests)
        .set({
          status: "approved",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          reviewRemarks: reviewRemarks ?? null,
        })
        .where(eq(enrollmentCancellationRequests.id, requestId));

      // 10. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_cancellation_approved",
        targetEntity: "enrollment_cancellation_requests",
        targetId: requestId,
        newState: {
          enrollmentId: request.enrollmentId,
          reviewRemarks,
          ...(refundResult && {
            refundDetails: {
              isEligibleForRefund: refundResult.isEligibleForRefund,
              cutoffDate: refundResult.cutoffDate.toISOString(),
              refundableAmount: refundResult.refundableAmount,
              forfeitedAmount: refundResult.forfeitedAmount,
              totalPaid: refundResult.totalPaid,
            },
          }),
          ...(clearanceId && { clearanceId }),
        },
      }, { throwOnFail: true });
    });

    logger.info("[enrollment-cancellation] Cancellation request approved", {
      requestId,
      actorId: session.userId,
      refundResult,
      clearanceId,
    });

    // Consolidated revalidation - cache tags handle cross-page invalidation.
    // STRANDS too: getAllStrands counts enrollments per track excluding
    // "cancelled", so cancelling one changes that track's enrollmentCount.
    invalidateTags(CACHE_TAGS.ENROLLMENTS, CACHE_TAGS.STRANDS);

    const result: ApproveEnrollmentCancellationFormState = {
      success: true,
      message: "Cancellation request approved. Enrollment has been cancelled.",
      clearanceId,
    };

    // TypeScript flow analysis breaks across async transaction callbacks,
    // so we use non-null assertion after checking. Variable was assigned in transaction.
    if (refundResult !== null) {
      const rf = refundResult as RefundResult;
      result.refundDetails = {
        isEligibleForRefund: rf.isEligibleForRefund,
        cutoffDate: rf.cutoffDate.toISOString(),
        refundableAmount: rf.refundableAmount,
        forfeitedAmount: rf.forfeitedAmount,
        totalPaid: rf.totalPaid,
      };
    }

    return result;
  } catch (error: unknown) {
    logger.error("[enrollment-cancellation] Failed to approve cancellation request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Reject Cancellation Action ───────────────────────────────────────────────

/**
 * Reject a pending cancellation request.
 * Admin-only. Enrollment remains unchanged.
 */
export async function rejectEnrollmentCancellationAction(
  _prevState: RejectEnrollmentCancellationFormState,
  formData: FormData
): Promise<RejectEnrollmentCancellationFormState> {
  const session = await requireStaffSession();

  // Only admin/super_admin can reject
  if (!["admin", "super_admin"].includes(session.role)) {
    return { message: "Only administrators can reject cancellation requests." };
  }

  const result = parseFormData(RejectEnrollmentCancellationSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { requestId, reviewRemarks } = result.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch and validate request
      const request = await getCancellationRequestForValidation(requestId);

      if (!request) {
        throw new Error("Cancellation request not found.");
      }

      if (request.status !== "pending") {
        throw new Error(`Cannot reject a ${request.status} request. Only pending requests can be rejected.`);
      }

      // 2. Block self-rejection
      if (request.requestedBy === session.userId) {
        throw new Error(
          "You cannot reject your own cancellation request. Use the withdraw option instead, or have another administrator review it."
        );
      }

      // 3. Update request status
      await tx
        .update(enrollmentCancellationRequests)
        .set({
          status: "rejected",
          reviewedBy: session.userId,
          reviewedAt: new Date(),
          reviewRemarks,
        })
        .where(eq(enrollmentCancellationRequests.id, requestId));

      // 4. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_cancellation_rejected",
        targetEntity: "enrollment_cancellation_requests",
        targetId: requestId,
        newState: {
          enrollmentId: request.enrollmentId,
          reviewRemarks,
        },
      }, { throwOnFail: true });
    });

    logger.info("[enrollment-cancellation] Cancellation request rejected", {
      requestId,
      actorId: session.userId,
    });

    // Single revalidation - cache tags handle cross-page invalidation
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    return { success: true, message: "Cancellation request rejected." };
  } catch (error: unknown) {
    logger.error("[enrollment-cancellation] Failed to reject cancellation request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Withdraw Cancellation Request Action ─────────────────────────────────────

/**
 * Withdraw a pending cancellation request.
 * Only the original requester can withdraw their request.
 */
export async function withdrawCancellationRequestAction(
  _prevState: WithdrawCancellationRequestFormState,
  formData: FormData
): Promise<WithdrawCancellationRequestFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "enrollments:cancel")) {
    return { message: PERMISSION_ERRORS.ENROLLMENTS_WITHDRAW_CANCELLATION };
  }

  const result = parseFormData(WithdrawCancellationRequestSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { requestId } = result.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch and validate request
      const request = await getCancellationRequestForValidation(requestId);

      if (!request) {
        throw new Error("Cancellation request not found.");
      }

      if (request.status !== "pending") {
        throw new Error(`Cannot withdraw a ${request.status} request. Only pending requests can be withdrawn.`);
      }

      // 2. Only the original requester can withdraw
      if (request.requestedBy !== session.userId) {
        throw new Error("You can only withdraw your own cancellation requests.");
      }

      // 3. Update request status
      await tx
        .update(enrollmentCancellationRequests)
        .set({
          status: "cancelled",
        })
        .where(eq(enrollmentCancellationRequests.id, requestId));

      // 4. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "enrollment_cancellation_withdrawn",
        targetEntity: "enrollment_cancellation_requests",
        targetId: requestId,
        newState: { enrollmentId: request.enrollmentId },
      }, { throwOnFail: true });
    });

    logger.info("[enrollment-cancellation] Cancellation request withdrawn", {
      requestId,
      actorId: session.userId,
    });

    // Single revalidation - cache tags handle cross-page invalidation
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    return { success: true, message: "Cancellation request withdrawn." };
  } catch (error: unknown) {
    logger.error("[enrollment-cancellation] Failed to withdraw cancellation request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Process refund for cancellation based on refund policy.
 * Returns refund calculation result.
 */
async function processRefundForCancellation(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  assessmentId: string,
  actorId: string,
  actorRole: string
): Promise<RefundResult> {
  // Get cutoff configuration
  const cutoffConfig = await getRefundCutoffConfig();
  if (!cutoffConfig) {
    // No cutoff configured - no refunds
    return {
      isEligibleForRefund: false,
      cutoffDate: new Date(),
      refundableAmount: 0,
      forfeitedAmount: 0,
      totalPaid: 0,
    };
  }

  const now = new Date();
  const isEligibleForRefund = now <= cutoffConfig.cutoffDate;

  // Get assessment items with refundability and amounts
  const items = await tx
    .select({
      id: assessmentItems.id,
      description: assessmentItems.description,
      amount: assessmentItems.amount,
      isRefundable: assessmentItems.isRefundable,
      isDiscount: assessmentItems.isDiscount,
    })
    .from(assessmentItems)
    .where(eq(assessmentItems.assessmentId, assessmentId));

  // Get all posted payments
  const postedPayments = await tx
    .select({
      id: payments.id,
      amount: payments.amount,
    })
    .from(payments)
    .where(
      and(
        eq(payments.assessmentId, assessmentId),
        eq(payments.status, "posted"),
        eq(payments.kind, "payment")
      )
    );

  // Calculate total non-refundable item amounts (fees that are forfeited first)
  // This approach works with lump-sum payments where paymentAllocations may be empty
  let totalNonRefundableItemAmount = 0;

  for (const item of items) {
    if (item.isDiscount) continue;

    const itemAmount = Number(item.amount);
    if (!item.isRefundable) {
      totalNonRefundableItemAmount += itemAmount;
    }
  }

  // Get total paid from payments
  const totalPaid = postedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Non-refundable fees are deducted first, remainder is refunded
  // Cap non-refundable at total paid (can't forfeit more than was paid)
  const nonRefundableAmount = Math.min(totalNonRefundableItemAmount, totalPaid);
  const refundableAmount = totalPaid - nonRefundableAmount;

  // If eligible for refund, create single reversal entry for total refundable amount
  if (isEligibleForRefund && refundableAmount > 0) {
    // Get the latest payment's details for reference
    const latestPayment = postedPayments[0]; // First in array (most recent if ordered by date)
    const [paymentDetails] = await tx
      .select({
        orNumber: payments.orNumber,
        studentId: payments.studentId,
      })
      .from(payments)
      .where(eq(payments.id, latestPayment.id))
      .limit(1);

    // Create single reversal entry for total refundable amount
    const reversalReferenceNumber = paymentDetails?.orNumber
      ? `REV-CANCEL-${paymentDetails.orNumber}`
      : `REV-CANCEL-${assessmentId.substring(0, 8)}`;

    await tx.insert(payments).values({
      studentId: paymentDetails?.studentId ?? "",
      assessmentId,
      bookletId: null,
      orNumber: null,
      orStatus: "available",
      amount: String(-refundableAmount), // Negative amount for reversal
      paymentMethod: "cancellation_reversal",
      referenceNumber: reversalReferenceNumber,
      paymentDate: new Date(),
      status: "reversal",
      kind: "reversal",
      reversesPaymentId: latestPayment.id,
      remarks: `Refund reversal due to enrollment cancellation. Total paid: ₱${totalPaid.toFixed(2)}, Non-refundable fees forfeited: ₱${nonRefundableAmount.toFixed(2)}, Refund: ₱${refundableAmount.toFixed(2)}`,
      createdBy: actorId,
      updatedBy: actorId,
    });

    // Update assessment totalPaid to reflect only non-refundable amounts
    await tx
      .update(assessments)
      .set({
        totalPaid: String(nonRefundableAmount),
        balance: "0", // Cancelled, so balance is 0
        updatedAt: new Date(),
        updatedBy: actorId,
      })
      .where(eq(assessments.id, assessmentId));

    await logAudit({
      actor: actorId,
      actorRole,
      action: "cancellation_refund_processed",
      targetEntity: "assessments",
      targetId: assessmentId,
      newState: {
        isEligibleForRefund: true,
        cutoffDate: cutoffConfig.cutoffDate.toISOString(),
        totalPaid,
        nonRefundableForfeit: nonRefundableAmount,
        refundAmount: refundableAmount,
      },
    }, { throwOnFail: true });
  }

  return {
    isEligibleForRefund,
    cutoffDate: cutoffConfig.cutoffDate,
    refundableAmount: isEligibleForRefund ? refundableAmount : 0,
    forfeitedAmount: nonRefundableAmount + (isEligibleForRefund ? 0 : refundableAmount),
    totalPaid,
  };
}

/**
 * Build cancel remarks string from reason type and optional remarks
 */
function buildCancelRemarks(reasonType: CancellationReason, remarks?: string): string {
  const reasonLabel = CANCELLATION_REASON_LABELS[reasonType];
  if (remarks) {
    return `${reasonLabel}: ${remarks}`;
  }
  return reasonLabel;
}
