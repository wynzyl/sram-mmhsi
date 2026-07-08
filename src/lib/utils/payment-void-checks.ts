/**
 * Payment void ordering utilities.
 *
 * Enforces the accounting rule that payments must be voided in reverse
 * chronological order. Only the most recent posted payment for an assessment
 * can be voided at any given time.
 */

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DbExecutor } from "./tx-helpers";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Result of querying the most recent voidable payment.
 */
interface MostRecentVoidableRow {
  id: string;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Get the most recent voidable payment ID for an assessment.
 *
 * A "voidable" payment is one with:
 * - kind = 'payment' (not a reversal or balance_forward)
 * - status = 'posted'
 *
 * Payments are ordered by createdAt DESC, so the first result is the most recent.
 *
 * @param assessmentId - Assessment to check
 * @param executor - Database executor (transaction or db)
 * @returns Payment ID of the most recent voidable payment, or null if none
 */
export async function getMostRecentVoidablePaymentId(
  assessmentId: string,
  executor: DbExecutor = db
): Promise<string | null> {
  const result = await executor.execute(sql`
    SELECT id
    FROM payments
    WHERE assessment_id = ${assessmentId}
      AND kind = 'payment'
      AND status = 'posted'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const rows = result as MostRecentVoidableRow[];
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Check if a specific payment is the most recent voidable payment.
 *
 * Used for server-side validation before creating void requests.
 * Ensures payments are voided in reverse chronological order.
 *
 * @param paymentId - Payment to check
 * @param assessmentId - Assessment the payment belongs to
 * @param executor - Database executor (transaction or db)
 * @returns true if the payment is the most recent voidable, false otherwise
 */
export async function isPaymentMostRecentVoidable(
  paymentId: string,
  assessmentId: string,
  executor: DbExecutor = db
): Promise<boolean> {
  const mostRecentId = await getMostRecentVoidablePaymentId(assessmentId, executor);
  return mostRecentId === paymentId;
}
