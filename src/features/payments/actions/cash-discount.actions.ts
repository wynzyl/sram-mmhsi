"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  assessments,
  studentDiscounts,
  assessmentItems,
  discountRequests,
  discountTypes,
  schoolYears,
} from "@/lib/db/schema";
import { eq, and, isNull, ne } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import {
  recalcAssessmentTotalsForDiscount,
  reverseCascadeAdjustment,
  recalcAssessmentTotalsForCascade,
} from "@/lib/utils/assessment-balance";
import { checkCascadeFixNeeded } from "../payments.queries";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import type { CascadeFixFormState } from "../payments.types";

// ─────────────────────────────────────────────────────────────────
// Expired Cash Discount Reversal
// ─────────────────────────────────────────────────────────────────

/**
 * Reverse an expired cash discount and recalculate cascade adjustments.
 *
 * This action handles the case where:
 * 1. Cash discount was applied via approval workflow
 * 2. Student didn't pay by the cutoff date
 * 3. The discount expired and needs to be reversed
 *
 * The reversal:
 * 1. Marks the cash discount as reversed
 * 2. Reverses any cascade adjustment items created by the cash discount
 * 3. Clears cascade tracking on affected sibling/scholarship discounts
 * 4. Recalculates assessment totals to reflect the original balance
 */
export async function reverseExpiredCashDiscountAction(
  _prevState: CascadeFixFormState,
  formData: FormData
): Promise<CascadeFixFormState> {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "payments:post")) {
    return { message: PERMISSION_ERRORS.DISCOUNTS_REVERSE };
  }

  const assessmentId = formData.get("assessmentId") as string;
  const studentDiscountId = formData.get("studentDiscountId") as string;

  if (!assessmentId || !studentDiscountId) {
    return { message: "Assessment ID and discount ID are required." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock and fetch the cash discount
      const [cashDiscount] = await tx
        .select({
          id: studentDiscounts.id,
          assessmentId: studentDiscounts.assessmentId,
          discountTypeCode: studentDiscounts.discountTypeCode,
          discountAmount: studentDiscounts.discountAmount,
          baseAmount: studentDiscounts.baseAmount,
          assessmentItemId: studentDiscounts.assessmentItemId,
          reversedAt: studentDiscounts.reversedAt,
        })
        .from(studentDiscounts)
        .where(eq(studentDiscounts.id, studentDiscountId))
        .for("update")
        .limit(1);

      if (!cashDiscount) {
        return { message: "Cash discount not found." };
      }

      // 2. Verify it's a cash discount and not already reversed
      if (cashDiscount.discountTypeCode !== FULL_PAYMENT_DISCOUNT_CODE) {
        return { message: "This is not a cash discount." };
      }

      if (cashDiscount.reversedAt) {
        return { message: "This discount has already been reversed." };
      }

      if (cashDiscount.assessmentId !== assessmentId) {
        return { message: "Discount does not belong to this assessment." };
      }

      // 3. Verify the discount is expired (past cutoff date, no payment)
      const [assessmentInfo] = await tx
        .select({
          totalPaid: assessments.totalPaid,
          schoolYearId: assessments.schoolYearId,
        })
        .from(assessments)
        .where(eq(assessments.id, assessmentId))
        .limit(1);

      if (!assessmentInfo) {
        return { message: "Assessment not found." };
      }

      const [schoolYearInfo] = await tx
        .select({
          cashDiscountCutoffDate: schoolYears.cashDiscountCutoffDate,
        })
        .from(schoolYears)
        .where(eq(schoolYears.id, assessmentInfo.schoolYearId))
        .limit(1);

      const hasPaid = Number(assessmentInfo.totalPaid) > 0;
      const cutoffDate = schoolYearInfo?.cashDiscountCutoffDate;

      // Only allow reversal if expired: past cutoff AND no payment made
      if (hasPaid) {
        return {
          message: "Cannot reverse: payment has already been made on this assessment.",
        };
      }

      if (cutoffDate) {
        const now = new Date();
        const cutoffEndOfDay = new Date(cutoffDate);
        cutoffEndOfDay.setHours(23, 59, 59, 999);
        if (now <= cutoffEndOfDay) {
          return {
            message: "Cannot reverse: the cash discount has not yet expired. Wait until after the cutoff date.",
          };
        }
      }

      const cashDiscountAmount = Number(cashDiscount.discountAmount);
      const originalTuitionBase = Number(cashDiscount.baseAmount);
      const discountedTuitionBase = originalTuitionBase - cashDiscountAmount;
      let totalCascadeReversalAmount = 0;
      let totalDiscountIncrease = 0;

      // 4. Find ALL tuition_only discounts that were calculated on the DISCOUNTED tuition base
      const EPSILON = 0.01;
      const allTuitionDiscounts = await tx
        .select({
          id: studentDiscounts.id,
          discountTypeCode: studentDiscounts.discountTypeCode,
          discountTypeName: studentDiscounts.discountTypeName,
          discountValue: studentDiscounts.discountValue,
          calculationType: studentDiscounts.calculationType,
          baseType: studentDiscounts.baseType,
          baseAmount: studentDiscounts.baseAmount,
          discountAmount: studentDiscounts.discountAmount,
          cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
          assessmentItemId: studentDiscounts.assessmentItemId,
        })
        .from(studentDiscounts)
        .where(
          and(
            eq(studentDiscounts.assessmentId, assessmentId),
            eq(studentDiscounts.baseType, "tuition_only"),
            isNull(studentDiscounts.reversedAt),
            ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE)
          )
        );

      // Filter to only discounts that used the DISCOUNTED tuition base
      const discountsToRecalculate = allTuitionDiscounts.filter((d) => {
        const baseAmount = Number(d.baseAmount);
        return Math.abs(baseAmount - discountedTuitionBase) < EPSILON;
      });

      // 5. Find and delete cascade adjustment assessment items
      const cascadeAdjustmentItems = await tx
        .select({
          id: assessmentItems.id,
          amount: assessmentItems.amount,
        })
        .from(assessmentItems)
        .where(
          and(
            eq(assessmentItems.assessmentId, assessmentId),
            eq(assessmentItems.isCascadeAdjustment, true)
          )
        );

      for (const item of cascadeAdjustmentItems) {
        totalCascadeReversalAmount += Number(item.amount);
        await tx
          .delete(assessmentItems)
          .where(eq(assessmentItems.id, item.id));
      }

      // 6. Recalculate affected discounts on the ORIGINAL tuition base
      for (const discount of discountsToRecalculate) {
        const oldDiscountAmount = Number(discount.discountAmount);
        const discountValue = Number(discount.discountValue);

        let newDiscountAmount: number;
        if (discount.calculationType === "percentage") {
          newDiscountAmount = originalTuitionBase * (discountValue / 100);
        } else {
          newDiscountAmount = Math.min(discountValue, originalTuitionBase);
        }

        newDiscountAmount = Math.round(newDiscountAmount * 100) / 100;
        const discountIncrease = newDiscountAmount - oldDiscountAmount;
        totalDiscountIncrease += discountIncrease;

        await tx
          .update(studentDiscounts)
          .set({
            baseAmount: String(originalTuitionBase),
            discountAmount: String(newDiscountAmount),
            cascadeAdjustmentAmount: null,
            cascadeTriggeredByDiscountId: null,
          })
          .where(eq(studentDiscounts.id, discount.id));

        if (discount.assessmentItemId) {
          const baseLabel = discount.baseType === "tuition_only" ? "tuition" : "full assessment";
          const formattedBase = `₱${originalTuitionBase.toLocaleString("en-PH")}`.replace(/\.00$/, "");
          const newDescription = `${discount.discountTypeName} (on ${formattedBase} ${baseLabel})`;

          await tx
            .update(assessmentItems)
            .set({
              description: newDescription,
              amount: String(newDiscountAmount),
              updatedBy: session.userId,
              updatedAt: new Date(),
            })
            .where(eq(assessmentItems.id, discount.assessmentItemId));
        }

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "discount_recalculated_on_reversal",
          targetEntity: "student_discounts",
          targetId: discount.id,
          context: `Discount recalculated on original tuition after cash discount reversal`,
          previousState: {
            baseAmount: Number(discount.baseAmount),
            discountAmount: oldDiscountAmount,
            cascadeAdjustmentAmount: Number(discount.cascadeAdjustmentAmount ?? 0),
          },
          newState: {
            baseAmount: originalTuitionBase,
            discountAmount: newDiscountAmount,
            increase: discountIncrease,
          },
        });
      }

      // 7. Mark cash discount as reversed AND clear the assessmentItemId reference
      await tx
        .update(studentDiscounts)
        .set({
          reversedAt: new Date(),
          reversedBy: session.userId,
          reversalRemarks: "Expired - past cutoff date, no payment received",
          assessmentItemId: null,
        })
        .where(eq(studentDiscounts.id, studentDiscountId));

      // 8. Delete cash discount assessment item
      if (cashDiscount.assessmentItemId) {
        await tx
          .delete(assessmentItems)
          .where(eq(assessmentItems.id, cashDiscount.assessmentItemId));
      }

      // 9. Reverse the cash discount impact on assessment totals
      await recalcAssessmentTotalsForDiscount(
        tx,
        assessmentId,
        cashDiscountAmount,
        "reverse",
        session.userId
      );

      // 10. Reverse cascade adjustment impact on assessment totals
      if (totalCascadeReversalAmount > 0) {
        await reverseCascadeAdjustment(
          tx,
          assessmentId,
          totalCascadeReversalAmount,
          session.userId
        );
      }

      // 10b. Apply the increased discount amounts to assessment totals
      if (totalDiscountIncrease > 0) {
        await recalcAssessmentTotalsForDiscount(
          tx,
          assessmentId,
          totalDiscountIncrease,
          "apply",
          session.userId
        );
      }

      // 11. Also reverse the related discount request
      await tx
        .update(discountRequests)
        .set({
          status: "reversed",
          reversedAt: new Date(),
          reversedBy: session.userId,
        })
        .where(
          and(
            eq(discountRequests.assessmentId, assessmentId),
            eq(
              discountRequests.discountTypeId,
              (
                await tx
                  .select({ id: discountTypes.id })
                  .from(discountTypes)
                  .where(eq(discountTypes.code, FULL_PAYMENT_DISCOUNT_CODE))
                  .limit(1)
              )[0]?.id ?? ""
            ),
            eq(discountRequests.status, "approved")
          )
        );

      // 12. Audit log
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "expired_cash_discount_reversed",
        targetEntity: "student_discounts",
        targetId: studentDiscountId,
        context: `Expired cash discount reversed, affected discounts recalculated on original tuition`,
        previousState: {
          discountAmount: cashDiscountAmount,
          discountsRecalculated: discountsToRecalculate.length,
          totalCascadeReversal: totalCascadeReversalAmount,
          totalDiscountIncrease,
        },
      });

      // 13. Invalidate caches
      revalidatePath("/staff/payments");
      revalidatePath(`/staff/payments/process/${assessmentId}`);
      invalidateTag(CACHE_TAGS.DASHBOARD);

      return {
        success: true,
        message: `Expired discount reversed. Balance increased by ₱${cashDiscountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        totalAdjustment: cashDiscountAmount,
      };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("[payments] Expired cash discount reversal failed", {
      error: String(error),
      assessmentId,
      studentDiscountId,
    });
    return { message };
  }
}

// ─────────────────────────────────────────────────────────────────
// Cascade Fix
// ─────────────────────────────────────────────────────────────────

/**
 * Apply cascade fix for discounts that were applied out-of-order.
 *
 * This action corrects the case where:
 * 1. Cash discount was applied first (via approval workflow)
 * 2. Sibling/scholarship discounts were applied later
 * 3. Those later discounts used the ORIGINAL tuition base instead of
 *    the DISCOUNTED tuition base
 *
 * The fix creates positive adjustment items that reduce the effective
 * discount amount, bringing the balance back to the correct value.
 */
export async function applyCascadeFixAction(
  _prevState: CascadeFixFormState,
  formData: FormData
): Promise<CascadeFixFormState> {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "payments:post")) {
    return { message: PERMISSION_ERRORS.DISCOUNTS_CASCADE_FIX };
  }

  const assessmentId = formData.get("assessmentId") as string;
  if (!assessmentId) {
    return { message: "Assessment ID is required." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 1. Re-check cascade fix needed (inside transaction for consistency)
      const fixData = await checkCascadeFixNeeded(assessmentId);
      if (!fixData) {
        return { message: "No cascade fix needed for this assessment." };
      }

      let totalAdjustmentApplied = 0;

      // 2. For each misaligned discount, create cascade adjustment
      for (const adj of fixData.adjustments) {
        const adjustmentDescription =
          `Cascade Adjustment: ${adj.discountTypeName} ` +
          `(₱${adj.originalAmount.toFixed(2)} → ₱${adj.correctAmount.toFixed(2)})`;

        const [adjustmentItem] = await tx
          .insert(assessmentItems)
          .values({
            assessmentId,
            description: adjustmentDescription,
            amount: String(adj.adjustmentNeeded),
            isDiscount: false,
            isRefundable: false,
            isCascadeAdjustment: true,
            adjustsItemId: adj.assessmentItemId,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: assessmentItems.id });

        await tx
          .update(studentDiscounts)
          .set({
            cascadeAdjustmentAmount: String(adj.adjustmentNeeded),
            cascadeTriggeredByDiscountId: fixData.cashDiscountId,
          })
          .where(eq(studentDiscounts.id, adj.studentDiscountId));

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "cascade_discount_fix",
          targetEntity: "student_discounts",
          targetId: adj.studentDiscountId,
          context: assessmentId,
          newState: {
            adjustmentItemId: adjustmentItem.id,
            originalAmount: adj.originalAmount,
            correctAmount: adj.correctAmount,
            adjustmentApplied: adj.adjustmentNeeded,
            triggeredByCashDiscountId: fixData.cashDiscountId,
          },
        });

        totalAdjustmentApplied += adj.adjustmentNeeded;
      }

      // 3. Update assessment totals
      await recalcAssessmentTotalsForCascade(
        tx,
        assessmentId,
        totalAdjustmentApplied,
        session.userId
      );

      // 4. Invalidate caches (non-blocking)
      revalidatePath("/staff/payments");
      revalidatePath(`/staff/payments/process/${assessmentId}`);
      invalidateTag(CACHE_TAGS.DASHBOARD);

      return {
        success: true,
        message: `Cascade fix applied. Balance increased by ₱${totalAdjustmentApplied.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
        totalAdjustment: totalAdjustmentApplied,
      };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    logger.error("[payments] Cascade fix failed", { error: String(error), assessmentId });
    return { message };
  }
}
