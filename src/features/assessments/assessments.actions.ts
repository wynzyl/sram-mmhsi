"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag, forceUpdateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  enrollments,
  assessments,
  assessmentItems,
  gradeLevels,
  schoolYears,
  feeItemTypes,
  payments,
  discountRequests,
  students,
  paymentAllocations,
} from "@/lib/db/schema";
import {
  isEffectivelySpecialEducation,
  SPED_FEE_CODE,
} from "@/lib/utils/special-education";
import { getSpedFeeAmount } from "@/features/settings/system-settings.actions";
import { eq, and, ne, isNotNull, isNull, asc, inArray } from "drizzle-orm";
import { resolveFeeScheduleForAssessment } from "./assessments.queries";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateAssessmentFromEnrollmentSchema,
  CancelAssessmentSchema,
  AddSpecialFeeSchema,
  RemoveSpecialFeeSchema,
  computeAssessmentTotals,
} from "./assessments.schema";
import type {
  AssessmentFormState,
  CancelAssessmentFormState,
  AddSpecialFeeFormState,
  RemoveSpecialFeeFormState,
} from "./assessments.schema";
import { formatCurrency } from "@/lib/utils/currency";
import { logger } from "@/lib/observability/logger";
import { logAudit, logAuditBatch } from "@/lib/utils/audit-logger";
import { reverseBalanceForwardItems } from "@/lib/utils/balance-forward";
import { parseFormData } from "@/lib/utils/form-validation";
import { generateBatchBfxNumbers } from "@/lib/utils/reference";
import {
  hasPendingDiscountRequests,
  applyApprovedDiscountsToAssessment,
} from "@/features/discounts";
import { hasPendingCancellationRequest } from "@/features/enrollments/enrollment-cancellation.queries";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import {
  assertStudentMutable,
  StudentArchivedException,
  formatArchiveError,
} from "@/features/archive/archive.guards";

export async function createAssessmentFromEnrollmentAction(
  _prevState: AssessmentFormState,
  formData: FormData
): Promise<AssessmentFormState> {
  const session = await requireStaffSession();
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

  // Fetch enrollment with school year label and SPED status for readable remarks
  const enrollmentResult = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      gradeLevelId: enrollments.gradeLevelId,
      studentType: enrollments.studentType,
      status: enrollments.status,
      specialEducationOverride: enrollments.specialEducationOverride,
      schoolYearLabel: schoolYears.label,
      studentIsSpecialEducation: students.isSpecialEducation,
    })
    .from(enrollments)
    .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
    .innerJoin(students, eq(enrollments.studentId, students.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  const enrollmentRow = enrollmentResult[0];

  if (!enrollmentRow) {
    return { message: "Enrollment not found." };
  }

  // Check if student is archived (blocked action - cannot create assessment for archived student)
  try {
    await assertStudentMutable(enrollmentRow.studentId, "create_assessment");
  } catch (error) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    throw error;
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

  // ─── Validate School Year is Active (Defense in Depth) ────────────────────
  const activeSchoolYearId = await getActiveSchoolYearId();
  if (!activeSchoolYearId) {
    return {
      message:
        "No active school year is configured. Please set the current school year before creating assessments.",
    };
  }
  if (enrollmentRow.schoolYearId !== activeSchoolYearId) {
    return {
      message:
        "Assessments can only be created for enrollments in the current active school year. This enrollment belongs to a different school year.",
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
  const balanceForwardItems: Array<{
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
          isNull(assessments.transferredAt), // Not yet transferred
          isNull(assessments.cancelledAt), // Exclude cancelled assessments
          ne(assessments.billingStatus, "cancelled") // Belt-and-suspenders check
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
    where: and(
      eq(assessments.enrollmentId, enrollmentId),
      isNull(assessments.cancelledAt)
    ),
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
    isRefundable: boolean; // For cancellation refund calculation
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
      isRefundable: template.isRefundable, // Copy from fee item type
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
        isRefundable: false, // Balance forward items are never refundable
        sourceAssessmentId: bfItem.sourceAssessmentId, // Link to source assessment
      });
    }
  }

  // ─── Add Special Education Fee (if applicable) ──────────────────────────────
  const isSpedStudent = isEffectivelySpecialEducation(
    { isSpecialEducation: enrollmentRow.studentIsSpecialEducation },
    { specialEducationOverride: enrollmentRow.specialEducationOverride }
  );

  if (isSpedStudent) {
    // Get SPED_FEE fee item type (must exist in seed data)
    const spedFeeType = await db.query.feeItemTypes.findFirst({
      where: eq(feeItemTypes.code, SPED_FEE_CODE),
      columns: { id: true, isRefundable: true },
    });

    if (!spedFeeType) {
      return {
        message:
          "Special Education Fee type not found in system. Run: npx tsx scripts/seed-fee-item-types.ts",
      };
    }

    // Get configured SPED fee amount from system settings
    const spedFeeAmount = await getSpedFeeAmount();

    // Add SPED fee to resolved lines (after regular fees, before discounts)
    resolvedLines.push({
      feeTemplateItemId: null, // Not from template
      feeItemTypeId: spedFeeType.id,
      feeItemTypeCode: SPED_FEE_CODE,
      description: "Special Education Fee",
      amount: spedFeeAmount,
      isDiscount: false,
      isRefundable: spedFeeType.isRefundable,
    });
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
          isRefundable: item.isRefundable,             // ← Snapshot from fee_item_types.isRefundable
          sourceAssessmentId: item.sourceAssessmentId ?? null, // ← Link to source assessment for balance forward
          createdBy: session.userId,
          updatedBy: session.userId,
        }))
      );

      // ─── Mark Source Assessments as Transferred & Create BFX Receipts ─────────────
      // Performance: Batch all balance forward operations to reduce 4N queries to ~4 queries
      if (balanceForwardItems.length > 0) {
        const sourceAssessmentIds = balanceForwardItems.map((bf) => bf.sourceAssessmentId);
        const now = new Date();

        // 1. Batch claim all source assessments. Conditional UPDATE with
        //    transferredAt IS NULL prevents concurrent transfers. We verify ALL
        //    expected assessments were claimed by checking returned count.
        const claimed = await tx
          .update(assessments)
          .set({
            balance: "0.00",
            billingStatus: "balance_forwarded",
            transferredAt: now,
            transferredBy: session.userId,
            transferredToAssessmentId: newAssessment.id,
            transferRemarks: `Balance transferred to ${enrollmentRow.schoolYearLabel}`,
            updatedBy: session.userId,
            updatedAt: now,
          })
          .where(
            and(
              inArray(assessments.id, sourceAssessmentIds),
              isNull(assessments.transferredAt)
            )
          )
          .returning({ id: assessments.id });

        // If not all assessments were claimed, another transaction beat us
        if (claimed.length !== balanceForwardItems.length) {
          throw new Error("SOURCE_ASSESSMENT_ALREADY_TRANSFERRED");
        }

        // 2. Generate all BFX numbers in a single query
        const bfxNumbers = await generateBatchBfxNumbers(tx, balanceForwardItems.length);

        // 3. Batch INSERT all BFX receipts (negative amounts = transferred out)
        const paymentValues = balanceForwardItems.map((bfItem, index) => ({
          studentId: enrollmentRow.studentId,
          assessmentId: bfItem.sourceAssessmentId,
          bookletId: null,         // BFX doesn't use booklet
          orNumber: null,          // BFX doesn't have OR number
          orStatus: "voided" as const,      // Not consumed (no actual OR)
          amount: String((Number(bfItem.amount) * -1).toFixed(2)), // Negative (transferred out)
          paymentMethod: "balance_forward" as const,
          referenceNumber: bfxNumbers[index],
          paymentDate: now,
          status: "balance_forward" as const,
          kind: "balance_forward" as const,
          remarks: `Balance forwarded to ${enrollmentRow.schoolYearLabel}`,
          createdBy: session.userId,
          updatedBy: session.userId,
        }));

        const bfxPayments = await tx
          .insert(payments)
          .values(paymentValues)
          .returning({ id: payments.id });

        // 4. Batch audit log all transfers
        const auditParams = balanceForwardItems.map((bfItem, index) => ({
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
            bfxReceiptId: bfxPayments[index]?.id,
            bfxNumber: bfxNumbers[index],
          },
        }));

        await logAuditBatch(auditParams, { throwOnFail: true });
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

    // Cache invalidation — NON-BLOCKING only (CLAUDE.md Gotcha #11).
    // The blocking `forceUpdateTag`/`updateTag` + `revalidatePath` calls can
    // hang this action under the production build (DB commits but the action
    // never returns, leaving the form stuck on "Saving…"). The client
    // (`AssessmentDraftForm`) already drives its own refresh via
    // `router.replace()` + TanStack `invalidateQueries` on success, so
    // stale-while-revalidate invalidation is sufficient.
    // Assessment creation flips enrollment status (pending → assessed) and feeds dashboard KPIs.
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
    logger.error("[assessments] Failed to create assessment", { error: String(err), stack: err instanceof Error ? err.stack : undefined });
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
  const session = await requireStaffSession();

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

      // 5. Reverse all balance forward items using shared utility
      await reverseBalanceForwardItems({
        tx,
        balanceForwardItems: balanceForwardItems.map((item) => ({
          sourceAssessmentId: item.sourceAssessmentId,
          amount: item.amount,
        })),
        targetAssessmentId: assessmentId,
        userId: session.userId,
        userRole: session.role,
        reason: "balance_transfer_reversed",
      });

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
    // Dashboard A/R figures shift when transfers are reversed.
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

// ─────────────────────────────────────────────────────────────────────────────
// Cancel Assessment (Complete Cancellation per CANCELLATION.md)
// ─────────────────────────────────────────────────────────────────────────────

const OUTSTANDING_PAYMENT_EPSILON = 0.009;

/**
 * Cancels an assessment with full reversal of related entities.
 *
 * Per docs/ASSESSMENT/CANCELLATION.md specification:
 *
 * Validation rules:
 * 1. User role: Admin or Finance (`assessments:cancel` permission)
 * 2. Assessment exists
 * 3. Assessment billingStatus is `outstanding` (not already cancelled/paid)
 * 4. Enrollment status is `assessed`
 * 5. **No posted payments exist** (hard block, no admin override)
 * 6. Cancellation reason **required**
 *
 * Transaction steps:
 * 1. Mark assessment as `cancelled`
 * 2. If balance was forwarded INTO this assessment:
 *    - Reverse balance forward (restore source assessment balance)
 *    - Delete BFX receipts
 * 3. Preserve discounts (discounts are managed independently via Finance workflows)
 * 4. Change enrollment: `assessed` → `pending`
 * 5. Create audit log entry
 * 6. Commit transaction
 *
 * **No partial cancellation - rollback everything on failure.**
 */
export async function cancelAssessmentAction(
  _prevState: CancelAssessmentFormState,
  formData: FormData
): Promise<CancelAssessmentFormState> {
  const session = await requireStaffSession();

  // 1. Permission check
  if (!hasPermission(session.role, "assessments:cancel")) {
    return {
      message: "You do not have permission to cancel assessments.",
    };
  }

  // 2. Parse and validate input (remarks is now required in schema)
  const result = parseFormData(CancelAssessmentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { assessmentId, remarks } = parsed.data;

  // 3. Fetch assessment with enrollment info
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
    columns: {
      id: true,
      enrollmentId: true,
      studentId: true,
      billingStatus: true,
      totalPaid: true,
      totalAmount: true,
      balance: true,
      transferredAt: true,
      cancelledAt: true,
    },
    with: {
      enrollment: {
        columns: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!assessment) {
    return { message: "Assessment not found." };
  }

  // 4. Check if student is archived (blocked action)
  try {
    await assertStudentMutable(assessment.studentId, "cancel_assessment");
  } catch (error) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    throw error;
  }

  // 5. Validate assessment billingStatus is 'outstanding'
  if (assessment.cancelledAt || assessment.billingStatus === "cancelled") {
    return { message: "This assessment has already been cancelled." };
  }

  if (assessment.billingStatus === "fully_paid") {
    return {
      message: "Cannot cancel a fully paid assessment.",
    };
  }

  if (assessment.billingStatus === "balance_forwarded") {
    return {
      message:
        "Cannot cancel a transferred assessment. The balance has already been forwarded to a newer school year.",
    };
  }

  if (assessment.billingStatus !== "outstanding") {
    return {
      message: `Cannot cancel an assessment with status '${assessment.billingStatus}'. Only outstanding assessments can be cancelled.`,
    };
  }

  // 5. Validate enrollment status is 'assessed'
  if (assessment.enrollment?.status !== "assessed") {
    return {
      message: `Cannot cancel: enrollment status is '${assessment.enrollment?.status ?? "unknown"}'. Only assessments with enrollment status 'assessed' can be cancelled.`,
    };
  }

  // 5b. Check for pending cancellation request (blocks assessment modifications)
  if (assessment.enrollmentId) {
    const hasPendingCancel = await hasPendingCancellationRequest(assessment.enrollmentId);
    if (hasPendingCancel) {
      return {
        message:
          "Cannot cancel assessment: enrollment has a pending cancellation request. Please wait for the request to be approved, rejected, or withdrawn.",
      };
    }
  }

  // 6. HARD BLOCK: No posted payments allowed (per spec, no admin override)
  const totalPaid = Number(assessment.totalPaid);
  if (totalPaid > OUTSTANDING_PAYMENT_EPSILON) {
    return {
      message: `Cannot cancel: this assessment has ${formatCurrency(totalPaid)} in posted payments. Void all payments first, then cancel.`,
    };
  }

  // 7. Execute complete cancellation transaction
  try {
    await db.transaction(async (tx) => {
      // ─── 7a. Handle Balance Forward Items (if any) ───────────────────────────
      const balanceForwardItems = await tx.query.assessmentItems.findMany({
        where: and(
          eq(assessmentItems.assessmentId, assessmentId),
          isNotNull(assessmentItems.sourceAssessmentId)
        ),
      });

      // Reverse all balance forward items using shared utility
      if (balanceForwardItems.length > 0) {
        await reverseBalanceForwardItems({
          tx,
          balanceForwardItems: balanceForwardItems.map((item) => ({
            sourceAssessmentId: item.sourceAssessmentId,
            amount: item.amount,
          })),
          targetAssessmentId: assessmentId,
          userId: session.userId,
          userRole: session.role,
          reason: "assessment_cancellation",
        });
      }

      // Delete balance forward line items from this assessment
      if (balanceForwardItems.length > 0) {
        await tx
          .delete(assessmentItems)
          .where(
            and(
              eq(assessmentItems.assessmentId, assessmentId),
              isNotNull(assessmentItems.sourceAssessmentId)
            )
          );
      }

      // ─── 7b. Reject Linked Discounts ────────────────────────────────────────
      // When an assessment is cancelled, reject its linked discount requests
      // so they don't appear as available and are excluded from discount reports.
      // Skip already-rejected rows so prior rejection metadata is preserved.
      await tx
        .update(discountRequests)
        .set({
          status: "rejected",
          decidedBy: session.userId,
          decidedAt: new Date(),
          decisionRemarks: "Auto-rejected: linked assessment was cancelled",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(discountRequests.assessmentId, assessmentId),
            ne(discountRequests.status, "rejected")
          )
        );

      // ─── 7c. Mark Assessment as Cancelled ──────────────────────────────────
      // Totals are preserved as-is (discounts remain applied)
      await tx
        .update(assessments)
        .set({
          billingStatus: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(assessments.id, assessmentId));

      // ─── 7d. Revert Enrollment to Pending ────────────────────────────────────
      await tx
        .update(enrollments)
        .set({
          status: "pending",
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(enrollments.id, assessment.enrollmentId),
            eq(enrollments.status, "assessed")
          )
        );

      // ─── 7e. Audit Log Entry ─────────────────────────────────────────────────
      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "assessment_cancelled",
          targetEntity: "assessments",
          targetId: assessmentId,
          context: assessment.enrollmentId,
          newState: {
            billingStatus: "cancelled",
            cancelledAt: new Date().toISOString(),
            remarks,
            enrollmentRevertedToPending: true,
            balanceForwardsReversed: balanceForwardItems.length,
            discountsRejected: true,
          },
        },
        { throwOnFail: true }
      );
    });

    logger.info("[assessments] Assessment cancelled with full reversal", {
      assessmentId,
      studentId: assessment.studentId,
      enrollmentId: assessment.enrollmentId,
      actorId: session.userId,
    });

    revalidatePath("/staff/assessments");
    revalidatePath(`/staff/assessments/${assessmentId}`);
    revalidatePath(`/staff/students/${assessment.studentId}`);
    revalidatePath("/staff/enrollments");
    if (assessment.enrollmentId) {
      revalidatePath(`/staff/enrollments/${assessment.enrollmentId}`);
    }
    revalidatePath("/staff/approvals");
    // Use forceUpdateTag for enrollments (read-your-own-writes - immediate consistency)
    // Use invalidateTag for dashboard (stale-while-revalidate is acceptable)
    forceUpdateTag(CACHE_TAGS.ENROLLMENTS);
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return {
      success: true,
      assessmentId,
      message:
        "Assessment cancelled successfully. Enrollment has been reverted to pending status.",
    };
  } catch (err) {
    logger.error("[assessments] Failed to cancel assessment", {
      assessmentId,
      error: String(err),
    });
    return {
      message:
        "An unexpected error occurred while cancelling the assessment. Please try again.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Special Education Fee Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Adds a Special Education (SPED) fee to an existing assessment.
 *
 * Validation rules:
 * 1. User has `assessments:update` permission
 * 2. Assessment exists and is not cancelled
 * 3. No existing SPED_FEE item on this assessment
 * 4. Amount must be positive
 *
 * Transaction steps:
 * 1. Insert new assessment item with SPED_FEE type
 * 2. Recalculate assessment totals (totalAmount, balance)
 * 3. Audit log entry
 */
export async function addSpecialFeeAction(
  _prevState: AddSpecialFeeFormState,
  formData: FormData
): Promise<AddSpecialFeeFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "assessments:update")) {
    return { message: "You do not have permission to modify assessments." };
  }

  const parsed = AddSpecialFeeSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    amount: formData.get("amount"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      errors: flat.fieldErrors as AddSpecialFeeFormState["errors"],
      message: flat.formErrors[0],
    };
  }

  const { assessmentId, amount, reason } = parsed.data;

  // Fetch assessment to validate
  const assessment = await db.query.assessments.findFirst({
    where: eq(assessments.id, assessmentId),
    columns: {
      id: true,
      studentId: true,
      enrollmentId: true,
      billingStatus: true,
      totalAmount: true,
      totalPaid: true,
      balance: true,
      cancelledAt: true,
    },
  });

  if (!assessment) {
    return { message: "Assessment not found." };
  }

  if (assessment.cancelledAt || assessment.billingStatus === "cancelled") {
    return { message: "Cannot add fees to a cancelled assessment." };
  }

  // Check if student is archived
  try {
    await assertStudentMutable(assessment.studentId, "add_special_fee");
  } catch (error) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    throw error;
  }

  // Check for existing SPED fee
  const existingSpedItem = await db.query.assessmentItems.findFirst({
    where: and(
      eq(assessmentItems.assessmentId, assessmentId),
      eq(assessmentItems.feeItemTypeId,
        db
          .select({ id: feeItemTypes.id })
          .from(feeItemTypes)
          .where(eq(feeItemTypes.code, SPED_FEE_CODE))
          .limit(1)
      )
    ),
  });

  if (existingSpedItem) {
    return {
      message:
        "A Special Education fee already exists on this assessment. Remove it first to add a new one with a different amount.",
    };
  }

  // Get SPED fee type
  const spedFeeType = await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.code, SPED_FEE_CODE),
    columns: { id: true, isRefundable: true },
  });

  if (!spedFeeType) {
    return {
      message:
        "Special Education Fee type not found in system. Run: npx tsx scripts/seed-fee-item-types.ts",
    };
  }

  let newItemId: string | undefined;

  try {
    await db.transaction(async (tx) => {
      // Insert SPED fee item
      const [newItem] = await tx
        .insert(assessmentItems)
        .values({
          assessmentId,
          feeTemplateItemId: null,
          feeItemTypeId: spedFeeType.id,
          description: "Special Education Fee",
          amount: String(amount.toFixed(2)),
          isDiscount: false,
          isRefundable: spedFeeType.isRefundable,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessmentItems.id });

      newItemId = newItem.id;

      // Recalculate assessment totals
      const newTotalAmount = Number(assessment.totalAmount) + amount;
      const newBalance = Number(assessment.balance) + amount;

      await tx
        .update(assessments)
        .set({
          totalAmount: String(newTotalAmount.toFixed(2)),
          balance: String(newBalance.toFixed(2)),
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(assessments.id, assessmentId));

      // Audit log
      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "assessments:add_special_fee",
          targetEntity: "assessments",
          targetId: assessmentId,
          context: assessment.enrollmentId ?? undefined,
          newState: {
            assessmentItemId: newItem.id,
            amount,
            reason,
            newTotalAmount,
            newBalance,
          },
        },
        { throwOnFail: true }
      );
    });

    logger.info("[assessments] Added special education fee", {
      assessmentId,
      amount,
      actorId: session.userId,
    });

    revalidatePath(`/staff/assessments/${assessmentId}`);
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return { success: true, assessmentItemId: newItemId };
  } catch (err) {
    logger.error("[assessments] Failed to add special fee", {
      assessmentId,
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Removes a Special Education (SPED) fee from an assessment.
 *
 * Validation rules:
 * 1. User has `assessments:update` permission
 * 2. Item exists and is a SPED_FEE type
 * 3. No payments have been allocated to this item (check payment_allocations)
 * 4. Reason is required for audit trail
 *
 * Transaction steps:
 * 1. Soft-delete the assessment item
 * 2. Recalculate assessment totals
 * 3. Audit log entry
 */
export async function removeSpecialFeeAction(
  _prevState: RemoveSpecialFeeFormState,
  formData: FormData
): Promise<RemoveSpecialFeeFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "assessments:update")) {
    return { message: "You do not have permission to modify assessments." };
  }

  const parsed = RemoveSpecialFeeSchema.safeParse({
    assessmentItemId: formData.get("assessmentItemId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      errors: flat.fieldErrors as RemoveSpecialFeeFormState["errors"],
      message: flat.formErrors[0],
    };
  }

  const { assessmentItemId, reason } = parsed.data;

  // Fetch the assessment item with its fee type
  const item = await db.query.assessmentItems.findFirst({
    where: eq(assessmentItems.id, assessmentItemId),
    with: {
      feeItemType: {
        columns: { code: true },
      },
      assessment: {
        columns: {
          id: true,
          studentId: true,
          enrollmentId: true,
          billingStatus: true,
          totalAmount: true,
          totalPaid: true,
          balance: true,
          cancelledAt: true,
        },
      },
    },
  });

  if (!item) {
    return { message: "Assessment item not found." };
  }

  if (item.feeItemType?.code !== SPED_FEE_CODE) {
    return {
      message:
        "This action can only remove Special Education fees. Use the standard fee management for other items.",
    };
  }

  const assessment = item.assessment;

  if (!assessment) {
    return { message: "Assessment not found." };
  }

  if (assessment.cancelledAt || assessment.billingStatus === "cancelled") {
    return { message: "Cannot modify a cancelled assessment." };
  }

  // Check if student is archived
  try {
    await assertStudentMutable(assessment.studentId, "remove_special_fee");
  } catch (error) {
    if (error instanceof StudentArchivedException) {
      return { message: formatArchiveError(error).error.message };
    }
    throw error;
  }

  // Check for payments allocated to this item
  // Payment allocations link payments to specific assessment items
  const allocatedPayments = await db.query.paymentAllocations.findFirst({
    where: eq(paymentAllocations.assessmentItemId, assessmentItemId),
  });

  if (allocatedPayments) {
    return {
      message:
        "Cannot remove: payments have already been allocated to this fee. Void the payments first.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Hard-delete the item (assessment items don't use soft delete)
      await tx
        .delete(assessmentItems)
        .where(eq(assessmentItems.id, assessmentItemId));

      // Recalculate assessment totals
      const itemAmount = Number(item.amount);
      const newTotalAmount = Number(assessment.totalAmount) - itemAmount;
      const newBalance = Number(assessment.balance) - itemAmount;

      await tx
        .update(assessments)
        .set({
          totalAmount: String(Math.max(0, newTotalAmount).toFixed(2)),
          balance: String(Math.max(0, newBalance).toFixed(2)),
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(assessments.id, assessment.id));

      // Audit log
      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "assessments:remove_special_fee",
          targetEntity: "assessments",
          targetId: assessment.id,
          context: assessment.enrollmentId ?? undefined,
          previousState: {
            assessmentItemId,
            amount: item.amount,
          },
          newState: {
            reason,
            newTotalAmount: Math.max(0, newTotalAmount),
            newBalance: Math.max(0, newBalance),
          },
        },
        { throwOnFail: true }
      );
    });

    logger.info("[assessments] Removed special education fee", {
      assessmentId: assessment.id,
      assessmentItemId,
      reason,
      actorId: session.userId,
    });

    revalidatePath(`/staff/assessments/${assessment.id}`);
    invalidateTag(CACHE_TAGS.DASHBOARD);

    return { success: true };
  } catch (err) {
    logger.error("[assessments] Failed to remove special fee", {
      assessmentItemId,
      error: String(err),
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
