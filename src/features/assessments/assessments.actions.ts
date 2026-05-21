"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  enrollments,
  assessments,
  assessmentItems,
  gradeLevels,
  schoolYears,
  feeItemTypes,
  payments,
} from "@/lib/db/schema";
import { eq, and, ne, isNotNull, isNull, desc, asc } from "drizzle-orm";
import { resolveFeeScheduleForAssessment } from "./assessments.queries";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateAssessmentFromEnrollmentSchema,
  computeAssessmentTotals,
} from "./assessments.schema";
import type { AssessmentFormState } from "./assessments.schema";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { generateNextBfxNumber } from "@/lib/utils/reference";
import {
  hasPendingDiscountRequests,
  applyApprovedDiscountsToAssessment,
} from "@/features/discounts";

export async function createAssessmentFromEnrollmentAction(
  _prevState: AssessmentFormState,
  formData: FormData
): Promise<AssessmentFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "assessments:create")) {
    return { message: "You do not have permission to create assessments." };
  }

  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(String(formData.get("items") ?? "null"));
  } catch {
    return { message: "Invalid line items payload." };
  }

  const parsed = CreateAssessmentFromEnrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    remarks: formData.get("remarks") || undefined,
    items: itemsRaw,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      errors: flat.fieldErrors as AssessmentFormState["errors"],
      message: flat.formErrors[0],
    };
  }

  const { enrollmentId, remarks, items } = parsed.data;

  // Fetch enrollment with school year label for readable remarks
  const enrollmentResult = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      gradeLevelId: enrollments.gradeLevelId,
      studentType: enrollments.studentType,
      status: enrollments.status,
      schoolYearLabel: schoolYears.label,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  const enrollmentRow = enrollmentResult[0];

  if (!enrollmentRow) {
    return { message: "Enrollment not found." };
  }

  const gradeRow = await db.query.gradeLevels.findFirst({
    where: eq(gradeLevels.id, enrollmentRow.gradeLevelId),
    columns: { assessmentBand: true },
  });
  if (!gradeRow) {
    return { message: "Grade level not found for this enrollment." };
  }

  if (enrollmentRow.status !== "pending") {
    return {
      message: `Assessment can only be created when enrollment is Pending (current: ${enrollmentRow.status}).`,
    };
  }

  // ─── Check for Pending Discount Requests ──────────────────────────────────
  const hasPendingDiscounts = await hasPendingDiscountRequests(enrollmentId);
  if (hasPendingDiscounts) {
    return {
      message:
        "This enrollment has pending discount requests. All discount requests must be approved or rejected before creating an assessment.",
    };
  }

  // ─── Check for Balance Forward (Old Students - Multi-Year Support) ─────────
  let balanceForwardItems: Array<{
    description: string;
    amount: string;
    sourceAssessmentId: string;
    schoolYearLabel: string;
  }> = [];

  if (enrollmentRow.studentType === "old_student") {
    // Find ALL prior enrollments with outstanding balances (not just most recent)
    const priorEnrollments = await db
      .select({
        assessmentId: assessments.id,
        balance: assessments.balance,
        schoolYearLabel: schoolYears.label,
        startDate: schoolYears.startDate,
        transferredAt: assessments.transferredAt, // Check if already transferred
      })
      .from(enrollments)
      .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
      .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.studentId, enrollmentRow.studentId),
          ne(enrollments.schoolYearId, enrollmentRow.schoolYearId), // Different year
          eq(enrollments.status, "enrolled"), // Only fully enrolled
          isNotNull(assessments.id), // Has assessment
          isNull(assessments.transferredAt) // Not yet transferred
        )
      )
      .orderBy(asc(schoolYears.startDate)); // Oldest first (chronological order)

    // Create balance forward item for EACH prior year with outstanding balance
    for (const prior of priorEnrollments) {
      const balanceAmount = Number(prior.balance);
      if (balanceAmount > 0.01) { // Skip zero and negative (credits)
        balanceForwardItems.push({
          description: `Balance Forward from ${prior.schoolYearLabel}`,
          amount: prior.balance,
          sourceAssessmentId: prior.assessmentId,
          schoolYearLabel: prior.schoolYearLabel,
        });
      }
    }
  }

  const existing = await db.query.assessments.findFirst({
    where: eq(assessments.enrollmentId, enrollmentId),
    columns: { id: true },
  });
  if (existing) {
    return { message: "An assessment already exists for this enrollment." };
  }

  const scheduleResolution = await resolveFeeScheduleForAssessment(db, {
    schoolYearId: enrollmentRow.schoolYearId,
    assessmentBand: gradeRow.assessmentBand,
  });

  if (!scheduleResolution) {
    return {
      message:
        "No fee schedule exists for this school year and grade band. Configure Finance → Fee Templates first.",
    };
  }

  if (scheduleResolution.items.length === 0) {
    return {
      message:
        "The fee template has no line items yet. Add fee types to the template under Finance → Fee Templates.",
    };
  }

  // Validate submitted items against resolved template items
  const submittedById = new Map(items.map((row) => [row.feeTemplateItemId, row.amount]));
  if (submittedById.size !== items.length) {
    return { message: "Each catalog fee may only appear once." };
  }

  const submittedIds = [...submittedById.keys()];
  const templateItemIds = new Set(scheduleResolution.items.map(i => i.feeTemplateItemId));

  // Check if all submitted items exist in the resolved template
  const invalidIds = submittedIds.filter(id => !templateItemIds.has(id));
  if (invalidIds.length > 0) {
    return {
      message:
        "One or more selected fees are not in the current fee template. Refresh the page and try again.",
    };
  }

  // Build resolved lines using template data + submitted amounts
  const templateMap = new Map(scheduleResolution.items.map((item) => [item.feeTemplateItemId, item]));
  const resolvedLines: {
    description: string;
    amount: number;
    isDiscount: boolean;
    feeTemplateItemId: string | null; // Allow null for balance forward items
    feeItemTypeId: string;
    feeItemTypeCode: string | null; // For discount base calculation
    sourceAssessmentId?: string; // For balance forward items only
  }[] = [];
  for (const line of items) {
    const template = templateMap.get(line.feeTemplateItemId)!;
    resolvedLines.push({
      feeTemplateItemId: template.feeTemplateItemId,
      feeItemTypeId: template.feeItemTypeId,
      feeItemTypeCode: template.feeItemTypeCode, // For discount base calculation
      description: template.description,
      amount: line.amount,
      isDiscount: template.isDiscount,
    });
  }

  // ─── Add Balance Forward Items (if applicable - Multi-Year Support) ───────
  if (balanceForwardItems.length > 0) {
    // Get BALANCE_FORWARD fee item type (must exist in seed data)
    const balanceForwardType = await db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, "BALANCE_FORWARD"),
      columns: { id: true },
    });

    if (!balanceForwardType) {
      return {
        message:
          "Balance Forward fee type not found in system. Run: npx tsx scripts/seed-fee-item-types.ts",
      };
    }

    // Prepend ALL balance forward items to beginning (chronological order - oldest first)
    for (const bfItem of balanceForwardItems) {
      resolvedLines.unshift({
        feeTemplateItemId: null, // Not from template
        feeItemTypeId: balanceForwardType.id,
        feeItemTypeCode: "BALANCE_FORWARD", // Balance forward type code
        description: bfItem.description,
        amount: Number(bfItem.amount),
        isDiscount: false,
        sourceAssessmentId: bfItem.sourceAssessmentId, // Link to source assessment
      });
    }
  }

  const assessmentTotalAmount = computeAssessmentTotals(resolvedLines);

  if (assessmentTotalAmount <= 0) {
    return { message: "Total assessed amount must be greater than zero." };
  }

  let newAssessmentId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      const scheduleCheck = await resolveFeeScheduleForAssessment(tx, {
        schoolYearId: enrollmentRow.schoolYearId,
        assessmentBand: gradeRow.assessmentBand,
      });
      if (!scheduleCheck || scheduleCheck.scheduleId !== scheduleResolution.scheduleId) {
        throw new Error("FEE_SCHEDULE_CHANGED");
      }

      // Verify template items haven't changed
      const currentTemplateItemIds = new Set(scheduleCheck.items.map(i => i.feeTemplateItemId));
      const originalTemplateItemIds = new Set(submittedIds);

      if (currentTemplateItemIds.size !== originalTemplateItemIds.size ||
          ![...originalTemplateItemIds].every(id => currentTemplateItemIds.has(id))) {
        throw new Error("FEE_SCHEDULE_CHANGED");
      }

      const [newAssessment] = await tx
        .insert(assessments)
        .values({
          enrollmentId,
          studentId: enrollmentRow.studentId,
          schoolYearId: enrollmentRow.schoolYearId,
          totalAmount: String(assessmentTotalAmount.toFixed(2)),
          totalPaid: "0.00",
          balance: String(assessmentTotalAmount.toFixed(2)),
          remarks: remarks ?? null,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessments.id });

      newAssessmentId = newAssessment.id;

      await tx.insert(assessmentItems).values(
        resolvedLines.map((item) => ({
          assessmentId: newAssessment.id,
          feeTemplateItemId: item.feeTemplateItemId ?? null, // Allow null for balance forward
          feeItemTypeId: item.feeItemTypeId,          // ← New: For reporting
          description: item.description,               // ← Snapshot from fee_item_types.name
          amount: String(Number(item.amount).toFixed(2)),
          isDiscount: item.isDiscount,                 // ← Snapshot from fee_item_types.isDiscount
          sourceAssessmentId: item.sourceAssessmentId ?? null, // ← Link to source assessment for balance forward
          createdBy: session.userId,
          updatedBy: session.userId,
        }))
      );

      // ─── Mark Source Assessments as Transferred & Create BFX Receipts ─────────────
      for (const bfItem of balanceForwardItems) {
        // 1. Atomically claim the source assessment. Conditional UPDATE with
        //    transferredAt IS NULL prevents two concurrent transfers from both
        //    reading null and producing duplicate BFX receipts. If no row is
        //    returned, another transaction beat us to it.
        const claimed = await tx
          .update(assessments)
          .set({
            balance: "0.00",
            billingStatus: "balance_forwarded",
            transferredAt: new Date(),
            transferredBy: session.userId,
            transferredToAssessmentId: newAssessment.id,
            transferRemarks: `Balance of ${bfItem.amount} transferred to ${enrollmentRow.schoolYearLabel}`,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(assessments.id, bfItem.sourceAssessmentId),
              isNull(assessments.transferredAt)
            )
          )
          .returning({ id: assessments.id });

        if (claimed.length === 0) {
          throw new Error("SOURCE_ASSESSMENT_ALREADY_TRANSFERRED");
        }

        // 2. Generate BFX number (atomic via bfx_reference_seq)
        const bfxNumber = await generateNextBfxNumber(tx);

        // 3. Create BFX receipt in SOURCE assessment (negative amount = transferred out)
        const [bfxPayment] = await tx
          .insert(payments)
          .values({
            studentId: enrollmentRow.studentId,
            assessmentId: bfItem.sourceAssessmentId,
            bookletId: null,         // BFX doesn't use booklet
            orNumber: null,          // BFX doesn't have OR number
            orStatus: "voided",      // Not consumed (no actual OR)
            amount: String((Number(bfItem.amount) * -1).toFixed(2)), // Negative (transferred out)
            paymentMethod: "balance_forward",
            referenceNumber: bfxNumber,
            paymentDate: new Date(),
            status: "balance_forward",
            kind: "balance_forward",
            remarks: `Balance forwarded to ${enrollmentRow.schoolYearLabel}`,
            createdBy: session.userId,
            updatedBy: session.userId,
          })
          .returning({ id: payments.id });

        // 4. Audit log each transfer with BFX details
        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "assessment_balance_transferred",
          targetEntity: "assessments",
          targetId: bfItem.sourceAssessmentId,
          context: newAssessment.id,
          newState: {
            transferredToAssessmentId: newAssessment.id,
            transferredAmount: bfItem.amount,
            sourceSchoolYear: bfItem.schoolYearLabel,
            targetEnrollmentId: enrollmentId,
            bfxReceiptId: bfxPayment.id,
            bfxNumber: bfxNumber,
          },
        }, { throwOnFail: true });
      }

      // ─── Apply Approved Discounts ────────────────────────────────────────────
      // Apply any approved discount requests as negative line items
      // Pass resolved lines and transaction to avoid isolation issues
      const discountResult = await applyApprovedDiscountsToAssessment(
        newAssessment.id,
        enrollmentId,
        session.userId,
        resolvedLines.map((line) => ({
          amount: line.amount,
          isDiscount: line.isDiscount,
          feeItemTypeCode: line.feeItemTypeCode,
        })),
        tx // Pass transaction for consistent context
      );

      // If discounts were applied, recalculate assessment totals
      if (discountResult.totalDiscounts > 0) {
        const netTotal = assessmentTotalAmount - discountResult.totalDiscounts;

        await tx
          .update(assessments)
          .set({
            // totalAmount should be the NET total (sum of all line items)
            // This ensures it matches the calculated line sum in the ledger display
            totalAmount: String(netTotal.toFixed(2)),
            totalDiscounts: String(discountResult.totalDiscounts.toFixed(2)),
            balance: String(netTotal.toFixed(2)),
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(assessments.id, newAssessment.id));

        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "assessment_discounts_applied",
          targetEntity: "assessments",
          targetId: newAssessment.id,
          newState: {
            discountsApplied: discountResult.appliedCount,
            totalDiscounts: discountResult.totalDiscounts,
            netTotal,
          },
        }, { throwOnFail: true });
      }

      await tx
        .update(enrollments)
        .set({
          status: "assessed",
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(
          and(eq(enrollments.id, enrollmentId), eq(enrollments.status, "pending"))
        );

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "assessment_created_and_enrollment_assessed",
        targetEntity: "assessments",
        targetId: newAssessment.id,
        context: enrollmentId,
        newState: {
          enrollmentId,
          totalAmount: assessmentTotalAmount,
          totalDiscounts: discountResult.totalDiscounts,
          lineCount: resolvedLines.length + discountResult.appliedCount,
          feeScheduleId: scheduleResolution.scheduleId,
          balanceForwardCount: balanceForwardItems.length,
          balanceForwardTotal: balanceForwardItems.reduce((sum, bf) => sum + Number(bf.amount), 0),
          transferredAssessments: balanceForwardItems.map(bf => bf.sourceAssessmentId),
          discountsApplied: discountResult.appliedCount,
        },
      }, { throwOnFail: true });
    });

    logger.info("[assessments] Created assessment from enrollment", {
      enrollmentId,
      assessmentId: newAssessmentId,
      actorId: session.userId,
    });

    revalidatePath("/staff/assessments");
    revalidatePath("/staff/enrollments");
    revalidatePath("/staff/finance/discount-requests");
    revalidatePath(`/staff/students/${enrollmentRow.studentId}`);
    if (newAssessmentId) {
      revalidatePath(`/staff/assessments/${newAssessmentId}`);
    }
    invalidateTag(CACHE_TAGS.ASSESSMENTS);
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return { success: true, assessmentId: newAssessmentId };
  } catch (err) {
    if (String(err).includes("FEE_SCHEDULE_CHANGED")) {
      return {
        message:
          "The fee schedule changed while saving. Refresh this page and submit again.",
      };
    }
    logger.error("[assessments] Failed to create assessment", { error: String(err) });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse Balance Transfer (Admin-only)
// ─────────────────────────────────────────────────────────────────────────────

export type ReverseBalanceTransferFormState = {
  message?: string;
  success?: boolean;
};

/**
 * Reverses a balance transfer operation.
 * - Deletes balance forward items from target assessment
 * - Restores source assessments (transferredAt = NULL, restore balance)
 * - Recalculates target assessment totals
 * - Admin/super_admin only
 * - Only allowed if NO payments posted on target assessment
 * - Only allowed if enrollment status = "assessed" (not "enrolled")
 */
export async function reverseBalanceTransferAction(
  assessmentId: string
): Promise<ReverseBalanceTransferFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "assessments:reverse_transfer")) {
    return {
      message: "You do not have permission to reverse balance transfers. This action is restricted to administrators.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Fetch target assessment (the one receiving balance forwards)
      const targetAssessment = await tx.query.assessments.findFirst({
        where: eq(assessments.id, assessmentId),
        with: {
          enrollment: true,
        },
      });

      if (!targetAssessment) {
        throw new Error("Assessment not found.");
      }

      // 2. Validate no payments posted
      if (Number(targetAssessment.totalPaid) > 0) {
        throw new Error(
          "REVERSAL_BLOCKED: Cannot reverse balance transfer after payments have been posted to this assessment. Void all payments first."
        );
      }

      // 3. Validate enrollment status is still "assessed" (not enrolled)
      if (targetAssessment.enrollment?.status !== "assessed") {
        throw new Error(
          "REVERSAL_BLOCKED: Can only reverse transfers on assessments with status 'assessed'. This enrollment has already progressed to another status."
        );
      }

      // 4. Find all balance forward items linked to source assessments
      const balanceForwardItems = await tx.query.assessmentItems.findMany({
        where: and(
          eq(assessmentItems.assessmentId, assessmentId),
          isNotNull(assessmentItems.sourceAssessmentId)
        ),
      });

      if (balanceForwardItems.length === 0) {
        throw new Error("No balance forward items found to reverse.");
      }

      // 5. For each source assessment, restore balance and delete BFX receipt
      for (const bfItem of balanceForwardItems) {
        if (!bfItem.sourceAssessmentId) continue;

        const sourceAssessment = await tx.query.assessments.findFirst({
          where: eq(assessments.id, bfItem.sourceAssessmentId),
        });

        if (!sourceAssessment) {
          logger.warn(`[reverseBalanceTransfer] Source assessment ${bfItem.sourceAssessmentId} not found, skipping`);
          continue;
        }

        // 5a. Find and delete BFX receipt(s) associated with this source assessment
        const bfxReceipts = await tx.query.payments.findMany({
          where: and(
            eq(payments.assessmentId, bfItem.sourceAssessmentId),
            eq(payments.kind, "balance_forward"),
            eq(payments.status, "balance_forward")
          ),
          columns: { id: true, referenceNumber: true },
        });

        for (const bfxReceipt of bfxReceipts) {
          await tx
            .delete(payments)
            .where(eq(payments.id, bfxReceipt.id));

          // Audit log BFX deletion
          await logAudit({
            actor: session.userId,
            actorRole: session.role,
            action: "bfx_receipt_deleted",
            targetEntity: "payments",
            targetId: bfxReceipt.id,
            context: bfItem.sourceAssessmentId,
            newState: {
              bfxNumber: bfxReceipt.referenceNumber,
              reason: "balance_transfer_reversed",
              sourceAssessmentId: bfItem.sourceAssessmentId,
            },
          }, { throwOnFail: true });
        }

        // 5b. Restore source assessment balance and billing status
        await tx
          .update(assessments)
          .set({
            balance: bfItem.amount, // Restore the transferred amount
            billingStatus: "outstanding", // Restore to outstanding
            transferredAt: null,
            transferredBy: null,
            transferredToAssessmentId: null,
            transferRemarks: null,
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(assessments.id, bfItem.sourceAssessmentId));

        // 5c. Audit log restoration
        await logAudit({
          actor: session.userId,
          actorRole: session.role,
          action: "assessment_transfer_reversed",
          targetEntity: "assessments",
          targetId: bfItem.sourceAssessmentId,
          context: assessmentId,
          newState: {
            restoredBalance: bfItem.amount,
            reversedFromAssessmentId: assessmentId,
            reversedBy: session.userId,
            deletedBfxCount: bfxReceipts.length,
          },
        }, { throwOnFail: true });
      }

      // 6. Delete balance forward items from target assessment
      await tx
        .delete(assessmentItems)
        .where(
          and(
            eq(assessmentItems.assessmentId, assessmentId),
            isNotNull(assessmentItems.sourceAssessmentId)
          )
        );

      // 7. Recalculate target assessment totals (excluding deleted balance forwards)
      const remainingItems = await tx.query.assessmentItems.findMany({
        where: eq(assessmentItems.assessmentId, assessmentId),
      });

      const newTotal = remainingItems.reduce((sum, item) => {
        const amount = Number(item.amount);
        return item.isDiscount ? sum - amount : sum + amount;
      }, 0);

      await tx
        .update(assessments)
        .set({
          totalAmount: String(newTotal.toFixed(2)),
          balance: String(newTotal.toFixed(2)), // Since totalPaid = 0
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(assessments.id, assessmentId));

      // 8. Audit log the target assessment modification
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "assessment_updated_transfer_reversal",
        targetEntity: "assessments",
        targetId: assessmentId,
        context: targetAssessment.enrollmentId,
        newState: {
          removedBalanceForwardCount: balanceForwardItems.length,
          newTotalAmount: newTotal,
          restoredSourceAssessments: balanceForwardItems.map(bf => bf.sourceAssessmentId),
        },
      }, { throwOnFail: true });
    });

    logger.info("[assessments] Balance transfer reversed", {
      assessmentId,
      actorId: session.userId,
    });

    revalidatePath("/staff/assessments");
    revalidatePath(`/staff/assessments/${assessmentId}`);
    invalidateTag(CACHE_TAGS.ASSESSMENTS);
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return {
      success: true,
      message: "Balance transfer reversed successfully. Prior year balances have been restored.",
    };
  } catch (err) {
    if (String(err).includes("REVERSAL_BLOCKED")) {
      return { message: String(err).replace("Error: REVERSAL_BLOCKED: ", "") };
    }
    logger.error("[assessments] Failed to reverse balance transfer", { error: String(err) });
    return { message: "An unexpected error occurred while reversing the transfer. Please try again." };
  }
}
