import { db } from "@/lib/db";
import { payments } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * Live payment statuses - payments that are still consuming assessment balance.
 * Voided/reversed/reversal/balance_forward payments have already released their hold.
 */
export const LIVE_PAYMENT_STATUSES = ["pending_confirmation", "posted"] as const;

type DbExecutor = Pick<typeof db, "select">;

/**
 * Check if an assessment has any live (active) payments.
 * "Live" = pending_confirmation or posted status only.
 *
 * Use cases:
 * - Discount reversal: Must void payments before reversing discount
 * - Applying discount: Cannot apply discount if live payment exists
 * - Creating discount request: Blocked if live payment exists
 *
 * @param assessmentId - The assessment to check
 * @param executor - Optional database executor (db or tx for transactions)
 * @returns true if a live payment exists
 */
export async function hasLivePayment(
  assessmentId: string,
  executor: DbExecutor = db
): Promise<boolean> {
  const [row] = await executor
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.assessmentId, assessmentId),
        inArray(payments.status, [...LIVE_PAYMENT_STATUSES])
      )
    )
    .limit(1);

  return row !== undefined;
}

/**
 * Assert that an assessment has no live payments.
 * Throws an error if a live payment exists.
 *
 * Use cases:
 * - Discount reversal: Block operation if payment exists
 * - Applying discount: Block operation if payment exists
 *
 * @param assessmentId - The assessment to check
 * @param operation - Description of the blocked operation (for error message)
 * @param executor - Optional database executor (db or tx for transactions)
 * @throws Error if a live payment exists
 */
export async function assertNoLivePayments(
  assessmentId: string,
  operation: string,
  executor: DbExecutor = db
): Promise<void> {
  const hasPayment = await hasLivePayment(assessmentId, executor);

  if (hasPayment) {
    throw new Error(
      `Cannot ${operation}: a live payment exists on this assessment. Void the payment first.`
    );
  }
}

/**
 * Check if an assessment has any payments (regardless of status).
 * Used for business rules where any payment history locks certain operations.
 *
 * @param assessmentId - The assessment to check
 * @param executor - Optional database executor (db or tx for transactions)
 * @returns true if any payment exists (live, voided, reversed, etc.)
 */
export async function hasAnyPayment(
  assessmentId: string,
  executor: DbExecutor = db
): Promise<boolean> {
  const [row] = await executor
    .select({ id: payments.id })
    .from(payments)
    .where(eq(payments.assessmentId, assessmentId))
    .limit(1);

  return row !== undefined;
}
