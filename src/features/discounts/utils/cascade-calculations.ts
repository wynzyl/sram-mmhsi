/**
 * Cascading Discount Calculation Utilities
 *
 * When the cash payment discount is applied at payment time, existing scholarship
 * discounts (tuition_only base type) are recalculated based on the discounted
 * tuition amount, not the original tuition.
 *
 * Example:
 *   Original Tuition: ₱100,000
 *   ESC Scholarship: 20% (applied at enrollment)
 *
 *   WITHOUT CASCADING (additive - old behavior):
 *     - ESC: 20% × 100,000 = ₱20,000
 *     - Cash: 10% × 100,000 = ₱10,000
 *     - Total discount: ₱30,000
 *     - Payment: ₱70,000
 *
 *   WITH CASCADING (new behavior):
 *     - Cash: 10% × 100,000 = ₱10,000 (discounted tuition = ₱90,000)
 *     - ESC RECALCULATED: 20% × 90,000 = ₱18,000
 *     - Total discount: ₱28,000
 *     - Payment: ₱72,000
 *
 * The cascade adjustment creates a positive assessment item that "adds back"
 * the difference (₱2,000 in this example) to maintain correct accounting.
 */

import { formatCurrency } from "@/lib/utils/currency";
import {
  calculateDiscountAmount,
  calculateDiscountBase,
  type CalculationAssessmentItem,
} from "./discount-calculations";

// ─── Types ─────────────────────────────────────────────────────────────────────

/** Student discount with details needed for cascade calculation */
export interface StudentDiscountForCascade {
  id: string;
  studentId: string;
  assessmentId: string;
  discountTypeCode: string;
  discountTypeName: string;
  calculationType: "fixed_amount" | "percentage";
  baseType: "tuition_only" | "full_assessment";
  /** Original base amount used for calculation */
  baseAmount: string | number;
  /** Discount value (percentage or fixed amount) */
  discountValue: string | number;
  /** Original calculated discount amount */
  discountAmount: string | number;
  /** The assessment item created for this discount */
  assessmentItemId: string | null;
  /** Existing cascade adjustment (if any) */
  cascadeAdjustmentAmount?: string | number | null;
}

/** Individual cascade adjustment line for one discount */
export interface CascadeAdjustmentLine {
  /** The student discount being adjusted */
  studentDiscountId: string;
  /** Name of the discount type for display */
  discountTypeName: string;
  /** Discount type code for audit */
  discountTypeCode: string;
  /** Original discount amount before cascade */
  originalDiscountAmount: number;
  /** Recalculated discount amount after cascade */
  recalculatedDiscountAmount: number;
  /** The adjustment delta (original - recalculated), always positive */
  adjustmentAmount: number;
  /** The assessment item to create adjustment against */
  originalAssessmentItemId: string | null;
  /** New base amount used for recalculation */
  newBaseAmount: number;
}

/** Result of cascade calculation */
export interface CascadeResult {
  /** Individual adjustments for each affected discount */
  adjustments: CascadeAdjustmentLine[];
  /** Total adjustment amount (sum of all individual adjustments) */
  totalAdjustment: number;
  /** Original tuition base before cash discount */
  originalTuitionBase: number;
  /** New effective tuition base after cash discount */
  newTuitionBase: number;
  /** The cash discount amount that triggered cascading */
  cashDiscountAmount: number;
}

/** Cascade preview for UI display */
export interface CascadePreviewLine {
  discountTypeName: string;
  originalAmount: number;
  recalculatedAmount: number;
  adjustmentAmount: number;
}

export interface CascadePreview {
  /** Whether cascading will occur */
  hasCascadeAdjustments: boolean;
  /** Individual preview lines */
  lines: CascadePreviewLine[];
  /** Total cascade adjustment (reduces effective total discount) */
  totalAdjustment: number;
  /** Explanation text for UI */
  explanation: string;
}

// ─── Calculation Functions ─────────────────────────────────────────────────────

/**
 * Calculate cascade adjustments for existing tuition_only discounts.
 *
 * When cash discount is applied, other tuition_only discounts are recalculated
 * using the discounted tuition as the new base. This function computes the
 * adjustment amounts needed to correct the existing discount lines.
 *
 * @param existingDiscounts - Active tuition_only discounts on the assessment
 * @param cashDiscountAmount - The cash discount amount being applied
 * @param assessmentItems - Current assessment items for base calculation
 * @returns CascadeResult with adjustments and totals
 *
 * @example
 * const result = calculateCascadeAdjustments(
 *   [{ discountAmount: "20000", discountValue: "20", ... }],
 *   10000, // cash discount
 *   [{ amount: "100000", feeItemTypeCode: "TUITION", ... }]
 * );
 * // result.adjustments[0].adjustmentAmount = 2000 (20000 - 18000)
 */
export function calculateCascadeAdjustments(
  existingDiscounts: StudentDiscountForCascade[],
  cashDiscountAmount: number,
  assessmentItems: CalculationAssessmentItem[]
): CascadeResult {
  // 1. Calculate original tuition base (before any discounts)
  const originalTuitionBase = calculateDiscountBase(assessmentItems, "tuition_only");

  // 2. Calculate new effective tuition base (after cash discount)
  // Cash discount is applied first, reducing the base for other discounts
  const newTuitionBase = Math.max(0, originalTuitionBase - cashDiscountAmount);

  // 3. Filter to only tuition_only discounts that can cascade
  const cascadableDiscounts = existingDiscounts.filter(
    (d) => d.baseType === "tuition_only"
  );

  // 4. Calculate adjustment for each cascadable discount
  const adjustments: CascadeAdjustmentLine[] = [];

  for (const discount of cascadableDiscounts) {
    const originalAmount = Number(discount.discountAmount);
    const discountValue = Number(discount.discountValue);

    // Recalculate using the new (reduced) tuition base
    const recalculatedAmount = calculateDiscountAmount(
      newTuitionBase,
      discount.calculationType,
      discountValue
    );

    // The adjustment is the difference (original - recalculated)
    // This is always positive because new base is smaller
    const adjustmentAmount = originalAmount - recalculatedAmount;

    // Only create adjustment if meaningful (> 1 centavo)
    if (adjustmentAmount > 0.01) {
      adjustments.push({
        studentDiscountId: discount.id,
        discountTypeName: discount.discountTypeName,
        discountTypeCode: discount.discountTypeCode,
        originalDiscountAmount: originalAmount,
        recalculatedDiscountAmount: recalculatedAmount,
        adjustmentAmount,
        originalAssessmentItemId: discount.assessmentItemId,
        newBaseAmount: newTuitionBase,
      });
    }
  }

  // 5. Calculate total adjustment
  const totalAdjustment = adjustments.reduce(
    (sum, adj) => sum + adj.adjustmentAmount,
    0
  );

  return {
    adjustments,
    totalAdjustment,
    originalTuitionBase,
    newTuitionBase,
    cashDiscountAmount,
  };
}

/**
 * Generate a preview of cascade adjustments for UI display.
 *
 * Used in the payment form to show the impact of applying cash discount
 * before the user confirms the payment.
 *
 * @param existingDiscounts - Active tuition_only discounts on the assessment
 * @param cashDiscountAmount - The proposed cash discount amount
 * @param assessmentItems - Current assessment items for base calculation
 * @returns CascadePreview for UI rendering
 */
export function generateCascadePreview(
  existingDiscounts: StudentDiscountForCascade[],
  cashDiscountAmount: number,
  assessmentItems: CalculationAssessmentItem[]
): CascadePreview {
  const result = calculateCascadeAdjustments(
    existingDiscounts,
    cashDiscountAmount,
    assessmentItems
  );

  if (result.adjustments.length === 0) {
    return {
      hasCascadeAdjustments: false,
      lines: [],
      totalAdjustment: 0,
      explanation: "",
    };
  }

  const lines: CascadePreviewLine[] = result.adjustments.map((adj) => ({
    discountTypeName: adj.discountTypeName,
    originalAmount: adj.originalDiscountAmount,
    recalculatedAmount: adj.recalculatedDiscountAmount,
    adjustmentAmount: adj.adjustmentAmount,
  }));

  // Build explanation text
  const discountNames = lines.map((l) => l.discountTypeName).join(", ");
  const explanation =
    `Cash discount triggers recalculation of ${discountNames} ` +
    `(based on discounted tuition of ${formatCurrency(result.newTuitionBase)})`;

  return {
    hasCascadeAdjustments: true,
    lines,
    totalAdjustment: result.totalAdjustment,
    explanation,
  };
}

/**
 * Format cascade adjustment description for assessment item.
 *
 * @param adjustment - The cascade adjustment line
 * @param newBaseAmount - The new tuition base after cash discount
 * @returns Formatted description string
 *
 * @example
 * formatCascadeAdjustmentDescription({ discountTypeName: "ESC Scholarship", ... }, 90000)
 * // "Cascade Adjustment: ESC Scholarship recalculated (on ₱90,000 discounted tuition)"
 */
export function formatCascadeAdjustmentDescription(
  adjustment: CascadeAdjustmentLine,
  newBaseAmount: number
): string {
  const formattedBase = formatCurrency(newBaseAmount).replace(/\.00$/, "");
  return `Cascade Adjustment: ${adjustment.discountTypeName} recalculated (on ${formattedBase} discounted tuition)`;
}

/**
 * Calculate the final payment amount after cascading.
 *
 * @param currentBalance - Assessment balance before cash discount
 * @param cashDiscountAmount - Cash discount being applied
 * @param totalCascadeAdjustment - Total cascade adjustment from recalculations
 * @returns The amount the cashier should collect
 *
 * @example
 * calculateFinalPaymentWithCascade(100000, 10000, 2000)
 * // Balance: 100k - 10k (cash) + 2k (cascade) = 92k
 * // But actually: 100k - 10k = 90k, then cascade adds 2k back = 92k... wait
 * // Let me reconsider: cascade adjustments ADD to balance (reduce effective discounts)
 * // So: 100k - 10k (cash discount) = 90k, but existing discount was overcounted by 2k
 * // Final: 100k - 10k (cash) + 2k (cascade correction) = 92k? No...
 * // Actually: Original balance includes original ESC -20k
 * // After cash discount: balance -= 10k → 90k (was 100k - 20k ESC = 80k)
 * // Wait, let's trace through:
 * // Tuition 100k, ESC 20% = -20k → Balance = 80k
 * // Cash 10% = -10k → Balance should be 72k
 * // But without cascade, cash applies to 100k = -10k, so balance = 70k
 * // CASCADE fixes this: ESC should be 20% of 90k = 18k, not 20k
 * // So cascade adds back 2k (the "over-discount") → 70k + 2k = 72k
 */
export function calculateFinalPaymentWithCascade(
  currentBalance: number,
  cashDiscountAmount: number,
  totalCascadeAdjustment: number
): number {
  // Current balance already includes existing discounts
  // Cash discount reduces balance
  // Cascade adjustment adds back (reduces effective discount)
  return Math.max(
    0,
    currentBalance - cashDiscountAmount + totalCascadeAdjustment
  );
}

/**
 * Validate that cascade calculation is applicable.
 *
 * @param existingDiscounts - Discounts to check
 * @returns Validation result with any warnings
 */
export function validateCascadeEligibility(
  existingDiscounts: StudentDiscountForCascade[]
): { canCascade: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for discounts already affected by cascade
  const alreadyCascaded = existingDiscounts.filter(
    (d) =>
      d.cascadeAdjustmentAmount !== null &&
      d.cascadeAdjustmentAmount !== undefined &&
      Number(d.cascadeAdjustmentAmount) > 0
  );

  if (alreadyCascaded.length > 0) {
    warnings.push(
      `${alreadyCascaded.length} discount(s) already have cascade adjustments. ` +
        `Re-cascading is not supported.`
    );
    return { canCascade: false, warnings };
  }

  // Check for tuition_only discounts that can cascade
  const tuitionDiscounts = existingDiscounts.filter(
    (d) => d.baseType === "tuition_only"
  );

  if (tuitionDiscounts.length === 0) {
    // Not an error - just nothing to cascade
    return { canCascade: true, warnings: [] };
  }

  return { canCascade: true, warnings };
}
