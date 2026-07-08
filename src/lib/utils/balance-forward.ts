/**
 * Balance Forward (BFX) Reversal Utility
 *
 * Extracts the common logic for reversing balance forward items.
 * Used by:
 * - cancelAssessmentAction (when cancelling an assessment with BF items)
 * - reverseBalanceTransferAction (manual transfer reversal)
 */

import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import { assessments, payments } from "@/lib/db/schema";
import { logAudit } from "@/lib/utils/audit-logger";
import { logger } from "@/lib/observability/logger";
import type { Role } from "@/lib/constants/roles";

type Transaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

interface BalanceForwardItem {
  sourceAssessmentId: string | null;
  amount: string;
  schoolYearLabel?: string;
}

interface ReverseBalanceForwardOptions {
  /** The transaction context */
  tx: Transaction;
  /** Balance forward items to reverse */
  balanceForwardItems: BalanceForwardItem[];
  /** The assessment being cancelled/reversed (for audit context) */
  targetAssessmentId: string;
  /** The user performing the action */
  userId: string;
  /** The user's role */
  userRole: Role;
  /** Reason for the reversal (used in audit log) */
  reason: "balance_transfer_reversed" | "assessment_cancellation";
}

interface ReverseBalanceForwardResult {
  /** Number of BFX receipts deleted */
  bfxReceiptsDeleted: number;
  /** IDs of source assessments that were restored */
  restoredAssessmentIds: string[];
  /** Total amount restored across all source assessments */
  totalAmountRestored: number;
}

/**
 * Reverses balance forward items by:
 * 1. Finding and deleting BFX receipts from source assessments
 * 2. Restoring source assessment balance and billing status
 * 3. Creating audit log entries for each operation
 *
 * This is a shared utility used by both:
 * - cancelAssessmentAction
 * - reverseBalanceTransferAction
 *
 * @param options - Configuration for the reversal
 * @returns Summary of what was reversed
 */
export async function reverseBalanceForwardItems(
  options: ReverseBalanceForwardOptions
): Promise<ReverseBalanceForwardResult> {
  const {
    tx,
    balanceForwardItems,
    targetAssessmentId,
    userId,
    userRole,
    reason,
  } = options;

  let bfxReceiptsDeleted = 0;
  const restoredAssessmentIds: string[] = [];
  let totalAmountRestored = 0;

  for (const bfItem of balanceForwardItems) {
    if (!bfItem.sourceAssessmentId) continue;

    // Verify source assessment exists
    const sourceAssessment = await tx.query.assessments.findFirst({
      where: eq(assessments.id, bfItem.sourceAssessmentId),
      columns: { id: true },
    });

    if (!sourceAssessment) {
      logger.warn(
        `[reverseBalanceForwardItems] Source assessment ${bfItem.sourceAssessmentId} not found, skipping`
      );
      continue;
    }

    // Find and delete BFX receipt(s) from source assessment
    const bfxReceipts = await tx.query.payments.findMany({
      where: and(
        eq(payments.assessmentId, bfItem.sourceAssessmentId),
        eq(payments.kind, "balance_forward"),
        eq(payments.status, "balance_forward")
      ),
      columns: { id: true, referenceNumber: true },
    });

    for (const bfxReceipt of bfxReceipts) {
      await tx.delete(payments).where(eq(payments.id, bfxReceipt.id));
      bfxReceiptsDeleted++;

      // Audit log BFX deletion
      await logAudit(
        {
          actor: userId,
          actorRole: userRole,
          action: "bfx_receipt_deleted",
          targetEntity: "payments",
          targetId: bfxReceipt.id,
          context: bfItem.sourceAssessmentId,
          newState: {
            bfxNumber: bfxReceipt.referenceNumber,
            reason,
            sourceAssessmentId: bfItem.sourceAssessmentId,
            targetAssessmentId,
          },
        },
        { throwOnFail: true }
      );
    }

    // Restore source assessment balance and billing status
    await tx
      .update(assessments)
      .set({
        balance: bfItem.amount, // Restore the transferred amount
        billingStatus: "outstanding", // Restore to outstanding
        transferredAt: null,
        transferredBy: null,
        transferredToAssessmentId: null,
        transferRemarks: null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, bfItem.sourceAssessmentId));

    // Audit log restoration
    await logAudit(
      {
        actor: userId,
        actorRole: userRole,
        action: "assessment_transfer_reversed",
        targetEntity: "assessments",
        targetId: bfItem.sourceAssessmentId,
        context: targetAssessmentId,
        newState: {
          restoredBalance: bfItem.amount,
          restoredBillingStatus: "outstanding",
          reason,
        },
      },
      { throwOnFail: true }
    );

    restoredAssessmentIds.push(bfItem.sourceAssessmentId);
    totalAmountRestored += Number(bfItem.amount);
  }

  return {
    bfxReceiptsDeleted,
    restoredAssessmentIds,
    totalAmountRestored,
  };
}
