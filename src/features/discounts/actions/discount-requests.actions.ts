"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import {
  discountTypes,
  discountRequests,
  enrollments,
  assessments,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { getDiscountRequestGate } from "../discounts.queries";
import { validateRequestIsPending } from "@/lib/utils/request-guards";
import {
  createDiscountRequestSchema,
  approveDiscountRequestSchema,
  rejectDiscountRequestSchema,
  bulkApproveDiscountsSchema,
  cancelDiscountRequestSchema,
  type CreateDiscountRequestFormState,
  type ApproveDiscountRequestFormState,
  type RejectDiscountRequestFormState,
  type BulkApproveDiscountsFormState,
  type CancelDiscountRequestFormState,
} from "../discounts.schema";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

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
    return { message: PERMISSION_ERRORS.DISCOUNTS_REQUEST };
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
    return { message: PERMISSION_ERRORS.DISCOUNTS_REVIEW };
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
    return { message: PERMISSION_ERRORS.DISCOUNTS_REVIEW };
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
    return { message: PERMISSION_ERRORS.DISCOUNTS_REVIEW };
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
    return { message: PERMISSION_ERRORS.DISCOUNTS_CANCEL_REQUEST };
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
