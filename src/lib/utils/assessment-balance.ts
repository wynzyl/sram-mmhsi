/**
 * Assessment balance operations - consistent balance updates across all payment/discount flows.
 *
 * Ensures:
 * - Consistent decimal rounding (.toFixed(2)) across all balance mutations
 * - Proper billingStatus derivation from the centralized utility
 * - Atomic balance + status + timestamp updates
 */

import { eq } from "drizzle-orm";
import { assessments } from "@/lib/db/schema";
import { assessmentBillingStatusFromState } from "./assessment-billing";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal executor interface - works with both transaction (`tx`) and direct `db`.
 */
type BalanceExecutor = {
  update: typeof import("@/lib/db").db.update;
  select: typeof import("@/lib/db").db.select;
};

export interface ApplyBalanceDeltaResult {
  newTotalPaid: number;
  newBalance: number;
  billingStatus: string;
}

export interface RecalculateFromItemsResult {
  totalAmount: number;
  totalDiscounts: number;
  newBalance: number;
  billingStatus: string;
}

// ─── Balance Delta Operations ─────────────────────────────────────────────────

/**
 * Apply a payment or reversal delta to an assessment's balance.
 *
 * Use cases:
 * - Payment posting: `delta = amount` (positive → totalPaid increases, balance decreases)
 * - Payment void/reversal: `delta = -amount` (negative → totalPaid decreases, balance increases)
 *
 * This function:
 * 1. Reads current totalPaid and balance
 * 2. Applies the delta with consistent .toFixed(2) rounding
 * 3. Derives billingStatus from the new balance
 * 4. Updates the assessment record atomically
 *
 * @param executor - Database executor (tx or db)
 * @param assessmentId - ID of the assessment to update
 * @param delta - Amount to add to totalPaid (positive for payment, negative for reversal)
 * @param cancelledAt - Assessment cancelled timestamp (for status derivation)
 * @param transferredAt - Assessment transferred timestamp (for status derivation)
 * @param userId - User performing the operation (for audit trail)
 *
 * @example
 * // Post a payment of 5000
 * await applyAssessmentBalanceDelta(tx, assessmentId, 5000, null, null, session.userId);
 *
 * // Reverse a payment of 5000 (void)
 * await applyAssessmentBalanceDelta(tx, assessmentId, -5000, assessment.cancelledAt, null, session.userId);
 */
export async function applyAssessmentBalanceDelta(
  executor: BalanceExecutor,
  assessmentId: string,
  delta: number,
  cancelledAt: Date | null | undefined,
  transferredAt: Date | null | undefined,
  userId: string
): Promise<ApplyBalanceDeltaResult> {
  // 1. Fetch current values
  const [current] = await executor
    .select({
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!current) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  // 2. Calculate new values with consistent rounding
  const currentTotalPaid = Number(current.totalPaid);
  const currentBalance = Number(current.balance);

  const newTotalPaid = currentTotalPaid + delta;
  const newBalance = currentBalance - delta;

  // 3. Derive billing status
  const billingStatus = assessmentBillingStatusFromState({
    balance: newBalance,
    cancelledAt,
    transferredAt,
  });

  // 4. Update atomically
  await executor
    .update(assessments)
    .set({
      totalPaid: newTotalPaid.toFixed(2),
      balance: newBalance.toFixed(2),
      billingStatus,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(assessments.id, assessmentId));

  return {
    newTotalPaid,
    newBalance,
    billingStatus,
  };
}

// ─── Discount Operations ──────────────────────────────────────────────────────

/**
 * Recalculate assessment totals after a discount is applied or reversed.
 *
 * In SRAMS, totalAmount is stored as the NET line sum (charges minus discounts).
 * When a discount is applied, totalAmount decreases by the discount amount.
 * When a discount is reversed, totalAmount increases by the discount amount.
 *
 * Balance is always: totalAmount - totalPaid
 *
 * @param executor - Database executor (tx or db)
 * @param assessmentId - ID of the assessment to update
 * @param discountAmount - The discount amount (always positive)
 * @param direction - "apply" to reduce totalAmount, "reverse" to increase it
 * @param userId - User performing the operation
 *
 * @example
 * // Apply a discount of 10000
 * await recalcAssessmentTotalsForDiscount(tx, assessmentId, 10000, "apply", session.userId);
 *
 * // Reverse a discount of 10000
 * await recalcAssessmentTotalsForDiscount(tx, assessmentId, 10000, "reverse", session.userId);
 */
export async function recalcAssessmentTotalsForDiscount(
  executor: BalanceExecutor,
  assessmentId: string,
  discountAmount: number,
  direction: "apply" | "reverse",
  userId: string
): Promise<RecalculateFromItemsResult> {
  // 1. Fetch current values
  const [current] = await executor
    .select({
      totalAmount: assessments.totalAmount,
      totalDiscounts: assessments.totalDiscounts,
      totalPaid: assessments.totalPaid,
      cancelledAt: assessments.cancelledAt,
      transferredAt: assessments.transferredAt,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!current) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  // 2. Calculate new values
  // Apply: totalAmount decreases, totalDiscounts increases (more discounts applied)
  // Reverse: totalAmount increases, totalDiscounts decreases (discount removed)
  const sign = direction === "apply" ? -1 : 1;
  const totalAmount = Number(current.totalAmount) + sign * discountAmount;
  const totalDiscounts = Number(current.totalDiscounts) - sign * discountAmount;
  const newBalance = totalAmount - Number(current.totalPaid);

  // 3. Derive billing status
  const billingStatus = assessmentBillingStatusFromState({
    balance: newBalance,
    cancelledAt: current.cancelledAt,
    transferredAt: current.transferredAt,
  });

  // 4. Update atomically
  await executor
    .update(assessments)
    .set({
      totalAmount: totalAmount.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      balance: newBalance.toFixed(2),
      billingStatus,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(assessments.id, assessmentId));

  return {
    totalAmount,
    totalDiscounts,
    newBalance,
    billingStatus,
  };
}

// ─── Cascade Adjustment Operations ─────────────────────────────────────────────

export interface CascadeAdjustmentResult {
  totalAmount: number;
  totalDiscounts: number;
  newBalance: number;
  billingStatus: string;
}

/**
 * Recalculate assessment totals after cascade adjustments are applied.
 *
 * Cascade adjustments occur when cash discount triggers recalculation of
 * existing tuition_only discounts. The adjustments ADD to the balance
 * (reduce effective discounts) because the original discounts were
 * calculated on a higher base amount.
 *
 * This function:
 * 1. INCREASES totalAmount by the cascade adjustment (reduces net discount)
 * 2. DECREASES totalDiscounts by the cascade adjustment (less effective discount)
 * 3. Recalculates balance = totalAmount - totalPaid
 *
 * @param executor - Database executor (tx or db)
 * @param assessmentId - ID of the assessment to update
 * @param cascadeAdjustment - Total cascade adjustment amount (positive = adds to balance)
 * @param userId - User performing the operation
 *
 * @example
 * // Original: Tuition 100k, ESC 20% = 20k discount
 * // Cash discount: 10k, so new tuition base = 90k
 * // ESC recalculated: 20% × 90k = 18k
 * // Cascade adjustment: 20k - 18k = 2k (adds to balance)
 * await recalcAssessmentTotalsForCascade(tx, assessmentId, 2000, session.userId);
 */
export async function recalcAssessmentTotalsForCascade(
  executor: BalanceExecutor,
  assessmentId: string,
  cascadeAdjustment: number,
  userId: string
): Promise<CascadeAdjustmentResult> {
  // 1. Fetch current values
  const [current] = await executor
    .select({
      totalAmount: assessments.totalAmount,
      totalDiscounts: assessments.totalDiscounts,
      totalPaid: assessments.totalPaid,
      cancelledAt: assessments.cancelledAt,
      transferredAt: assessments.transferredAt,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!current) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  // 2. Calculate new values
  // Cascade adjustment INCREASES totalAmount (reduces net discount effect)
  // Cascade adjustment DECREASES totalDiscounts (less effective discount)
  const totalAmount = Number(current.totalAmount) + cascadeAdjustment;
  const totalDiscounts = Number(current.totalDiscounts) - cascadeAdjustment;
  const newBalance = totalAmount - Number(current.totalPaid);

  // 3. Derive billing status
  const billingStatus = assessmentBillingStatusFromState({
    balance: newBalance,
    cancelledAt: current.cancelledAt,
    transferredAt: current.transferredAt,
  });

  // 4. Update atomically
  await executor
    .update(assessments)
    .set({
      totalAmount: totalAmount.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      balance: newBalance.toFixed(2),
      billingStatus,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(assessments.id, assessmentId));

  return {
    totalAmount,
    totalDiscounts,
    newBalance,
    billingStatus,
  };
}

/**
 * Reverse cascade adjustments when voiding a payment with cash discount.
 *
 * This reverses the cascade calculation by:
 * 1. DECREASING totalAmount by the cascade adjustment
 * 2. INCREASING totalDiscounts by the cascade adjustment
 * 3. Recalculating balance
 *
 * @param executor - Database executor (tx or db)
 * @param assessmentId - ID of the assessment to update
 * @param cascadeAdjustment - Total cascade adjustment to reverse (positive value)
 * @param userId - User performing the operation
 */
export async function reverseCascadeAdjustment(
  executor: BalanceExecutor,
  assessmentId: string,
  cascadeAdjustment: number,
  userId: string
): Promise<CascadeAdjustmentResult> {
  // Reversing cascade is the opposite of applying it
  // We DECREASE totalAmount and INCREASE totalDiscounts
  const [current] = await executor
    .select({
      totalAmount: assessments.totalAmount,
      totalDiscounts: assessments.totalDiscounts,
      totalPaid: assessments.totalPaid,
      cancelledAt: assessments.cancelledAt,
      transferredAt: assessments.transferredAt,
    })
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!current) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  // Reverse: DECREASE totalAmount, INCREASE totalDiscounts
  const totalAmount = Number(current.totalAmount) - cascadeAdjustment;
  const totalDiscounts = Number(current.totalDiscounts) + cascadeAdjustment;
  const newBalance = totalAmount - Number(current.totalPaid);

  const billingStatus = assessmentBillingStatusFromState({
    balance: newBalance,
    cancelledAt: current.cancelledAt,
    transferredAt: current.transferredAt,
  });

  await executor
    .update(assessments)
    .set({
      totalAmount: totalAmount.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      balance: newBalance.toFixed(2),
      billingStatus,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(assessments.id, assessmentId));

  return {
    totalAmount,
    totalDiscounts,
    newBalance,
    billingStatus,
  };
}
