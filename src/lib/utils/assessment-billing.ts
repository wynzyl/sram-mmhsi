/** Treat tiny residuals as zero for currency comparisons (PHP, 2 decimals). */
export const ASSESSMENT_BALANCE_FULLY_PAID_EPSILON = 0.005;

export type AssessmentBillingStatus = "outstanding" | "fully_paid" | "cancelled" | "balance_forwarded";

export function billingStatusFromBalance(balance: number): Exclude<AssessmentBillingStatus, "cancelled" | "balance_forwarded"> {
  return balance <= ASSESSMENT_BALANCE_FULLY_PAID_EPSILON ? "fully_paid" : "outstanding";
}

/**
 * Ledger row: cancelled enrollment wins over balance-derived status.
 * Balance forwarded (transferred to new school year) takes precedence over balance-based status.
 */
export function assessmentBillingStatusFromState(input: {
  balance: number;
  cancelledAt: Date | string | null | undefined;
  transferredAt?: Date | string | null | undefined;
}): AssessmentBillingStatus {
  if (input.cancelledAt != null) return "cancelled";
  if (input.transferredAt != null) return "balance_forwarded";
  return billingStatusFromBalance(input.balance);
}
