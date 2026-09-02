"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  payments,
  assessments,
  studentDiscounts,
  assessmentItems,
  discountRequests,
  discountTypes,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { VoidPaymentSchema, type VoidPaymentFormState } from "../payments.schema";
import { parseFormData } from "@/lib/utils/form-validation";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { ASSESSMENT_BALANCE_FULLY_PAID_EPSILON } from "@/lib/utils/assessment-billing";
import {
  lockPayment,
  lockAssessment,
  assertAssessmentNotTransferred,
} from "@/lib/utils/tx-helpers";
import { revertToAssessedOnVoid } from "@/lib/utils/enrollment-status";
import {
  applyAssessmentBalanceDelta,
  recalcAssessmentTotalsForDiscount,
  reverseCascadeAdjustment,
} from "@/lib/utils/assessment-balance";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import {
  assertStudentMutable,
  StudentArchivedException,
  formatArchiveError,
} from "@/features/archive/archive.guards";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

// ─────────────────────────────────────────────────────────────────
// Void Payment
// ─────────────────────────────────────────────────────────────────

/**
 * Void a posted payment.
 *
 * Validates:
 * - User has payments:void permission
 * - Payment exists and is not already voided
 * - Student is not archived
 * - No pending enrollment cancellation request
 * - Assessment is not transferred
 *
 * Side effects:
 * - Marks payment as voided
 * - Reverts assessment balance
 * - If payment had cash discount: reverses discount and cascade adjustments
 * - Reverts enrollment status to "assessed" if total paid becomes zero
 * - Writes audit log entries
 */
export async function voidPaymentAction(
  _prevState: VoidPaymentFormState,
  formData: FormData
): Promise<VoidPaymentFormState> {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "payments:void")) {
    return { message: PERMISSION_ERRORS.PAYMENTS_VOID };
  }

  const result = parseFormData(VoidPaymentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { paymentId, voidReason } = result.data;

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch Payment (FOR UPDATE to prevent concurrent voiding)
      const payment = await lockPayment(tx, paymentId);

      if (!payment) {
        throw new Error("Payment not found.");
      }

      if (payment.status === "voided") {
        throw new Error("Payment is already voided.");
      }

      // Check if student is archived (blocked action - cannot void payments for archived students)
      await assertStudentMutable(payment.studentId, "void_or", tx);

      // Check for pending cancellation request (blocks voids too)
      if (payment.assessmentId) {
        const assessmentForCancel = await tx.query.assessments.findFirst({
          where: eq(assessments.id, payment.assessmentId),
          columns: { enrollmentId: true },
        });
        await assertNoPendingCancellation(assessmentForCancel?.enrollmentId, "void payment");
      }

      // 2. Mark Payment as Voided
      await tx
        .update(payments)
        .set({
          status: "voided",
          orStatus: "voided",
          voidedAt: new Date(),
          voidedBy: session.userId,
          voidReason,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      // 3. Revert Assessment Balance
      if (payment.assessmentId) {
        const assessment = await lockAssessment(tx, payment.assessmentId);
        if (assessment) {
          // Block voiding payments on transferred assessments
          assertAssessmentNotTransferred(assessment.transferredAt, "void payment");

          const pAmount = Number(payment.amount);

          // 3a. Check for cash discount associated with this payment
          // If this payment was posted with a cash discount, we need to:
          // 1. Reverse the cash discount itself
          // 2. Reverse any cascade adjustments that were created
          const cashDiscountOnPayment = await tx
            .select({
              id: studentDiscounts.id,
              discountAmount: studentDiscounts.discountAmount,
              assessmentItemId: studentDiscounts.assessmentItemId,
            })
            .from(studentDiscounts)
            .where(
              and(
                eq(studentDiscounts.assessmentId, payment.assessmentId),
                eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
                isNull(studentDiscounts.reversedAt)
              )
            )
            .limit(1);

          let totalCascadeReversalAmount = 0;

          if (cashDiscountOnPayment.length > 0) {
            const cashDiscount = cashDiscountOnPayment[0];

            // Find cascade adjustments triggered by this cash discount
            const cascadeAdjustments = await tx
              .select({
                studentDiscountId: studentDiscounts.id,
                cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
                assessmentItemId: studentDiscounts.assessmentItemId,
              })
              .from(studentDiscounts)
              .where(
                and(
                  eq(studentDiscounts.assessmentId, payment.assessmentId),
                  eq(studentDiscounts.cascadeTriggeredByDiscountId, cashDiscount.id)
                )
              );

            // Reverse cascade adjustments
            for (const adj of cascadeAdjustments) {
              const adjAmount = Number(adj.cascadeAdjustmentAmount ?? 0);
              totalCascadeReversalAmount += adjAmount;

              // Find and delete cascade adjustment assessment items
              // Only search if we have an assessmentItemId to look for
              const cascadeItems = adj.assessmentItemId
                ? await tx
                    .select({ id: assessmentItems.id })
                    .from(assessmentItems)
                    .where(
                      and(
                        eq(assessmentItems.assessmentId, payment.assessmentId),
                        eq(assessmentItems.isCascadeAdjustment, true),
                        eq(assessmentItems.adjustsItemId, adj.assessmentItemId)
                      )
                    )
                : [];

              // Delete cascade adjustment items (soft delete not applicable - these are system items)
              for (const item of cascadeItems) {
                await tx
                  .delete(assessmentItems)
                  .where(eq(assessmentItems.id, item.id));
              }

              // Clear cascade tracking on the affected discount
              await tx
                .update(studentDiscounts)
                .set({
                  cascadeAdjustmentAmount: null,
                  cascadeTriggeredByDiscountId: null,
                })
                .where(eq(studentDiscounts.id, adj.studentDiscountId));

              // Audit cascade reversal
              await logAudit({
                actor: session.userId,
                actorRole: session.role,
                action: "cascade_discount_reversal",
                targetEntity: "student_discounts",
                targetId: adj.studentDiscountId,
                context: `Cascade adjustment reversed due to payment void`,
                previousState: {
                  cascadeAdjustmentAmount: adjAmount,
                  cascadeTriggeredByDiscountId: cashDiscount.id,
                },
              });
            }

            // Reverse cascade adjustment impact on assessment balance
            if (totalCascadeReversalAmount > 0) {
              await reverseCascadeAdjustment(
                tx,
                payment.assessmentId,
                totalCascadeReversalAmount,
                session.userId
              );
            }

            // Reverse the cash discount itself
            await tx
              .update(studentDiscounts)
              .set({
                reversedAt: new Date(),
                reversedBy: session.userId,
                reversalRemarks: `Reversed due to payment void: ${voidReason}`,
              })
              .where(eq(studentDiscounts.id, cashDiscount.id));

            // Delete cash discount assessment item
            if (cashDiscount.assessmentItemId) {
              await tx
                .delete(assessmentItems)
                .where(eq(assessmentItems.id, cashDiscount.assessmentItemId));
            }

            // Reverse cash discount impact on assessment
            await recalcAssessmentTotalsForDiscount(
              tx,
              payment.assessmentId,
              Number(cashDiscount.discountAmount),
              "reverse",
              session.userId
            );

            // Also reverse the related discount request
            await tx
              .update(discountRequests)
              .set({
                status: "reversed",
                reversedAt: new Date(),
                reversedBy: session.userId,
              })
              .where(
                and(
                  eq(discountRequests.assessmentId, payment.assessmentId),
                  eq(discountRequests.discountTypeId, (
                    await tx
                      .select({ id: discountTypes.id })
                      .from(discountTypes)
                      .where(eq(discountTypes.code, FULL_PAYMENT_DISCOUNT_CODE))
                      .limit(1)
                  )[0]?.id ?? ""),
                  eq(discountRequests.status, "approved")
                )
              );

            // Audit cash discount reversal
            await logAudit({
              actor: session.userId,
              actorRole: session.role,
              action: "cash_discount_reversed",
              targetEntity: "student_discounts",
              targetId: cashDiscount.id,
              context: `Cash discount reversed due to payment void`,
              previousState: {
                discountAmount: Number(cashDiscount.discountAmount),
                cascadeAdjustmentsReversed: cascadeAdjustments.length,
                totalCascadeReversal: totalCascadeReversalAmount,
              },
            });
          }

          // Apply negative delta (reversal) for the payment amount
          const { newTotalPaid } = await applyAssessmentBalanceDelta(
            tx,
            payment.assessmentId,
            -pAmount, // negative = reversal
            assessment.cancelledAt,
            assessment.transferredAt,
            session.userId
          );

          // 3b. Revert enrollment status to "assessed" if total paid becomes zero
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
              `Total paid reverted to zero after voiding payment`
            );
          }
        }
      }

      // 4. Audit Log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "payment_voided",
        targetEntity: "payments",
        targetId: paymentId,
        context: `Reason: ${voidReason}`,
      }, { throwOnFail: true });
    });

    const link = await db.query.payments.findFirst({
      where: eq(payments.id, paymentId),
      columns: { assessmentId: true },
    });
    if (link?.assessmentId) {
      revalidatePath(`/staff/assessments/${link.assessmentId}`);
    }
    revalidatePath("/staff/assessments");
    // Dashboard KPIs reflect voided collection totals.
    invalidateTag(CACHE_TAGS.DASHBOARD);
    // Enrollment status may have reverted to "assessed" if all payments were
    // voided — SWR is enough; the actor stays on the payments/assessment views,
    // not the enrollment queue, so don't block the response on a re-query.
    invalidateTag(CACHE_TAGS.ENROLLMENTS);

    return { success: true, message: "Payment voided successfully." };
  } catch (error: unknown) {
    // Handle archived student error
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    logger.error("[cashier] Failed to void payment", { error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    return { message: message || "An unexpected error occurred. Please try again." };
  }
}
