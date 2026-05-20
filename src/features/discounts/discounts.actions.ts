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
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import {
  createDiscountTypeSchema,
  updateDiscountTypeSchema,
  createDiscountRequestSchema,
  approveDiscountRequestSchema,
  rejectDiscountRequestSchema,
  bulkApproveDiscountsSchema,
  cancelDiscountRequestSchema,
  reverseDiscountSchema,
  type CreateDiscountTypeFormState,
  type UpdateDiscountTypeFormState,
  type CreateDiscountRequestFormState,
  type ApproveDiscountRequestFormState,
  type RejectDiscountRequestFormState,
  type BulkApproveDiscountsFormState,
  type CancelDiscountRequestFormState,
  type ReverseDiscountFormState,
} from "./discounts.schema";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
  formatDiscountDescription,
} from "./utils/discount-calculations";

// ─── Discount Type Management ─────────────────────────────────────────────────

/**
 * Create a new discount type (admin only)
 */
export async function createDiscountTypeAction(
  _prevState: CreateDiscountTypeFormState,
  formData: FormData
): Promise<CreateDiscountTypeFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "discount_types:manage")) {
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
  if (!hasPermission(session.role, "discount_types:manage")) {
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
  if (!hasPermission(session.role, "discount_types:manage")) {
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

  const parsed = createDiscountRequestSchema.safeParse({
    studentId: formData.get("studentId"),
    enrollmentId: formData.get("enrollmentId"),
    discountTypeId: formData.get("discountTypeId"),
    requestReason: formData.get("requestReason") || undefined,
  });

  if (!parsed.success) {
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

  // Rule 1: Enrollment must be in "pending" status
  if (enrollment.status !== "pending") {
    return {
      message: `Cannot request discounts for this enrollment. Enrollment status is "${enrollment.status}". Discounts can only be requested when enrollment is pending.`,
    };
  }

  // Rule 2: No assessment should exist yet
  const [existingAssessment] = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(eq(assessments.enrollmentId, parsed.data.enrollmentId))
    .limit(1);

  if (existingAssessment) {
    return {
      message: "Cannot request discounts after assessment has been created. Please contact finance to manage discounts for assessed enrollments.",
    };
  }

  // Check for existing pending/approved request for same enrollment + discount type
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

  try {
    const [newRequest] = await db
      .insert(discountRequests)
      .values({
        studentId: parsed.data.studentId,
        enrollmentId: parsed.data.enrollmentId,
        discountTypeId: parsed.data.discountTypeId,
        requestReason: parsed.data.requestReason,
        status: "pending",
        requestedBy: session.userId,
        requestedAt: new Date(),
      })
      .returning({ id: discountRequests.id });

    // Update enrollment's hasDiscountsPending flag
    await updateEnrollmentDiscountPendingFlag(parsed.data.enrollmentId);

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "discount_request_created",
      targetEntity: "discount_requests",
      targetId: newRequest.id,
      newState: parsed.data,
    });

    revalidatePath("/staff/registrar/enrollments");
    revalidatePath("/staff/finance/discount-requests");
    return {
      success: true,
      message: "Discount request submitted for approval.",
      discountRequestId: newRequest.id,
    };
  } catch (error) {
    logger.error("[discounts] Failed to create discount request", { error });
    return { message: "An unexpected error occurred. Please try again." };
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
  if (!hasPermission(session.role, "discounts:reverse")) {
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
      // 1. Create reversal entry (offsetting positive entry)
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
          appliedAt: new Date(),
          appliedBy: session.userId,
        })
        .returning({ id: studentDiscounts.id });

      // 2. Mark original discount as reversed
      await tx
        .update(studentDiscounts)
        .set({
          reversedAt: new Date(),
          reversedBy: session.userId,
          reversalRemarks: parsed.data.reversalRemarks,
          reversalDiscountId: reversalDiscount.id,
        })
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

      // 5. Recalculate assessment totals
      const [assessment] = await tx
        .select({
          id: assessments.id,
          totalAmount: assessments.totalAmount,
          totalDiscounts: assessments.totalDiscounts,
          totalPaid: assessments.totalPaid,
        })
        .from(assessments)
        .where(eq(assessments.id, appliedDiscount.assessmentId))
        .limit(1);

      if (assessment) {
        const discountAmount = Number(appliedDiscount.discountAmount);
        const newTotalDiscounts =
          Number(assessment.totalDiscounts) - discountAmount;
        const newBalance =
          Number(assessment.totalAmount) -
          newTotalDiscounts -
          Number(assessment.totalPaid);

        await tx
          .update(assessments)
          .set({
            totalDiscounts: String(newTotalDiscounts),
            balance: String(newBalance),
            updatedBy: session.userId,
            updatedAt: new Date(),
          })
          .where(eq(assessments.id, appliedDiscount.assessmentId));
      }

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
  } catch (error) {
    logger.error("[discounts] Failed to reverse discount", { error });
    return { message: "An unexpected error occurred. Please try again." };
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
