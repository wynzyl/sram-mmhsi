"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag, forceUpdateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  payments,
  assessments,
  voidRequests,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  RequestVoidSchema,
  ApproveVoidRequestSchema,
  RejectVoidRequestSchema,
  CancelVoidRequestSchema,
} from "./void-requests.schema";
import type {
  RequestVoidFormState,
  ApproveVoidRequestFormState,
  RejectVoidRequestFormState,
  CancelVoidRequestFormState,
} from "./void-requests.schema";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import {
  lockPayment,
  lockAssessment,
  lockVoidRequest,
  lockAssessmentTransferStatus,
  assertAssessmentNotTransferred,
} from "@/lib/utils/tx-helpers";
import { revertToAssessedOnVoid } from "@/lib/utils/enrollment-status";
import { applyAssessmentBalanceDelta } from "@/lib/utils/assessment-balance";
import { ASSESSMENT_BALANCE_FULLY_PAID_EPSILON } from "@/lib/utils/assessment-billing";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";

// ─── Request Void Action ───────────────────────────────────────────────────────

/**
 * Creates a void request for a posted payment.
 * Cashiers/registrars can request; admins approve/reject.
 */
export async function requestVoidAction(
  _prevState: RequestVoidFormState,
  formData: FormData
): Promise<RequestVoidFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:void_request")) {
    return { message: "You do not have permission to request payment voids." };
  }

  const parsed = RequestVoidSchema.safeParse({
    paymentId: formData.get("paymentId"),
    requestReason: formData.get("requestReason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as RequestVoidFormState["errors"] };
  }

  const { paymentId, requestReason } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Lock and fetch payment
      const payment = await lockPayment(tx, paymentId);

      if (!payment) {
        throw new Error("Payment not found.");
      }

      // 2. Validate payment state
      if (payment.kind !== "payment") {
        throw new Error("Cannot request void on a reversal entry. Only original payments can be voided.");
      }

      if (payment.status !== "posted") {
        throw new Error(`Cannot request void on a ${payment.status} payment. Only posted payments can be voided.`);
      }

      // 3. Check if assessment is transferred
      if (payment.assessmentId) {
        const transferStatus = await lockAssessmentTransferStatus(tx, payment.assessmentId);
        assertAssessmentNotTransferred(
          transferStatus?.transferredAt ?? null,
          "request void on this payment"
        );

        // Check for pending cancellation request (blocks void requests too)
        const assessmentForCheck = await tx.query.assessments.findFirst({
          where: eq(assessments.id, payment.assessmentId),
          columns: { enrollmentId: true },
        });
        await assertNoPendingCancellation(assessmentForCheck?.enrollmentId, "request void");
      }

      // 4. Check for existing pending request (DB constraint will also enforce, but we want a nice message)
      const existingPending = await tx.query.voidRequests.findFirst({
        where: eq(voidRequests.paymentId, paymentId),
        columns: { id: true, status: true },
      });

      if (existingPending && existingPending.status === "pending") {
        throw new Error("A void request is already pending for this payment. Please wait for it to be processed.");
      }

      // 5. Create void request
      const [newRequest] = await tx
        .insert(voidRequests)
        .values({
          paymentId,
          requestReason,
          status: "pending",
          requestedBy: session.userId,
          requestedAt: new Date(),
        })
        .returning({ id: voidRequests.id });

      // 6. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "void_request_created",
        targetEntity: "void_requests",
        targetId: newRequest.id,
        newState: {
          paymentId,
          orNumber: payment.orNumber,
          amount: payment.amount,
          reason: requestReason,
        },
      }, { throwOnFail: true });
    });

    revalidatePath("/staff/void-requests");
    revalidatePath("/staff/assessments");
    return { success: true, message: "Void request submitted. An administrator will review your request." };
  } catch (error: unknown) {
    logger.error("[void-request] Failed to create void request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Approve Void Request Action ───────────────────────────────────────────────

/**
 * Approves a pending void request and executes the reversal.
 * Admin-only. Creates a reversal payment entry to offset the original.
 */
export async function approveVoidRequestAction(
  _prevState: ApproveVoidRequestFormState,
  formData: FormData
): Promise<ApproveVoidRequestFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:void_approve")) {
    return { message: "You do not have permission to approve void requests." };
  }

  const parsed = ApproveVoidRequestSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as ApproveVoidRequestFormState["errors"] };
  }

  const { requestId } = parsed.data;

  try {
    let assessmentIdForRevalidation: string | null = null;

    await db.transaction(async (tx) => {
      // 1. Lock and fetch void request
      const request = await lockVoidRequest(tx, requestId);

      if (!request) {
        throw new Error("Void request not found.");
      }

      // 2. Validate request state
      if (request.status !== "pending") {
        throw new Error(`Cannot approve a ${request.status} request. Only pending requests can be approved.`);
      }

      // 3. Block self-approval
      if (request.requestedBy === session.userId) {
        throw new Error("Self-approval is not allowed. Another administrator must approve this request.");
      }

      // 4. Lock and fetch original payment
      const originalPayment = await lockPayment(tx, request.paymentId);

      if (!originalPayment) {
        throw new Error("Original payment not found.");
      }

      // 5. Validate payment can still be reversed
      if (originalPayment.status !== "posted") {
        throw new Error(`Payment is no longer posted (current status: ${originalPayment.status}). Cannot approve void.`);
      }

      if (originalPayment.kind !== "payment") {
        throw new Error("Cannot void a reversal entry.");
      }

      // 6. Check assessment transfer status again (could have changed since request was created)
      if (originalPayment.assessmentId) {
        const assessment = await lockAssessment(tx, originalPayment.assessmentId);
        if (assessment) {
          assertAssessmentNotTransferred(
            assessment.transferredAt,
            "approve void request"
          );
          assessmentIdForRevalidation = assessment.id;

          // 7. Update original payment to "reversed" status
          await tx
            .update(payments)
            .set({
              status: "reversed",
              reversedAt: new Date(),
              reversedBy: session.userId,
              reversedByRequestId: requestId,
              updatedBy: session.userId,
              updatedAt: new Date(),
            })
            .where(eq(payments.id, originalPayment.id));

          // 8. Create reversal payment entry
          const reversalReferenceNumber = originalPayment.orNumber
            ? `REV-${originalPayment.orNumber}`
            : `REV-${originalPayment.id.substring(0, 8)}`;

          const [reversalPayment] = await tx
            .insert(payments)
            .values({
              studentId: originalPayment.studentId,
              assessmentId: originalPayment.assessmentId,
              bookletId: null, // Reversals don't consume OR
              orNumber: null,  // Reversals don't have OR number
              orStatus: "available", // N/A for reversals
              amount: `-${originalPayment.amount}`, // Negative amount
              paymentMethod: originalPayment.paymentMethod,
              referenceNumber: reversalReferenceNumber,
              paymentDate: new Date(),
              status: "reversal",
              kind: "reversal",
              reversesPaymentId: originalPayment.id,
              remarks: `Reversal of OR ${originalPayment.orNumber ?? "N/A"} - ${request.requestReason}`,
              createdBy: session.userId,
              updatedBy: session.userId,
            })
            .returning({ id: payments.id });

          // 9. Update assessment balance
          const originalAmount = Number(originalPayment.amount);
          const previousTotalPaid = assessment.totalPaid;
          const previousBalance = assessment.balance;
          const { newTotalPaid, newBalance } = await applyAssessmentBalanceDelta(
            tx,
            originalPayment.assessmentId,
            -originalAmount, // negative = reversal
            assessment.cancelledAt,
            assessment.transferredAt,
            session.userId
          );

          // 9b. Revert enrollment status to "assessed" if total paid becomes zero
          if (
            newTotalPaid <= ASSESSMENT_BALANCE_FULLY_PAID_EPSILON &&
            assessment.enrollmentId
          ) {
            await revertToAssessedOnVoid(
              {
                tx,
                enrollmentId: assessment.enrollmentId,
                userId: session.userId,
                userRole: session.role,
              },
              `Total paid reverted to zero after approving void request`
            );
          }

          // 10. Update void request to approved
          await tx
            .update(voidRequests)
            .set({
              status: "approved",
              decidedBy: session.userId,
              decidedAt: new Date(),
              reversalPaymentId: reversalPayment.id,
              updatedAt: new Date(),
            })
            .where(eq(voidRequests.id, requestId));

          // 11. Audit logs
          await logAudit({
            actor: session.userId,
            actorRole: session.role,
            action: "void_request_approved",
            targetEntity: "void_requests",
            targetId: requestId,
            newState: {
              reversalPaymentId: reversalPayment.id,
              originalPaymentId: originalPayment.id,
              orNumber: originalPayment.orNumber,
              amount: originalPayment.amount,
            },
          }, { throwOnFail: true });

          await logAudit({
            actor: session.userId,
            actorRole: session.role,
            action: "payment_reversed",
            targetEntity: "payments",
            targetId: originalPayment.id,
            context: `Reversal ID: ${reversalPayment.id}, OR: ${originalPayment.orNumber}, Amount: ${originalPayment.amount}`,
            previousState: { status: "posted", totalPaid: previousTotalPaid, balance: previousBalance },
            newState: { status: "reversed", totalPaid: String(newTotalPaid), balance: String(newBalance) },
          }, { throwOnFail: true });
        }
      } else {
        // Payment without assessment - just mark as reversed
        await tx
          .update(payments)
          .set({
            status: "reversed",
            reversedAt: new Date(),
            reversedBy: session.userId,
            reversedByRequestId: requestId,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, originalPayment.id));

        // Create reversal entry
        const reversalReferenceNumber = originalPayment.orNumber
          ? `REV-${originalPayment.orNumber}`
          : `REV-${originalPayment.id.substring(0, 8)}`;

        const [reversalPayment] = await tx
          .insert(payments)
          .values({
            studentId: originalPayment.studentId,
            assessmentId: null,
            bookletId: null,
            orNumber: null,
            orStatus: "available",
            amount: `-${originalPayment.amount}`,
            paymentMethod: originalPayment.paymentMethod,
            referenceNumber: reversalReferenceNumber,
            paymentDate: new Date(),
            status: "reversal",
            kind: "reversal",
            reversesPaymentId: originalPayment.id,
            remarks: `Reversal of OR ${originalPayment.orNumber ?? "N/A"} - ${request.requestReason}`,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: payments.id });

        await tx
          .update(voidRequests)
          .set({
            status: "approved",
            decidedBy: session.userId,
            decidedAt: new Date(),
            reversalPaymentId: reversalPayment.id,
            updatedAt: new Date(),
          })
          .where(eq(voidRequests.id, requestId));

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "void_request_approved",
          targetEntity: "void_requests",
          targetId: requestId,
          newState: {
            reversalPaymentId: reversalPayment.id,
            originalPaymentId: originalPayment.id,
            orNumber: originalPayment.orNumber,
            amount: originalPayment.amount,
          },
        }, { throwOnFail: true });

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "payment_reversed",
          targetEntity: "payments",
          targetId: originalPayment.id,
          context: `Reversal ID: ${reversalPayment.id}, OR: ${originalPayment.orNumber}, Amount: ${originalPayment.amount}`,
        }, { throwOnFail: true });
      }
    });

    revalidatePath("/staff/void-requests");
    if (assessmentIdForRevalidation) {
      revalidatePath(`/staff/assessments/${assessmentIdForRevalidation}`);
    }
    revalidatePath("/staff/assessments");
    // Dashboard KPIs reflect reversed collection totals.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    // Enrollment status may have reverted to "assessed" if all payments were reversed.
    forceUpdateTag(CACHE_TAGS.ENROLLMENTS);
    return { success: true, message: "Void request approved. Payment has been reversed." };
  } catch (error: unknown) {
    logger.error("[void-request] Failed to approve void request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Reject Void Request Action ────────────────────────────────────────────────

/**
 * Rejects a pending void request.
 * Admin-only. Original payment remains posted.
 */
export async function rejectVoidRequestAction(
  _prevState: RejectVoidRequestFormState,
  formData: FormData
): Promise<RejectVoidRequestFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:void_approve")) {
    return { message: "You do not have permission to reject void requests." };
  }

  const parsed = RejectVoidRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    decisionRemarks: formData.get("decisionRemarks"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as RejectVoidRequestFormState["errors"] };
  }

  const { requestId, decisionRemarks } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Lock and fetch void request
      const request = await lockVoidRequest(tx, requestId);

      if (!request) {
        throw new Error("Void request not found.");
      }

      // 2. Validate request state
      if (request.status !== "pending") {
        throw new Error(`Cannot reject a ${request.status} request. Only pending requests can be rejected.`);
      }

      // 3. Block self-rejection (same user who requested)
      if (request.requestedBy === session.userId) {
        throw new Error(
          "You cannot reject your own void request. Use the cancel option instead, or have another administrator review it."
        );
      }

      // 4. Update void request to rejected
      await tx
        .update(voidRequests)
        .set({
          status: "rejected",
          decidedBy: session.userId,
          decidedAt: new Date(),
          decisionRemarks,
          updatedAt: new Date(),
        })
        .where(eq(voidRequests.id, requestId));

      // 5. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "void_request_rejected",
        targetEntity: "void_requests",
        targetId: requestId,
        newState: {
          paymentId: request.paymentId,
          reason: request.requestReason,
          rejectionRemarks: decisionRemarks,
        },
      }, { throwOnFail: true });
    });

    revalidatePath("/staff/void-requests");
    return { success: true, message: "Void request rejected." };
  } catch (error: unknown) {
    logger.error("[void-request] Failed to reject void request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}

// ─── Cancel Void Request Action ────────────────────────────────────────────────

/**
 * Cancels a pending void request.
 * Only the original requester can cancel their own request.
 */
export async function cancelVoidRequestAction(
  _prevState: CancelVoidRequestFormState,
  formData: FormData
): Promise<CancelVoidRequestFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "payments:void_request")) {
    return { message: "You do not have permission to cancel void requests." };
  }

  const parsed = CancelVoidRequestSchema.safeParse({
    requestId: formData.get("requestId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as CancelVoidRequestFormState["errors"] };
  }

  const { requestId } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Lock and fetch void request
      const request = await lockVoidRequest(tx, requestId);

      if (!request) {
        throw new Error("Void request not found.");
      }

      // 2. Validate request state
      if (request.status !== "pending") {
        throw new Error(`Cannot cancel a ${request.status} request. Only pending requests can be cancelled.`);
      }

      // 3. Only the original requester can cancel
      if (request.requestedBy !== session.userId) {
        throw new Error("You can only cancel your own void requests.");
      }

      // 4. Update void request to cancelled
      await tx
        .update(voidRequests)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(voidRequests.id, requestId));

      // 5. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "void_request_cancelled",
        targetEntity: "void_requests",
        targetId: requestId,
        newState: { paymentId: request.paymentId },
      }, { throwOnFail: true });
    });

    revalidatePath("/staff/void-requests");
    revalidatePath("/staff/assessments");
    return { success: true, message: "Void request cancelled." };
  } catch (error: unknown) {
    logger.error("[void-request] Failed to cancel void request", { error: String(error) });
    const msg = error instanceof Error ? error.message : String(error);
    return { message: msg || "An unexpected error occurred. Please try again." };
  }
}
