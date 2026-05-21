"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  discountTypes,
  discountRequests,
  studentDiscounts,
  assessments,
  assessmentItems,
  enrollments,
  payments,
  feeItemTypes,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import {
  lockStudentDiscountReversalStatus,
  lockDiscountRequest,
  lockAssessmentByEnrollment,
} from "@/lib/utils/tx-helpers";
import { recalcAssessmentTotalsForDiscount } from "@/lib/utils/assessment-balance";
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
  type CreateDiscountTypeFormState,
  type UpdateDiscountTypeFormState,
  type CreateDiscountRequestFormState,
  type ApproveDiscountRequestFormState,
  type RejectDiscountRequestFormState,
  type BulkApproveDiscountsFormState,
  type CancelDiscountRequestFormState,
  type ReverseDiscountFormState,
  type ApplyApprovedDiscountFormState,
} from "./discounts.schema";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
  formatDiscountDescription,
} from "./utils/discount-calculations";
import { getDiscountRequestGate } from "./discounts.queries";

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

  const parsed = createDiscountTypeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    calculationType: formData.get("calculationType"),
    baseType: formData.get("baseType"),
    defaultValue: formData.get("defaultValue"),
    isActive: formData.get("isActive") === "true",
    requiresDocumentation: formData.get("requiresDocumentation") === "true",
    isStackable: formData.get("isStackable") === "true",
    displayOrder: formData.get("displayOrder") || 0,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as CreateDiscountTypeFormState["errors"],
    };
  }

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

  const parsed = updateDiscountTypeSchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    calculationType: formData.get("calculationType"),
    baseType: formData.get("baseType"),
    defaultValue: formData.get("defaultValue"),
    isActive: formData.get("isActive") === "true",
    requiresDocumentation: formData.get("requiresDocumentation") === "true",
    isStackable: formData.get("isStackable") === "true",
    displayOrder: formData.get("displayOrder") || 0,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as UpdateDiscountTypeFormState["errors"],
    };
  }

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

  const parsed = createDiscountRequestSchema.safeParse({
    studentId: rawData.studentId,
    enrollmentId: rawData.enrollmentId,
    discountTypeId: rawData.discountTypeId,
    requestReason: rawData.requestReason || undefined,
  });

  if (!parsed.success) {
    logger.error("[discounts] Validation failed:", { errors: parsed.error.flatten() });
    return {
      errors: parsed.error.flatten()
        .fieldErrors as CreateDiscountRequestFormState["errors"],
    };
  }

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

  // Branch on whether the enrollment already has an assessment.
  const [existingAssessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.enrollmentId, parsed.data.enrollmentId))
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
    revalidatePath("/staff/finance/discount-requests");
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

  const parsed = approveDiscountRequestSchema.safeParse({
    discountRequestId: formData.get("discountRequestId"),
    overrideValue: formData.get("overrideValue") || undefined,
    overrideReason: formData.get("overrideReason") || undefined,
    decisionRemarks: formData.get("decisionRemarks") || undefined,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ApproveDiscountRequestFormState["errors"],
    };
  }

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

  if (request.status !== "pending") {
    return { message: `This request has already been ${request.status}.` };
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

    revalidatePath("/staff/finance/discount-requests");
    revalidatePath("/staff/registrar/enrollments");
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

  const parsed = rejectDiscountRequestSchema.safeParse({
    discountRequestId: formData.get("discountRequestId"),
    decisionRemarks: formData.get("decisionRemarks"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as RejectDiscountRequestFormState["errors"],
    };
  }

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

  if (request.status !== "pending") {
    return { message: `This request has already been ${request.status}.` };
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

    revalidatePath("/staff/finance/discount-requests");
    revalidatePath("/staff/registrar/enrollments");
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

  const requestIds = formData.getAll("discountRequestIds") as string[];
  const decisionRemarks = formData.get("decisionRemarks") as string | null;

  const parsed = bulkApproveDiscountsSchema.safeParse({
    discountRequestIds: requestIds,
    decisionRemarks: decisionRemarks || undefined,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as BulkApproveDiscountsFormState["errors"],
    };
  }

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

    revalidatePath("/staff/finance/discount-requests");
    revalidatePath("/staff/registrar/enrollments");
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

  const parsed = cancelDiscountRequestSchema.safeParse({
    discountRequestId: formData.get("discountRequestId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as CancelDiscountRequestFormState["errors"],
    };
  }

  // Get the request
  const [request] = await db
    .select({
      id: discountRequests.id,
      status: discountRequests.status,
      enrollmentId: discountRequests.enrollmentId,
      requestedBy: discountRequests.requestedBy,
    })
    .from(discountRequests)
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

  if (request.status !== "pending") {
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

    revalidatePath("/staff/finance/discount-requests");
    revalidatePath("/staff/registrar/enrollments");
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

  const parsed = reverseDiscountSchema.safeParse({
    studentDiscountId: formData.get("studentDiscountId"),
    reversalRemarks: formData.get("reversalRemarks"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ReverseDiscountFormState["errors"],
    };
  }

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

      if (parentAssessment?.transferredAt) {
        throw new Error(
          "REVERSE_BLOCKED: This assessment's balance was transferred to a newer school year. Reversing a discount would affect a closed ledger, which is not allowed."
        );
      }

      // "Live" = still consuming balance: only pending_confirmation/posted
      // block. Voided/reversed/reversal/balance_forward payments have already
      // released their hold on the assessment and must not block reversal.
      const livePayments = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.assessmentId, appliedDiscount.assessmentId),
            inArray(payments.status, ["pending_confirmation", "posted"])
          )
        )
        .limit(1);

      if (livePayments.length > 0) {
        throw new Error(
          "Can not reverse discount if payment has been made!"
        );
      }

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

  const parsed = applyApprovedDiscountSchema.safeParse({
    discountRequestId: formData.get("discountRequestId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten()
        .fieldErrors as ApplyApprovedDiscountFormState["errors"],
    };
  }

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

      if (assessment.transferredAt) {
        throw new Error(
          "APPLY_BLOCKED: This assessment's balance was transferred to a new school year and is read-only."
        );
      }
      if (assessment.cancelledAt) {
        throw new Error(
          "APPLY_BLOCKED: This assessment is cancelled; discounts cannot be applied."
        );
      }

      // 4. Refuse if any live payment exists. Re-applying a discount over a
      //    live payment would silently change the recorded balance.
      //    "Live" = pending_confirmation or posted; voided/reversed/reversal/
      //    balance_forward have already released their hold.
      const livePayments = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.assessmentId, assessment.id),
            inArray(payments.status, ["pending_confirmation", "posted"])
          )
        )
        .limit(1);

      if (livePayments.length > 0) {
        throw new Error(
          "APPLY_BLOCKED: A live payment exists on this assessment. Void it before applying a new discount."
        );
      }

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
      const baseAmount = calculateDiscountBase(items, discountType.baseType);
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
        },
      });

      revalidatePath("/staff/finance/discount-requests");
      revalidatePath("/staff/finance/assessments");
      revalidatePath("/staff/registrar/enrollments");

      return {
        success: true,
        message: `Discount "${discountType.name}" applied to the assessment.`,
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

  let totalDiscounts = 0;

  for (const request of approvedRequests) {
    // Calculate base amount for this discount
    const baseAmount = calculateDiscountBase(items, request.baseType);

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
