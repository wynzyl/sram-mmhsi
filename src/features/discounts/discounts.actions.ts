"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  discountTypes,
  discountRequests,
  studentDiscounts,
  assessments,
  assessmentItems,
  enrollments,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql, ne } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  lockStudentDiscountReversalStatus,
  lockDiscountRequest,
  lockAssessmentByEnrollment,
  assertAssessmentNotTransferred,
} from "@/lib/utils/tx-helpers";
import {
  recalcAssessmentTotalsForDiscount,
  recalcAssessmentTotalsForCascade,
} from "@/lib/utils/assessment-balance";
import {
  calculateCascadeAdjustments,
  formatCascadeAdjustmentDescription,
  type StudentDiscountForCascade,
} from "./utils/cascade-calculations";

/**
 * Transaction executor type for cascade discount operations.
 * Requires select, insert, and update methods available in both db and tx.
 */
type CascadeExecutor = {
  select: typeof db.select;
  insert: typeof db.insert;
  update: typeof db.update;
};
import {
  createDiscountTypeSchema,
  updateDiscountTypeSchema,
  createDiscountRequestSchema,
  approveDiscountRequestSchema,
  rejectDiscountRequestSchema,
  bulkApproveDiscountsSchema,
  cancelDiscountRequestSchema,
  reverseDiscountSchema,
  applyApprovedDiscountSchema,
  recalculateCascadeDiscountsSchema,
  type CreateDiscountTypeFormState,
  type UpdateDiscountTypeFormState,
  type CreateDiscountRequestFormState,
  type ApproveDiscountRequestFormState,
  type RejectDiscountRequestFormState,
  type BulkApproveDiscountsFormState,
  type CancelDiscountRequestFormState,
  type ReverseDiscountFormState,
  type ApplyApprovedDiscountFormState,
  type RecalculateCascadeDiscountsFormState,
} from "./discounts.schema";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
  formatDiscountDescription,
} from "./utils/discount-calculations";
import { getDiscountRequestGate } from "./discounts.queries";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import { assertNoLivePayments } from "@/lib/utils/payment-checks";
import { validateRequestIsPending } from "@/lib/utils/request-guards";

/** The code for the full payment cash discount in the discountTypes table */
const FULL_PAYMENT_DISCOUNT_CODE = "FULL_PAYMENT_DISCOUNT";

// ─── Cascade Discount Helper ──────────────────────────────────────────────────

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
 * @param assessmentItems - Current assessment items for base calculation
 * @param userId - User applying the discount
 * @param userRole - Role of the user (for audit)
 * @returns Total cascade adjustment amount and count of adjustments
 */
async function applyCascadeAdjustmentsForCashDiscount(
  tx: CascadeExecutor,
  assessmentId: string,
  cashDiscountStudentDiscountId: string,
  cashDiscountAmount: number,
  items: Array<{
    id: string;
    amount: string;
    isDiscount: boolean;
    feeItemTypeCode: string | null;
  }>,
  userId: string,
  userRole: string
): Promise<{ totalCascadeAdjustment: number; adjustmentCount: number }> {
  // Fetch existing tuition_only discounts that may cascade
  const existingTuitionDiscounts = await tx
    .select({
      id: studentDiscounts.id,
      studentId: studentDiscounts.studentId,
      assessmentId: studentDiscounts.assessmentId,
      discountTypeCode: studentDiscounts.discountTypeCode,
      discountTypeName: studentDiscounts.discountTypeName,
      calculationType: studentDiscounts.calculationType,
      baseType: studentDiscounts.baseType,
      baseAmount: studentDiscounts.baseAmount,
      discountValue: studentDiscounts.discountValue,
      discountAmount: studentDiscounts.discountAmount,
      assessmentItemId: studentDiscounts.assessmentItemId,
      cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
    })
    .from(studentDiscounts)
    .where(
      and(
        eq(studentDiscounts.assessmentId, assessmentId),
        eq(studentDiscounts.baseType, "tuition_only"),
        isNull(studentDiscounts.reversedAt),
        // Exclude the cash discount itself
        ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE)
      )
    );

  if (existingTuitionDiscounts.length === 0) {
    return { totalCascadeAdjustment: 0, adjustmentCount: 0 };
  }

  // Convert to cascade calculation format
  const discountsForCascade: StudentDiscountForCascade[] =
    existingTuitionDiscounts.map((d) => ({
      id: d.id,
      studentId: d.studentId,
      assessmentId: d.assessmentId,
      discountTypeCode: d.discountTypeCode,
      discountTypeName: d.discountTypeName,
      calculationType: d.calculationType as "fixed_amount" | "percentage",
      baseType: d.baseType as "tuition_only" | "full_assessment",
      baseAmount: d.baseAmount,
      discountValue: d.discountValue,
      discountAmount: d.discountAmount,
      assessmentItemId: d.assessmentItemId,
      cascadeAdjustmentAmount: d.cascadeAdjustmentAmount,
    }));

  // Calculate cascade adjustments
  const cascadeResult = calculateCascadeAdjustments(
    discountsForCascade,
    cashDiscountAmount,
    items
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

// ─── Discount Type Management ─────────────────────────────────────────────────

/**
 * Create a new discount type (admin only)
 */
export async function createDiscountTypeAction(
  _prevState: CreateDiscountTypeFormState,
  formData: FormData
): Promise<CreateDiscountTypeFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:manage")) {
    return { message: "You do not have permission to manage discount types." };
  }

  const result = parseFormData(createDiscountTypeSchema, formData, {
    booleanFields: ["isActive", "requiresDocumentation", "isStackable"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Check for duplicate code
  const existing = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(
      and(
        eq(discountTypes.code, parsed.data.code),
        isNull(discountTypes.deletedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        code: ["A discount type with this code already exists."],
      },
    };
  }

  try {
    const [newType] = await db
      .insert(discountTypes)
      .values({
        ...parsed.data,
        defaultValue: String(parsed.data.defaultValue),
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: discountTypes.id });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_type_created",
      targetEntity: "discount_types",
      targetId: newType.id,
      newState: parsed.data,
    });

    revalidatePath("/staff/finance/discount-types");
    invalidateTag(CACHE_TAGS.DISCOUNT_TYPES);
    return {
      success: true,
      message: "Discount type created successfully.",
      discountTypeId: newType.id,
    };
  } catch (error) {
    logger.error("[discounts] Failed to create discount type", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Update an existing discount type
 */
export async function updateDiscountTypeAction(
  _prevState: UpdateDiscountTypeFormState,
  formData: FormData
): Promise<UpdateDiscountTypeFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:manage")) {
    return { message: "You do not have permission to manage discount types." };
  }

  const result = parseFormData(updateDiscountTypeSchema, formData, {
    booleanFields: ["isActive", "requiresDocumentation", "isStackable"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Check for duplicate code (excluding current record)
  const existing = await db
    .select({ id: discountTypes.id })
    .from(discountTypes)
    .where(
      and(
        eq(discountTypes.code, parsed.data.code),
        isNull(discountTypes.deletedAt),
        sql`${discountTypes.id} != ${parsed.data.id}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        code: ["A discount type with this code already exists."],
      },
    };
  }

  try {
    const { id, ...updateData } = parsed.data;

    await db
      .update(discountTypes)
      .set({
        ...updateData,
        defaultValue: String(updateData.defaultValue),
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(discountTypes.id, id));

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_type_updated",
      targetEntity: "discount_types",
      targetId: id,
      newState: updateData,
    });

    revalidatePath("/staff/finance/discount-types");
    invalidateTag(CACHE_TAGS.DISCOUNT_TYPES);
    return { success: true, message: "Discount type updated successfully." };
  } catch (error) {
    logger.error("[discounts] Failed to update discount type", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Soft delete a discount type
 */
export async function deleteDiscountTypeAction(
  discountTypeId: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:manage")) {
    return {
      success: false,
      message: "You do not have permission to manage discount types.",
    };
  }

  try {
    await db
      .update(discountTypes)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(discountTypes.id, discountTypeId));

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_type_deleted",
      targetEntity: "discount_types",
      targetId: discountTypeId,
    });

    revalidatePath("/staff/finance/discount-types");
    invalidateTag(CACHE_TAGS.DISCOUNT_TYPES);
    return { success: true, message: "Discount type deleted successfully." };
  } catch (error) {
    logger.error("[discounts] Failed to delete discount type", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

// ─── Discount Request Management ──────────────────────────────────────────────

/**
 * Create a discount request (registrar tags student for discount)
 */
export async function createDiscountRequestAction(
  _prevState: CreateDiscountRequestFormState,
  formData: FormData
): Promise<CreateDiscountRequestFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:request")) {
    return { message: "You do not have permission to request discounts." };
  }

  // Debug logging
  const rawData = {
    studentId: formData.get("studentId"),
    enrollmentId: formData.get("enrollmentId"),
    discountTypeId: formData.get("discountTypeId"),
    requestReason: formData.get("requestReason"),
  };
  logger.info("[discounts] createDiscountRequestAction received:", { rawData });

  const result = parseFormData(createDiscountRequestSchema, formData);
  if (!result.success) {
    logger.error("[discounts] Validation failed:", { errors: result.errors });
    return { errors: result.errors };
  }

  const parsed = result;

  // Check discount type exists and is active
  const [discountType] = await db
    .select({
      id: discountTypes.id,
      isActive: discountTypes.isActive,
      isStackable: discountTypes.isStackable,
    })
    .from(discountTypes)
    .where(
      and(
        eq(discountTypes.id, parsed.data.discountTypeId),
        isNull(discountTypes.deletedAt)
      )
    )
    .limit(1);

  if (!discountType) {
    return {
      errors: {
        discountTypeId: ["Selected discount type does not exist."],
      },
    };
  }

  if (!discountType.isActive) {
    return {
      errors: {
        discountTypeId: ["Selected discount type is not active."],
      },
    };
  }

  // Verify enrollment is eligible for discount requests
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      status: enrollments.status,
    })
    .from(enrollments)
    .where(eq(enrollments.id, parsed.data.enrollmentId))
    .limit(1);

  if (!enrollment) {
    return {
      message: "Enrollment not found.",
    };
  }

  // Active duplicate guard applies to every path. After reversal the prior
  // request transitions to 'reversed' and is no longer "active", so a same-type
  // replacement is admitted here.
  const existingRequest = await db
    .select({ id: discountRequests.id, status: discountRequests.status })
    .from(discountRequests)
    .where(
      and(
        eq(discountRequests.enrollmentId, parsed.data.enrollmentId),
        eq(discountRequests.discountTypeId, parsed.data.discountTypeId),
        inArray(discountRequests.status, ["pending", "approved"])
      )
    )
    .limit(1);

  if (existingRequest.length > 0) {
    const status = existingRequest[0].status;
    return {
      errors: {
        discountTypeId: [
          `This discount is already ${status === "pending" ? "pending approval" : "approved"} for this enrollment.`,
        ],
      },
    };
  }

  // Branch on whether the enrollment already has an active (non-cancelled) assessment.
  const [existingAssessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(
      and(
        eq(assessments.enrollmentId, parsed.data.enrollmentId),
        isNull(assessments.cancelledAt)
      )
    )
    .limit(1);

  if (existingAssessment) {
    // Post-assessment path: delegate to the shared gate (also used by the UI)
    // so the action and the page template never disagree on what's blocked.
    const gate = await getDiscountRequestGate(parsed.data.enrollmentId);
    if (!gate.allowed) {
      return { message: gate.reason };
    }
    // Enrollment status check is intentionally skipped here: at this point
    // the enrollment is typically 'enrolled' (a prior payment landed it there).
    // Re-applying a discount does not change enrollment state.
  } else {
    // Original pre-assessment path: enrollment must still be 'pending'.
    if (enrollment.status !== "pending") {
      return {
        message: `Cannot request discounts for this enrollment. Enrollment status is "${enrollment.status}". Discounts can only be requested when enrollment is pending.`,
      };
    }
  }

  try {
    logger.info("[discounts] Step 1: Inserting discount request...");

    // Use raw SQL to bypass potential Drizzle ORM issues in Next.js context
    const requestReason = parsed.data.requestReason?.trim() || null;
    const insertResult = await db.execute<{ id: string }>(sql`
      INSERT INTO discount_requests (
        student_id,
        enrollment_id,
        discount_type_id,
        request_reason,
        status,
        requested_by,
        requested_at,
        created_at,
        updated_at
      ) VALUES (
        ${parsed.data.studentId},
        ${parsed.data.enrollmentId},
        ${parsed.data.discountTypeId},
        ${requestReason},
        'pending',
        ${session.userId},
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING id
    `);
    const newRequest = { id: (insertResult[0] as { id: string }).id };
    logger.info("[discounts] Step 1 complete: Request ID =", { newRequestId: newRequest.id });

    // Update enrollment's hasDiscountsPending flag
    logger.info("[discounts] Step 2: Updating enrollment discount pending flag...");
    await updateEnrollmentDiscountPendingFlag(parsed.data.enrollmentId);
    logger.info("[discounts] Step 2 complete");

    logger.info("[discounts] Step 3: Logging audit...");
    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_request_created",
      targetEntity: "discount_requests",
      targetId: newRequest.id,
      newState: parsed.data,
    });
    logger.info("[discounts] Step 3 complete");

    revalidatePath("/staff/registrar/enrollments");
    revalidatePath("/staff/approvals");
    // Discount request flips enrollment's hasDiscountsPending flag (used by queue counts).
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return {
      success: true,
      message: "Discount request submitted for approval.",
      discountRequestId: newRequest.id,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error("[discounts] Failed to create discount request", {
      error: errorMsg,
      stack: errorStack,
      parsedData: parsed.data
    });
    return { message: `Failed: ${errorMsg}` };
  }
}

/**
 * Approve a discount request (finance officer)
 */
export async function approveDiscountRequestAction(
  _prevState: ApproveDiscountRequestFormState,
  formData: FormData
): Promise<ApproveDiscountRequestFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:review")) {
    return { message: "You do not have permission to review discount requests." };
  }

  const result = parseFormData(approveDiscountRequestSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Get the request with discount type
  const [request] = await db
    .select({
      id: discountRequests.id,
      status: discountRequests.status,
      enrollmentId: discountRequests.enrollmentId,
      discountTypeName: discountTypes.name,
    })
    .from(discountRequests)
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .where(eq(discountRequests.id, parsed.data.discountRequestId))
    .limit(1);

  if (!request) {
    return { message: "Discount request not found." };
  }

  const pendingError = validateRequestIsPending(request);
  if (pendingError) {
    return { message: pendingError };
  }

  try {
    await db
      .update(discountRequests)
      .set({
        status: "approved",
        overrideValue: parsed.data.overrideValue
          ? String(parsed.data.overrideValue)
          : null,
        overrideReason: parsed.data.overrideReason,
        decisionRemarks: parsed.data.decisionRemarks,
        decidedBy: session.userId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discountRequests.id, parsed.data.discountRequestId));

    // Update enrollment's hasDiscountsPending flag
    await updateEnrollmentDiscountPendingFlag(request.enrollmentId);

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_request_approved",
      targetEntity: "discount_requests",
      targetId: parsed.data.discountRequestId,
      newState: {
        overrideValue: parsed.data.overrideValue,
        decisionRemarks: parsed.data.decisionRemarks,
      },
    });

    revalidatePath("/staff/approvals");
    revalidatePath("/staff/registrar/enrollments");
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return {
      success: true,
      message: `Discount "${request.discountTypeName}" approved successfully.`,
    };
  } catch (error) {
    logger.error("[discounts] Failed to approve discount request", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Reject a discount request (finance officer)
 */
export async function rejectDiscountRequestAction(
  _prevState: RejectDiscountRequestFormState,
  formData: FormData
): Promise<RejectDiscountRequestFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:review")) {
    return { message: "You do not have permission to review discount requests." };
  }

  const result = parseFormData(rejectDiscountRequestSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Get the request
  const [request] = await db
    .select({
      id: discountRequests.id,
      status: discountRequests.status,
      enrollmentId: discountRequests.enrollmentId,
    })
    .from(discountRequests)
    .where(eq(discountRequests.id, parsed.data.discountRequestId))
    .limit(1);

  if (!request) {
    return { message: "Discount request not found." };
  }

  const pendingError = validateRequestIsPending(request);
  if (pendingError) {
    return { message: pendingError };
  }

  try {
    await db
      .update(discountRequests)
      .set({
        status: "rejected",
        decisionRemarks: parsed.data.decisionRemarks,
        decidedBy: session.userId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(discountRequests.id, parsed.data.discountRequestId));

    // Update enrollment's hasDiscountsPending flag
    await updateEnrollmentDiscountPendingFlag(request.enrollmentId);

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_request_rejected",
      targetEntity: "discount_requests",
      targetId: parsed.data.discountRequestId,
      newState: {
        decisionRemarks: parsed.data.decisionRemarks,
      },
    });

    revalidatePath("/staff/approvals");
    revalidatePath("/staff/registrar/enrollments");
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return { success: true, message: "Discount request rejected." };
  } catch (error) {
    logger.error("[discounts] Failed to reject discount request", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Bulk approve multiple discount requests
 */
export async function bulkApproveDiscountsAction(
  _prevState: BulkApproveDiscountsFormState,
  formData: FormData
): Promise<BulkApproveDiscountsFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:review")) {
    return { message: "You do not have permission to review discount requests." };
  }

  const result = parseFormData(bulkApproveDiscountsSchema, formData, {
    arrayFields: ["discountRequestIds"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  try {
    // Get all pending requests to verify and get enrollment IDs
    const pendingRequests = await db
      .select({
        id: discountRequests.id,
        enrollmentId: discountRequests.enrollmentId,
      })
      .from(discountRequests)
      .where(
        and(
          inArray(discountRequests.id, parsed.data.discountRequestIds),
          eq(discountRequests.status, "pending")
        )
      );

    if (pendingRequests.length === 0) {
      return { message: "No pending requests found to approve." };
    }

    // Approve all pending requests
    await db
      .update(discountRequests)
      .set({
        status: "approved",
        decisionRemarks: parsed.data.decisionRemarks,
        decidedBy: session.userId,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          inArray(discountRequests.id, parsed.data.discountRequestIds),
          eq(discountRequests.status, "pending")
        )
      );

    // Update enrollment flags for affected enrollments
    const uniqueEnrollmentIds = [
      ...new Set(pendingRequests.map((r) => r.enrollmentId)),
    ];
    for (const enrollmentId of uniqueEnrollmentIds) {
      await updateEnrollmentDiscountPendingFlag(enrollmentId);
    }

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_requests_bulk_approved",
      targetEntity: "discount_requests",
      targetId: `bulk:${pendingRequests.length}`,
      newState: {
        requestIds: pendingRequests.map((r) => r.id),
        count: pendingRequests.length,
      },
    });

    revalidatePath("/staff/approvals");
    revalidatePath("/staff/registrar/enrollments");
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return {
      success: true,
      message: `${pendingRequests.length} discount request(s) approved.`,
      approvedCount: pendingRequests.length,
      failedCount: parsed.data.discountRequestIds.length - pendingRequests.length,
    };
  } catch (error) {
    logger.error("[discounts] Failed to bulk approve discount requests", {
      error,
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Cancel a discount request (by requester or admin)
 */
export async function cancelDiscountRequestAction(
  _prevState: CancelDiscountRequestFormState,
  formData: FormData
): Promise<CancelDiscountRequestFormState> {
  const session = await requireSession();

  const result = parseFormData(cancelDiscountRequestSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Get the request with enrollment status
  const [request] = await db
    .select({
      id: discountRequests.id,
      status: discountRequests.status,
      enrollmentId: discountRequests.enrollmentId,
      assessmentId: discountRequests.assessmentId,
      requestedBy: discountRequests.requestedBy,
      enrollmentStatus: enrollments.status,
    })
    .from(discountRequests)
    .innerJoin(enrollments, eq(discountRequests.enrollmentId, enrollments.id))
    .where(eq(discountRequests.id, parsed.data.discountRequestId))
    .limit(1);

  if (!request) {
    return { message: "Discount request not found." };
  }

  // Only the requester or admin can cancel
  const isRequester = request.requestedBy === session.userId;
  const isAdmin = hasPermission(session.role, "discounts:review");

  if (!isRequester && !isAdmin) {
    return { message: "You do not have permission to cancel this request." };
  }

  // Allow cancelling:
  // 1. "pending" requests (normal flow)
  // 2. "approved" requests that are NOT yet applied to an assessment
  //    AND the enrollment is still "pending" (assessment was cancelled, user wants to remove discount before reassessing)
  const canCancelPending = request.status === "pending";
  const canCancelApprovedUnapplied =
    request.status === "approved" &&
    request.assessmentId === null &&
    request.enrollmentStatus === "pending";

  if (!canCancelPending && !canCancelApprovedUnapplied) {
    if (request.status === "approved" && request.assessmentId !== null) {
      return { message: "Cannot cancel a discount that is already applied to an assessment. Reverse the discount instead." };
    }
    return { message: `Cannot cancel a request that is already ${request.status}.` };
  }

  try {
    await db
      .update(discountRequests)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(discountRequests.id, parsed.data.discountRequestId));

    // Update enrollment's hasDiscountsPending flag
    await updateEnrollmentDiscountPendingFlag(request.enrollmentId);

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_request_cancelled",
      targetEntity: "discount_requests",
      targetId: parsed.data.discountRequestId,
    });

    revalidatePath("/staff/approvals");
    revalidatePath("/staff/registrar/enrollments");
    invalidateTag(CACHE_TAGS.ENROLLMENTS);
    return { success: true, message: "Discount request cancelled." };
  } catch (error) {
    logger.error("[discounts] Failed to cancel discount request", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Discount Reversal ────────────────────────────────────────────────────────

/**
 * Reverse an applied discount (creates offsetting positive entry)
 */
export async function reverseDiscountAction(
  _prevState: ReverseDiscountFormState,
  formData: FormData
): Promise<ReverseDiscountFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:manage")) {
    return { message: "You do not have permission to reverse discounts." };
  }

  const result = parseFormData(reverseDiscountSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  // Get the applied discount
  const [appliedDiscount] = await db
    .select({
      id: studentDiscounts.id,
      assessmentId: studentDiscounts.assessmentId,
      studentId: studentDiscounts.studentId,
      discountRequestId: studentDiscounts.discountRequestId,
      discountTypeCode: studentDiscounts.discountTypeCode,
      discountTypeName: studentDiscounts.discountTypeName,
      calculationType: studentDiscounts.calculationType,
      baseType: studentDiscounts.baseType,
      baseAmount: studentDiscounts.baseAmount,
      discountValue: studentDiscounts.discountValue,
      discountAmount: studentDiscounts.discountAmount,
      assessmentItemId: studentDiscounts.assessmentItemId,
      reversedAt: studentDiscounts.reversedAt,
    })
    .from(studentDiscounts)
    .where(eq(studentDiscounts.id, parsed.data.studentDiscountId))
    .limit(1);

  if (!appliedDiscount) {
    return { message: "Applied discount not found." };
  }

  if (appliedDiscount.reversedAt) {
    return { message: "This discount has already been reversed." };
  }

  try {
    return await db.transaction(async (tx) => {
      // 0a. Lock the original studentDiscounts row and re-check reversal state
      //     (defense against concurrent double-reversal — the outer check above
      //      runs without a lock).
      const lockedDiscount = await lockStudentDiscountReversalStatus(tx, parsed.data.studentDiscountId);
      if (lockedDiscount?.reversedAt) {
        throw new Error("This discount has already been reversed.");
      }

      // 0b. Refuse if assessment balance was transferred forward to a new SY.
      //     Mirrors the same guard in voidPaymentAction.
      // 0c. Refuse if any non-voided payment exists on the parent assessment.
      //     Payment must be voided first (LIFO reversal order).
      const [parentAssessment] = await tx
        .select({
          transferredAt: assessments.transferredAt,
          cancelledAt: assessments.cancelledAt,
        })
        .from(assessments)
        .where(eq(assessments.id, appliedDiscount.assessmentId))
        .limit(1);

      assertAssessmentNotTransferred(
        parentAssessment?.transferredAt ?? null,
        "reverse discount"
      );

      // Check for pending cancellation request - need to fetch enrollment ID from assessment
      const [assessmentWithEnrollment] = await tx
        .select({
          enrollmentId: assessments.enrollmentId,
        })
        .from(assessments)
        .where(eq(assessments.id, appliedDiscount.assessmentId))
        .limit(1);

      await assertNoPendingCancellation(
        assessmentWithEnrollment?.enrollmentId,
        "reverse discount"
      );

      // Refuse if any live payment exists. Payment must be voided first (LIFO reversal order).
      await assertNoLivePayments(
        appliedDiscount.assessmentId,
        "reverse discount",
        tx
      );

      // 1. Stamp the original discount as reversed FIRST. The unique partial
      //    index `student_discounts_request_active_uidx` permits only one row
      //    per discount_request_id where reversed_at IS NULL — so the offsetting
      //    counter row (inserted next) would collide if the original were still
      //    "active" at insert time. reversalDiscountId is filled in below once
      //    the counter row exists.
      const reversedAt = new Date();
      await tx
        .update(studentDiscounts)
        .set({
          reversedAt,
          reversedBy: session.userId,
          reversalRemarks: parsed.data.reversalRemarks,
        })
        .where(eq(studentDiscounts.id, parsed.data.studentDiscountId));

      // 2. Create the offsetting (positive) counter entry. Safe now because
      //    the original is excluded from the partial unique index.
      const [reversalDiscount] = await tx
        .insert(studentDiscounts)
        .values({
          studentId: appliedDiscount.studentId,
          assessmentId: appliedDiscount.assessmentId,
          discountRequestId: appliedDiscount.discountRequestId,
          discountTypeCode: `${appliedDiscount.discountTypeCode}_REVERSAL`,
          discountTypeName: `${appliedDiscount.discountTypeName} (Reversal)`,
          calculationType: appliedDiscount.calculationType,
          baseType: appliedDiscount.baseType,
          baseAmount: appliedDiscount.baseAmount,
          discountValue: appliedDiscount.discountValue,
          discountAmount: `-${appliedDiscount.discountAmount}`, // Negative of negative = positive
          appliedAt: reversedAt,
          appliedBy: session.userId,
        })
        .returning({ id: studentDiscounts.id });

      // 3. Backfill the reversalDiscountId link on the original row.
      await tx
        .update(studentDiscounts)
        .set({ reversalDiscountId: reversalDiscount.id })
        .where(eq(studentDiscounts.id, parsed.data.studentDiscountId));

      // 3. Create reversal assessment item (positive amount to offset the discount)
      const [reversalItem] = await tx
        .insert(assessmentItems)
        .values({
          assessmentId: appliedDiscount.assessmentId,
          description: `Reversal: ${appliedDiscount.discountTypeName}`,
          amount: appliedDiscount.discountAmount, // The original discount amount (was negative, now adding back)
          isDiscount: false, // This is a charge, not a discount
          isRefundable: false, // Discount reversals are not refundable
          studentDiscountId: reversalDiscount.id,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessmentItems.id });

      // 4. Update reversal discount with assessment item link
      await tx
        .update(studentDiscounts)
        .set({ assessmentItemId: reversalItem.id })
        .where(eq(studentDiscounts.id, reversalDiscount.id));

      // 5. Recalculate assessment totals (totalAmount is NET, so it moves with
      //    the ledger when a discount is reversed).
      await recalcAssessmentTotalsForDiscount(
        tx,
        appliedDiscount.assessmentId,
        Number(appliedDiscount.discountAmount),
        "reverse",
        session.userId
      );

      // 6. Flip the originating discount_requests row to 'reversed'.
      //    This frees the unique partial index for a same-type re-request.
      await tx
        .update(discountRequests)
        .set({
          status: "reversed",
          reversedAt: new Date(),
          reversedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(discountRequests.id, appliedDiscount.discountRequestId));

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "discount_reversed",
        targetEntity: "student_discounts",
        targetId: parsed.data.studentDiscountId,
        newState: {
          reversalDiscountId: reversalDiscount.id,
          reversalRemarks: parsed.data.reversalRemarks,
          discountAmount: appliedDiscount.discountAmount,
        },
      });

      revalidatePath("/staff/finance/assessments");
      revalidatePath("/staff/registrar/enrollments");
      // Dashboard A/R figures shift when a discount is reversed.
      invalidateTag(CACHE_TAGS.DASHBOARD);
      return {
        success: true,
        message: `Discount "${appliedDiscount.discountTypeName}" reversed successfully.`,
        reversalDiscountId: reversalDiscount.id,
      };
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred. Please try again.";
    logger.error("[discounts] Failed to reverse discount", { error: String(error) });
    return { message };
  }
}

/**
 * Apply an already-approved discount request to a pre-existing assessment.
 *
 * Use case: after a Void OR + Reverse Discount cycle, a new replacement
 * discount request is created and approved. The original assessment still
 * exists (status: assessed/enrolled) and must receive the new discount
 * without going through assessment-creation again.
 *
 * Preconditions enforced inside the transaction:
 *   - discount_request.status === 'approved' AND assessment_id IS NULL
 *   - parent assessment is not cancelled and not transferred to a new SY
 *   - no non-voided payments exist on the assessment (LIFO reversal order)
 *
 * Side effects (atomic):
 *   1. Insert student_discounts row (snapshot of type/base/value).
 *   2. Insert negative assessment_items row (isDiscount=true).
 *   3. Update discount_requests: set assessmentId, baseAmount, calculatedAmount.
 *   4. Recompute assessments.totalDiscounts and balance. totalAmount is
 *      intentionally not touched — it represents the subtotal of charges.
 *   5. If a prior reversed discount on this enrollment+type exists, stamp
 *      its replacedByRequestId for audit traceability.
 *   6. Write audit log entry.
 */
export async function applyApprovedDiscountToExistingAssessment(
  _prevState: ApplyApprovedDiscountFormState,
  formData: FormData
): Promise<ApplyApprovedDiscountFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:apply")) {
    return {
      message: "You do not have permission to apply discounts to assessments.",
    };
  }

  const result = parseFormData(applyApprovedDiscountSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  try {
    return await db.transaction(async (tx) => {
      // 1. Lock the discount_requests row and confirm approved-but-unattached.
      const request = await lockDiscountRequest(tx, parsed.data.discountRequestId);

      if (!request) {
        throw new Error("Discount request not found.");
      }

      if (request.status !== "approved") {
        throw new Error(
          `Cannot apply: discount request is "${request.status}", not approved.`
        );
      }

      if (request.assessmentId) {
        throw new Error(
          "This discount request has already been applied to an assessment."
        );
      }

      // 2. Fetch the discount type for calculation config.
      const [discountType] = await tx
        .select({
          code: discountTypes.code,
          name: discountTypes.name,
          calculationType: discountTypes.calculationType,
          baseType: discountTypes.baseType,
          defaultValue: discountTypes.defaultValue,
        })
        .from(discountTypes)
        .where(eq(discountTypes.id, request.discountTypeId))
        .limit(1);

      if (!discountType) {
        throw new Error("Discount type configuration missing.");
      }

      // 3. Locate and lock the parent assessment via the enrollment.
      const assessment = await lockAssessmentByEnrollment(tx, request.enrollmentId);

      if (!assessment) {
        throw new Error(
          "No assessment exists yet on this enrollment. Create the assessment first."
        );
      }

      assertAssessmentNotTransferred(assessment.transferredAt, "apply discount");
      if (assessment.cancelledAt) {
        throw new Error(
          "APPLY_BLOCKED: This assessment is cancelled; discounts cannot be applied."
        );
      }

      // Check for pending cancellation request (blocks discount application)
      await assertNoPendingCancellation(request.enrollmentId, "apply discount");

      // 4. Refuse if any live payment exists. Re-applying a discount over a
      //    live payment would silently change the recorded balance.
      await assertNoLivePayments(assessment.id, "apply discount", tx);

      // 5. Load the live assessment items (with fee type codes) to compute
      //    the discount base. Includes prior reversal entries (isDiscount=false)
      //    so the base reflects the current line-item ledger.
      const itemRows = await tx
        .select({
          id: assessmentItems.id,
          amount: assessmentItems.amount,
          isDiscount: assessmentItems.isDiscount,
          feeItemTypeCode: feeItemTypes.code,
        })
        .from(assessmentItems)
        .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
        .where(eq(assessmentItems.assessmentId, assessment.id));

      const items = itemRows.map((r) => ({
        id: r.id,
        amount: r.amount,
        isDiscount: r.isDiscount,
        feeItemTypeCode: r.feeItemTypeCode,
      }));

      // 6. Compute the discount line via the shared utility.
      let baseAmount = calculateDiscountBase(items, discountType.baseType);

      // 6b. If this is a tuition_only discount and a cash discount already exists,
      //     reduce the base by the cash discount amount (cascade effect).
      //     This ensures the sibling/scholarship discount is calculated on the
      //     discounted tuition, not the original tuition.
      if (discountType.baseType === "tuition_only") {
        const existingCashDiscount = await tx
          .select({ discountAmount: studentDiscounts.discountAmount })
          .from(studentDiscounts)
          .where(
            and(
              eq(studentDiscounts.assessmentId, assessment.id),
              eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
              isNull(studentDiscounts.reversedAt)
            )
          )
          .limit(1);

        if (existingCashDiscount[0]) {
          const cashDiscountAmount = Number(existingCashDiscount[0].discountAmount);
          const originalBase = baseAmount;
          baseAmount = Math.max(0, baseAmount - cashDiscountAmount);
          logger.info(
            "[discounts] Applying tuition_only discount with reduced base due to existing cash discount",
            {
              originalBase,
              cashDiscountAmount,
              reducedBase: baseAmount,
              discountTypeCode: discountType.code,
            }
          );
        }
      }

      const discountValue = request.overrideValue
        ? Number(request.overrideValue)
        : Number(discountType.defaultValue);
      const discountAmount = calculateDiscountAmount(
        baseAmount,
        discountType.calculationType,
        discountValue
      );

      if (discountAmount <= 0) {
        throw new Error(
          `Cannot apply ${discountType.name}: computed discount is zero (base amount ${baseAmount}).`
        );
      }

      const description = formatDiscountDescription({
        discountRequestId: request.id,
        discountTypeCode: discountType.code,
        discountTypeName: discountType.name,
        baseType: discountType.baseType,
        baseAmount,
        calculationType: discountType.calculationType,
        discountValue,
        discountAmount,
      });

      // 7. Insert the student_discounts snapshot.
      const [studentDiscount] = await tx
        .insert(studentDiscounts)
        .values({
          studentId: request.studentId,
          assessmentId: assessment.id,
          discountRequestId: request.id,
          discountTypeCode: discountType.code,
          discountTypeName: discountType.name,
          calculationType: discountType.calculationType,
          baseType: discountType.baseType,
          baseAmount: String(baseAmount),
          discountValue: String(discountValue),
          discountAmount: String(discountAmount),
          appliedAt: new Date(),
          appliedBy: session.userId,
        })
        .returning({ id: studentDiscounts.id });

      // 8. Insert the negative assessment item.
      const [discountItem] = await tx
        .insert(assessmentItems)
        .values({
          assessmentId: assessment.id,
          description,
          amount: String(discountAmount), // Positive value; isDiscount flag controls sign in display
          isDiscount: true,
          isRefundable: false, // Discounts are not refundable
          studentDiscountId: studentDiscount.id,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: assessmentItems.id });

      // 9. Link the assessment item back onto the student_discount row.
      await tx
        .update(studentDiscounts)
        .set({ assessmentItemId: discountItem.id })
        .where(eq(studentDiscounts.id, studentDiscount.id));

      // 10. Attach the discount request to this assessment and record amounts.
      await tx
        .update(discountRequests)
        .set({
          assessmentId: assessment.id,
          baseAmount: String(baseAmount),
          calculatedAmount: String(discountAmount),
          updatedAt: new Date(),
        })
        .where(eq(discountRequests.id, request.id));

      // 11. Stamp the predecessor reversed discount with replacedByRequestId
      //     for audit chaining (most-recent reversed row for this
      //     enrollment+type, if any).
      const [predecessor] = await tx
        .select({ id: studentDiscounts.id })
        .from(studentDiscounts)
        .innerJoin(
          discountRequests,
          eq(studentDiscounts.discountRequestId, discountRequests.id)
        )
        .where(
          and(
            eq(discountRequests.enrollmentId, request.enrollmentId),
            eq(discountRequests.discountTypeId, request.discountTypeId),
            eq(discountRequests.status, "reversed"),
            isNull(studentDiscounts.replacedByRequestId)
          )
        )
        .orderBy(sql`${studentDiscounts.reversedAt} DESC NULLS LAST`)
        .limit(1);

      if (predecessor) {
        await tx
          .update(studentDiscounts)
          .set({ replacedByRequestId: request.id })
          .where(eq(studentDiscounts.id, predecessor.id));
      }

      // 12. Recompute assessment totals. totalAmount is stored as NET line
      //     sum, so applying a discount lowers it by discountAmount.
      await recalcAssessmentTotalsForDiscount(
        tx,
        assessment.id,
        discountAmount,
        "apply",
        session.userId
      );

      // 12b. If this is FULL_PAYMENT_DISCOUNT, apply cascade adjustments to
      //      existing tuition_only scholarships.
      let totalCascadeAdjustment = 0;
      let cascadeAdjustmentCount = 0;

      if (discountType.code === FULL_PAYMENT_DISCOUNT_CODE) {
        // Reload items after the cash discount was applied (includes the new discount item)
        const updatedItemRows = await tx
          .select({
            id: assessmentItems.id,
            amount: assessmentItems.amount,
            isDiscount: assessmentItems.isDiscount,
            feeItemTypeCode: feeItemTypes.code,
          })
          .from(assessmentItems)
          .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
          .where(eq(assessmentItems.assessmentId, assessment.id));

        const updatedItems = updatedItemRows.map((r) => ({
          id: r.id,
          amount: r.amount,
          isDiscount: r.isDiscount,
          feeItemTypeCode: r.feeItemTypeCode,
        }));

        const cascadeResult = await applyCascadeAdjustmentsForCashDiscount(
          tx,
          assessment.id,
          studentDiscount.id,
          discountAmount,
          updatedItems,
          session.userId,
          session.role
        );

        totalCascadeAdjustment = cascadeResult.totalCascadeAdjustment;
        cascadeAdjustmentCount = cascadeResult.adjustmentCount;
      }

      // 13. Audit log.
      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "discount_applied_to_existing_assessment",
        targetEntity: "student_discounts",
        targetId: studentDiscount.id,
        context: assessment.id,
        newState: {
          discountRequestId: request.id,
          assessmentId: assessment.id,
          baseAmount,
          discountAmount,
          predecessorStudentDiscountId: predecessor?.id ?? null,
          cascadeAdjustment: totalCascadeAdjustment,
          cascadeAdjustmentCount,
        },
      });

      revalidatePath("/staff/approvals");
      revalidatePath("/staff/finance/assessments");
      revalidatePath("/staff/registrar/enrollments");
      // Dashboard A/R figures shift when a discount is applied.
      invalidateTag(CACHE_TAGS.DASHBOARD);

      // Build success message including cascade info if applicable
      let successMessage = `Discount "${discountType.name}" applied to the assessment.`;
      if (cascadeAdjustmentCount > 0) {
        successMessage += ` ${cascadeAdjustmentCount} scholarship discount(s) recalculated.`;
      }

      return {
        success: true,
        message: successMessage,
        studentDiscountId: studentDiscount.id,
        discountAmount,
      };
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred. Please try again.";
    logger.error("[discounts] Failed to apply approved discount", { error: String(error) });
    return { message };
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Update enrollment's hasDiscountsPending flag based on current pending requests
 */
async function updateEnrollmentDiscountPendingFlag(
  enrollmentId: string
): Promise<void> {
  const [pendingCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(discountRequests)
    .where(
      and(
        eq(discountRequests.enrollmentId, enrollmentId),
        eq(discountRequests.status, "pending")
      )
    );

  const hasPending = Number(pendingCount?.count ?? 0) > 0;

  // Check if there's an assessment for this enrollment
  const [assessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (assessment) {
    await db
      .update(assessments)
      .set({
        hasDiscountsPending: hasPending,
        updatedAt: new Date(),
      })
      .where(eq(assessments.id, assessment.id));
  }
}

/**
 * Apply approved discounts to an assessment (called during assessment creation)
 * This is exported for use by the assessments module
 *
 * @param assessmentId - The ID of the assessment to apply discounts to
 * @param enrollmentId - The ID of the enrollment (to find approved discount requests)
 * @param userId - The ID of the user applying the discounts
 * @param feeItems - The fee items to use for discount base calculation.
 *                   This is passed directly to avoid transaction isolation issues
 *                   (when called inside a transaction, the items aren't committed yet,
 *                   so querying with `db` wouldn't see them).
 * @param executor - Optional database executor (transaction or db). When called from
 *                   within a transaction, pass `tx` to ensure all operations use the
 *                   same transaction context and can see uncommitted data.
 */
export async function applyApprovedDiscountsToAssessment(
  assessmentId: string,
  enrollmentId: string,
  userId: string,
  feeItems: Array<{
    amount: string | number;
    isDiscount: boolean;
    feeItemTypeCode: string | null;
  }>,
  // Use Pick to get only the methods we need - works with both db and tx
  executor: Pick<typeof db, "select" | "insert" | "update"> = db
): Promise<{
  totalDiscounts: number;
  appliedCount: number;
}> {
  // Get approved discount requests for this enrollment that haven't been applied yet
  const approvedRequests = await executor
    .select({
      id: discountRequests.id,
      studentId: discountRequests.studentId,
      discountTypeId: discountRequests.discountTypeId,
      overrideValue: discountRequests.overrideValue,
      discountTypeCode: discountTypes.code,
      discountTypeName: discountTypes.name,
      calculationType: discountTypes.calculationType,
      baseType: discountTypes.baseType,
      defaultValue: discountTypes.defaultValue,
    })
    .from(discountRequests)
    .innerJoin(discountTypes, eq(discountRequests.discountTypeId, discountTypes.id))
    .where(
      and(
        eq(discountRequests.enrollmentId, enrollmentId),
        eq(discountRequests.status, "approved"),
        isNull(discountRequests.assessmentId)
      )
    );

  if (approvedRequests.length === 0) {
    return { totalDiscounts: 0, appliedCount: 0 };
  }

  // Use the passed fee items for base calculation
  // This avoids the transaction isolation issue where getAssessmentItemsWithFeeTypes
  // would use `db` and not see uncommitted assessment items
  const items = feeItems.map((item) => ({
    id: "", // Not needed for calculation
    amount: String(item.amount),
    isDiscount: item.isDiscount,
    feeItemTypeCode: item.feeItemTypeCode,
  }));

  // Sort discounts: FULL_PAYMENT_DISCOUNT (cash discount) first, then others.
  // This ensures cash discount is applied before tuition_only discounts,
  // so the tuition_only discounts use the reduced tuition base.
  const sortedRequests = [...approvedRequests].sort((a, b) => {
    if (a.discountTypeCode === FULL_PAYMENT_DISCOUNT_CODE) return -1;
    if (b.discountTypeCode === FULL_PAYMENT_DISCOUNT_CODE) return 1;
    return 0;
  });

  let totalDiscounts = 0;
  // Track cash discount amount if applied (for cascade calculation)
  let cashDiscountAppliedAmount = 0;

  for (const request of sortedRequests) {
    // Calculate base amount for this discount
    let baseAmount = calculateDiscountBase(items, request.baseType);

    // If this is a tuition_only discount and cash discount was applied earlier
    // in this batch, reduce the base by the cash discount amount (cascade effect)
    if (request.baseType === "tuition_only" && cashDiscountAppliedAmount > 0) {
      const originalBase = baseAmount;
      baseAmount = Math.max(0, baseAmount - cashDiscountAppliedAmount);
      logger.info(
        "[discounts] Applying tuition_only discount with reduced base (same batch)",
        {
          originalBase,
          cashDiscountAmount: cashDiscountAppliedAmount,
          reducedBase: baseAmount,
          discountTypeCode: request.discountTypeCode,
        }
      );
    }

    // Use override value if provided
    const discountValue = request.overrideValue
      ? Number(request.overrideValue)
      : Number(request.defaultValue);

    // Calculate discount amount
    const discountAmount = calculateDiscountAmount(
      baseAmount,
      request.calculationType,
      discountValue
    );

    if (discountAmount <= 0) {
      continue; // Skip if no valid discount
    }

    // Track cash discount amount for subsequent tuition_only discounts
    if (request.discountTypeCode === FULL_PAYMENT_DISCOUNT_CODE) {
      cashDiscountAppliedAmount = discountAmount;
    }

    // Format description with base info
    const description = formatDiscountDescription({
      discountRequestId: request.id,
      discountTypeCode: request.discountTypeCode,
      discountTypeName: request.discountTypeName,
      baseType: request.baseType,
      baseAmount,
      calculationType: request.calculationType,
      discountValue,
      discountAmount,
    });

    // Create student discount record
    const [studentDiscount] = await executor
      .insert(studentDiscounts)
      .values({
        studentId: request.studentId,
        assessmentId,
        discountRequestId: request.id,
        discountTypeCode: request.discountTypeCode,
        discountTypeName: request.discountTypeName,
        calculationType: request.calculationType,
        baseType: request.baseType,
        baseAmount: String(baseAmount),
        discountValue: String(discountValue),
        discountAmount: String(discountAmount),
        appliedAt: new Date(),
        appliedBy: userId,
      })
      .returning({ id: studentDiscounts.id });

    // Create assessment item for discount
    // Store as POSITIVE amount - isDiscount: true indicates subtraction
    // The ledger display logic uses: isDiscount ? -amount : amount
    const [discountItem] = await executor
      .insert(assessmentItems)
      .values({
        assessmentId,
        description,
        amount: String(discountAmount), // Positive value
        isDiscount: true,
        isRefundable: false, // Discounts are not refundable
        studentDiscountId: studentDiscount.id,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: assessmentItems.id });

    // Link assessment item to student discount
    await executor
      .update(studentDiscounts)
      .set({ assessmentItemId: discountItem.id })
      .where(eq(studentDiscounts.id, studentDiscount.id));

    // Update discount request with assessment link and calculated amounts
    await executor
      .update(discountRequests)
      .set({
        assessmentId,
        baseAmount: String(baseAmount),
        calculatedAmount: String(discountAmount),
        updatedAt: new Date(),
      })
      .where(eq(discountRequests.id, request.id));

    totalDiscounts += discountAmount;
  }

  return {
    totalDiscounts,
    appliedCount: approvedRequests.length,
  };
}

// ─── Cascade Discount Recalculation ───────────────────────────────────────────

/**
 * Recalculate cascade adjustments for an assessment that has both
 * cash discount and tuition_only discounts applied.
 *
 * Use case: Fix assessments where sibling/scholarship was applied
 * after cash discount without using the reduced base.
 *
 * This action:
 * 1. Finds the cash discount on the assessment
 * 2. Finds tuition_only discounts that were calculated on the original (higher) base
 * 3. Creates cascade adjustment items to correct the over-discounted amounts
 * 4. Updates assessment totals
 *
 * The adjustment adds back the "over-discount" amount, effectively reducing
 * the total discount to what it should have been if cascade was applied.
 */
export async function recalculateCascadeDiscountsAction(
  _prevState: RecalculateCascadeDiscountsFormState,
  formData: FormData
): Promise<RecalculateCascadeDiscountsFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discounts:apply")) {
    return {
      message: "You do not have permission to recalculate cascade discounts.",
    };
  }

  const result = parseFormData(recalculateCascadeDiscountsSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  try {
    return await db.transaction(async (tx) => {
      // 1. Verify the assessment exists and is not cancelled/transferred
      const [assessment] = await tx
        .select({
          id: assessments.id,
          cancelledAt: assessments.cancelledAt,
          transferredAt: assessments.transferredAt,
          enrollmentId: assessments.enrollmentId,
        })
        .from(assessments)
        .where(eq(assessments.id, parsed.data.assessmentId))
        .limit(1);

      if (!assessment) {
        throw new Error("Assessment not found.");
      }

      assertAssessmentNotTransferred(
        assessment.transferredAt,
        "recalculate cascade discounts"
      );
      if (assessment.cancelledAt) {
        throw new Error(
          "Cannot recalculate cascade discounts on a cancelled assessment."
        );
      }

      // Check for pending cancellation
      await assertNoPendingCancellation(
        assessment.enrollmentId,
        "recalculate cascade discounts"
      );

      // Refuse if any live payment exists
      await assertNoLivePayments(
        assessment.id,
        "recalculate cascade discounts",
        tx
      );

      // 2. Find the cash discount on this assessment
      const [cashDiscount] = await tx
        .select({
          id: studentDiscounts.id,
          discountAmount: studentDiscounts.discountAmount,
        })
        .from(studentDiscounts)
        .where(
          and(
            eq(studentDiscounts.assessmentId, parsed.data.assessmentId),
            eq(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
            isNull(studentDiscounts.reversedAt)
          )
        )
        .limit(1);

      if (!cashDiscount) {
        return {
          message:
            "No cash discount found on this assessment. Cascade recalculation is only needed when a cash discount exists.",
        };
      }

      const cashDiscountAmount = Number(cashDiscount.discountAmount);

      // 3. Find tuition_only discounts that may need recalculation
      //    (discounts that don't already have cascade adjustments)
      const tuitionDiscounts = await tx
        .select({
          id: studentDiscounts.id,
          discountTypeCode: studentDiscounts.discountTypeCode,
          discountTypeName: studentDiscounts.discountTypeName,
          calculationType: studentDiscounts.calculationType,
          baseType: studentDiscounts.baseType,
          baseAmount: studentDiscounts.baseAmount,
          discountValue: studentDiscounts.discountValue,
          discountAmount: studentDiscounts.discountAmount,
          assessmentItemId: studentDiscounts.assessmentItemId,
          cascadeAdjustmentAmount: studentDiscounts.cascadeAdjustmentAmount,
        })
        .from(studentDiscounts)
        .where(
          and(
            eq(studentDiscounts.assessmentId, parsed.data.assessmentId),
            eq(studentDiscounts.baseType, "tuition_only"),
            ne(studentDiscounts.discountTypeCode, FULL_PAYMENT_DISCOUNT_CODE),
            isNull(studentDiscounts.reversedAt)
          )
        );

      if (tuitionDiscounts.length === 0) {
        return {
          message:
            "No tuition-only discounts found on this assessment. No cascade recalculation needed.",
        };
      }

      // 4. Get current assessment items to calculate correct base
      const itemRows = await tx
        .select({
          id: assessmentItems.id,
          amount: assessmentItems.amount,
          isDiscount: assessmentItems.isDiscount,
          feeItemTypeCode: feeItemTypes.code,
        })
        .from(assessmentItems)
        .leftJoin(feeItemTypes, eq(assessmentItems.feeItemTypeId, feeItemTypes.id))
        .where(eq(assessmentItems.assessmentId, parsed.data.assessmentId));

      const items = itemRows.map((r) => ({
        id: r.id,
        amount: r.amount,
        isDiscount: r.isDiscount,
        feeItemTypeCode: r.feeItemTypeCode,
      }));

      // 5. Calculate the correct tuition base (should be original tuition - cash discount)
      const originalTuitionBase = calculateDiscountBase(items, "tuition_only");
      const correctTuitionBase = Math.max(0, originalTuitionBase - cashDiscountAmount);

      // 6. For each tuition_only discount, check if recalculation needed
      let adjustmentsApplied = 0;
      let totalAdjustmentAmount = 0;

      for (const discount of tuitionDiscounts) {
        // Skip if already has cascade adjustment
        if (
          discount.cascadeAdjustmentAmount !== null &&
          Number(discount.cascadeAdjustmentAmount) > 0
        ) {
          continue;
        }

        const currentBase = Number(discount.baseAmount);
        const discountValue = Number(discount.discountValue);

        // If current base is higher than correct base, recalculation needed
        // This indicates the discount was calculated on original tuition instead of discounted tuition
        if (currentBase > correctTuitionBase + 0.01) {
          const currentAmount = Number(discount.discountAmount);
          const correctAmount = calculateDiscountAmount(
            correctTuitionBase,
            discount.calculationType as "fixed_amount" | "percentage",
            discountValue
          );
          const adjustmentNeeded = currentAmount - correctAmount;

          // Only create adjustment if meaningful (> 1 centavo)
          if (adjustmentNeeded > 0.01) {
            // Create cascade adjustment item (positive = adds to balance)
            const adjustmentDescription = formatCascadeAdjustmentDescription(
              {
                studentDiscountId: discount.id,
                discountTypeName: discount.discountTypeName,
                discountTypeCode: discount.discountTypeCode,
                originalDiscountAmount: currentAmount,
                recalculatedDiscountAmount: correctAmount,
                adjustmentAmount: adjustmentNeeded,
                originalAssessmentItemId: discount.assessmentItemId,
                newBaseAmount: correctTuitionBase,
              },
              correctTuitionBase
            );

            await tx.insert(assessmentItems).values({
              assessmentId: parsed.data.assessmentId,
              description: adjustmentDescription,
              amount: String(adjustmentNeeded),
              isDiscount: false, // Positive = adds to balance
              isRefundable: false,
              isCascadeAdjustment: true,
              adjustsItemId: discount.assessmentItemId,
              createdBy: session.userId,
              updatedBy: session.userId,
            });

            // Update student discount with cascade tracking
            await tx
              .update(studentDiscounts)
              .set({
                cascadeAdjustmentAmount: String(adjustmentNeeded),
                cascadeTriggeredByDiscountId: cashDiscount.id,
              })
              .where(eq(studentDiscounts.id, discount.id));

            // Update assessment totals
            await recalcAssessmentTotalsForCascade(
              tx,
              parsed.data.assessmentId,
              adjustmentNeeded,
              session.userId
            );

            adjustmentsApplied++;
            totalAdjustmentAmount += adjustmentNeeded;

            // Audit log
            await logAudit({
              actor: session.userId,
              actorRole: session.role,
              action: "cascade_discount_recalculated",
              targetEntity: "student_discounts",
              targetId: discount.id,
              context: `Cascade recalculation for assessment ${parsed.data.assessmentId}`,
              newState: {
                originalDiscountAmount: currentAmount,
                recalculatedAmount: correctAmount,
                adjustmentAmount: adjustmentNeeded,
                originalBase: currentBase,
                correctBase: correctTuitionBase,
                cashDiscountAmount,
                triggeredByDiscountId: cashDiscount.id,
              },
            });
          }
        }
      }

      if (adjustmentsApplied === 0) {
        return {
          success: true,
          message:
            "No cascade adjustments needed. All tuition-only discounts are already correctly calculated.",
          adjustmentsApplied: 0,
          totalAdjustmentAmount: 0,
        };
      }

      revalidatePath("/staff/finance/assessments");
      // Dashboard A/R figures shift when cascade adjustments are applied
      invalidateTag(CACHE_TAGS.DASHBOARD);

      return {
        success: true,
        message: `${adjustmentsApplied} discount(s) recalculated. Total adjustment: ₱${totalAdjustmentAmount.toFixed(2)}.`,
        adjustmentsApplied,
        totalAdjustmentAmount,
      };
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred. Please try again.";
    logger.error("[discounts] Failed to recalculate cascade discounts", {
      error: String(error),
    });
    return { message };
  }
}
