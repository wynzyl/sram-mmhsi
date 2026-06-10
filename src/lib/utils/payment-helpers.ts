/**
 * Payment helper utilities for reusable payment operations.
 *
 * These utilities consolidate common payment patterns used across action files
 * to reduce duplication and ensure consistency.
 */

import { payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { LockedPayment, DbExecutor } from "./tx-helpers";

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * Transaction interface that supports Drizzle ORM operations.
 * Works with both `db.transaction(tx => ...)` and `db` itself.
 */
export type DrizzleTransaction = {
  insert: typeof import("@/lib/db").db.insert;
  update: typeof import("@/lib/db").db.update;
  execute: DbExecutor["execute"];
};

/**
 * Parameters for creating a reversal payment entry.
 */
export interface CreateReversalPaymentParams {
  /** The original payment being reversed */
  originalPayment: LockedPayment;
  /** Reason/context for the reversal (e.g., void request reason) */
  reversalRemarks: string;
  /** User ID of the person creating the reversal */
  createdBy: string;
  /** Optional: Void request ID that triggered this reversal */
  reversedByRequestId?: string;
}

/**
 * Result of creating a reversal payment entry.
 */
export interface ReversalPaymentResult {
  /** ID of the created reversal payment */
  id: string;
  /** Reference number generated for the reversal */
  referenceNumber: string;
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Generate a reference number for a reversal payment.
 *
 * Format: REV-{orNumber} or REV-{paymentIdPrefix}
 */
export function generateReversalReferenceNumber(
  orNumber: string | null,
  paymentId: string
): string {
  return orNumber ? `REV-${orNumber}` : `REV-${paymentId.substring(0, 8)}`;
}

/**
 * Create a reversal payment entry to offset an original payment.
 *
 * This function handles the common pattern of creating a negative payment entry
 * that offsets an original payment. Used during void approval workflow.
 *
 * Key behaviors:
 * - Creates a payment with negative amount (inverse of original)
 * - Sets kind='reversal' and status='reversal'
 * - Does NOT consume an OR number (bookletId and orNumber are null)
 * - Links back to the original payment via reversesPaymentId
 *
 * @param tx - Database transaction
 * @param params - Reversal parameters
 * @returns The created reversal payment ID and reference number
 *
 * @example
 * ```typescript
 * const { id: reversalId, referenceNumber } = await createReversalPaymentEntry(tx, {
 *   originalPayment,
 *   reversalRemarks: `Reversal of OR ${originalPayment.orNumber} - ${request.requestReason}`,
 *   createdBy: session.userId,
 *   reversedByRequestId: requestId,
 * });
 * ```
 */
export async function createReversalPaymentEntry(
  tx: DrizzleTransaction,
  params: CreateReversalPaymentParams
): Promise<ReversalPaymentResult> {
  const { originalPayment, reversalRemarks, createdBy } = params;

  const referenceNumber = generateReversalReferenceNumber(
    originalPayment.orNumber,
    originalPayment.id
  );

  const [reversalPayment] = await tx
    .insert(payments)
    .values({
      studentId: originalPayment.studentId,
      assessmentId: originalPayment.assessmentId,
      bookletId: null, // Reversals don't consume OR
      orNumber: null, // Reversals don't have OR number
      orStatus: "available", // N/A for reversals
      amount: `-${originalPayment.amount}`, // Negative amount
      paymentMethod: originalPayment.paymentMethod,
      referenceNumber,
      paymentDate: new Date(),
      status: "reversal",
      kind: "reversal",
      reversesPaymentId: originalPayment.id,
      remarks: reversalRemarks,
      createdBy,
      updatedBy: createdBy,
    })
    .returning({ id: payments.id });

  return {
    id: reversalPayment.id,
    referenceNumber,
  };
}

/**
 * Mark an original payment as reversed.
 *
 * Updates the original payment record to indicate it has been reversed.
 * Should be called before or after creating the reversal entry.
 *
 * @param tx - Database transaction
 * @param paymentId - ID of the payment to mark as reversed
 * @param reversedBy - User ID of the person approving the reversal
 * @param reversedByRequestId - Optional void request ID that triggered the reversal
 */
export async function markPaymentAsReversed(
  tx: DrizzleTransaction,
  paymentId: string,
  reversedBy: string,
  reversedByRequestId?: string
): Promise<void> {
  await tx
    .update(payments)
    .set({
      status: "reversed",
      reversedAt: new Date(),
      reversedBy,
      reversedByRequestId,
      updatedBy: reversedBy,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));
}
