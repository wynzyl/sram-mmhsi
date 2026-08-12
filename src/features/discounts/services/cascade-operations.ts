/**
 * Cascade Discount Operations Service
 *
 * Consolidates cascade adjustment logic for cash discounts. When a cash discount
 * is applied to an assessment, existing tuition-only scholarships must be
 * recalculated based on the discounted tuition amount (not the original).
 *
 * This service is used by both:
 * - `discounts.actions.ts` when applying approved discounts to existing assessments
 * - `payments.actions.ts` when applying cash discount at payment time
 */

import { db } from "@/lib/db";
import { studentDiscounts, assessmentItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/utils/audit-logger";
import { recalcAssessmentTotalsForCascade } from "@/lib/utils/assessment-balance";
import {
  calculateCascadeAdjustments,
  formatCascadeAdjustmentDescription,
} from "../utils/cascade-calculations";
import { type CalculationAssessmentItem } from "../utils/discount-calculations";
import {
  getTuitionOnlyDiscountsForCascade,
  getAssessmentItemsForDiscountCalc,
} from "../discounts.query-helpers";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Transaction executor type for cascade discount operations.
 * Requires select, insert, and update methods available in both db and tx.
 */
export type CascadeExecutor = {
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
};

/**
 * Result of applying cascade adjustments.
 */
export interface CascadeApplicationResult {
  /** Total amount of cascade adjustments applied */
  totalCascadeAdjustment: number;
  /** Number of discounts that received adjustments */
  adjustmentCount: number;
}

/**
 * Re-export CalculationAssessmentItem as CascadeAssessmentItem for backward compatibility.
 */
export type CascadeAssessmentItem = CalculationAssessmentItem;

// ─── Main Service Function ─────────────────────────────────────────────────────

/**
 * Apply cascade adjustments to existing tuition_only scholarships when a cash
 * discount is applied to an assessment.
 *
 * When cash discount is applied, existing tuition_only discounts are recalculated
 * based on the discounted tuition amount (not the original tuition). This creates
 * positive adjustment items that "add back" the over-discounted portion.
 *
 * @param tx - Database transaction executor
 * @param assessmentId - The assessment receiving the cash discount
 * @param cashDiscountStudentDiscountId - The studentDiscounts.id of the cash discount
 * @param cashDiscountAmount - The cash discount amount being applied
 * @param userId - User applying the discount
 * @param userRole - Role of the user (for audit)
 * @param items - Optional pre-fetched assessment items (will be fetched if not provided)
 * @returns Total cascade adjustment amount and count of adjustments
 */
export async function applyCascadeAdjustmentsForCashDiscount(
  tx: CascadeExecutor,
  assessmentId: string,
  cashDiscountStudentDiscountId: string,
  cashDiscountAmount: number,
  userId: string,
  userRole: string,
  items?: CascadeAssessmentItem[]
): Promise<CascadeApplicationResult> {
  // Fetch existing tuition_only discounts that may cascade
  const existingTuitionDiscounts = await getTuitionOnlyDiscountsForCascade(
    tx,
    assessmentId
  );

  if (existingTuitionDiscounts.length === 0) {
    return { totalCascadeAdjustment: 0, adjustmentCount: 0 };
  }

  // Fetch assessment items if not provided
  const assessmentItemsForCalc =
    items ?? (await getAssessmentItemsForDiscountCalc(tx, assessmentId));

  // Calculate cascade adjustments
  const cascadeResult = calculateCascadeAdjustments(
    existingTuitionDiscounts,
    cashDiscountAmount,
    assessmentItemsForCalc
  );

  if (cascadeResult.adjustments.length === 0) {
    return { totalCascadeAdjustment: 0, adjustmentCount: 0 };
  }

  // Create cascade adjustment items and update student discounts
  for (const adj of cascadeResult.adjustments) {
    // Create positive assessment item (adds to balance)
    const adjustmentDescription = formatCascadeAdjustmentDescription(
      adj,
      adj.newBaseAmount
    );

    const [adjustmentItem] = await tx
      .insert(assessmentItems)
      .values({
        assessmentId,
        description: adjustmentDescription,
        amount: String(adj.adjustmentAmount),
        isDiscount: false, // Positive = adds to balance
        isRefundable: false,
        isCascadeAdjustment: true,
        adjustsItemId: adj.originalAssessmentItemId,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: assessmentItems.id });

    // Update student discount with cascade tracking
    await tx
      .update(studentDiscounts)
      .set({
        cascadeAdjustmentAmount: String(adj.adjustmentAmount),
        cascadeTriggeredByDiscountId: cashDiscountStudentDiscountId,
      })
      .where(eq(studentDiscounts.id, adj.studentDiscountId));

    // Audit cascade adjustment
    await logAudit({
      actor: userId,
      actorRole: userRole,
      action: "cascade_discount_adjustment",
      targetEntity: "student_discounts",
      targetId: adj.studentDiscountId,
      context: `Cascade adjustment due to cash discount application`,
      newState: {
        originalDiscountAmount: adj.originalDiscountAmount,
        recalculatedAmount: adj.recalculatedDiscountAmount,
        adjustmentAmount: adj.adjustmentAmount,
        triggeredByDiscountId: cashDiscountStudentDiscountId,
        adjustmentItemId: adjustmentItem.id,
      },
    });
  }

  // Apply cascade adjustment to assessment balance
  if (cascadeResult.totalAdjustment > 0) {
    await recalcAssessmentTotalsForCascade(
      tx,
      assessmentId,
      cascadeResult.totalAdjustment,
      userId
    );
  }

  return {
    totalCascadeAdjustment: cascadeResult.totalAdjustment,
    adjustmentCount: cascadeResult.adjustments.length,
  };
}
