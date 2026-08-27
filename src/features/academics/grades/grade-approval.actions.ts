"use server";

/**
 * Grade Sheet Approval Actions
 *
 * Actions for the grade approval workflow:
 * - Principal return/approve
 * - Publish to student portal
 * - Lock/unlock grades
 */

import { db } from "@/lib/db";
import { gradeSheets, gradeApprovals } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  ReturnGradeSheetSchema,
  ApproveGradeSheetSchema,
  PublishGradeSheetSchema,
  LockGradeSheetSchema,
  UnlockGradeSheetSchema,
  type ReturnGradeSheetFormState,
  type ApproveGradeSheetFormState,
  type PublishGradeSheetFormState,
  type LockGradeSheetFormState,
  type UnlockGradeSheetFormState,
} from "./grades.schema";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import {
  isUniqueViolationError,
  isForeignKeyViolationError,
} from "@/lib/utils/pg-error";

// ─── Error Handling Helpers ─────────────────────────────────────────────────

// Sentinel used to roll back a lifecycle transaction when a concurrent actor
// already changed the sheet's status (compare-and-set found no matching row).
class ConcurrentTransitionError extends Error {}

// Standard message returned when a compare-and-set update matches no row,
// meaning the sheet was transitioned concurrently by another actor.
const CONCURRENT_TRANSITION_MESSAGE =
  "This grade sheet was just updated by someone else. Please refresh and try again.";

/**
 * Get a user-friendly error message for common PostgreSQL errors.
 * Uses pg-error utilities to check error codes without relying on PostgresError type.
 *
 * @param error - The caught error
 * @param context - Context for the error message (e.g., "grade sheet return", "grade sheet approval")
 * @returns User-friendly message or null if not a recognized PostgreSQL error
 */
function getPostgresErrorMessage(error: unknown, context: string): string | null {
  if (isUniqueViolationError(error)) {
    return `This ${context} has already been processed. Please refresh and try again.`;
  }
  if (isForeignKeyViolationError(error)) {
    return `Invalid reference: the ${context} references data that no longer exists.`;
  }
  return null;
}

// ─── Principal Review Actions ────────────────────────────────────────────────

/**
 * Principal returns grade sheet with remarks.
 */
export async function principalReturnAction(
  _prevState: ReturnGradeSheetFormState,
  formData: FormData
): Promise<ReturnGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:principal_review")) {
    return { message: "You do not have permission to review grades." };
  }

  const parsed = ReturnGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
    remarks: formData.get("remarks"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId, remarks } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "submitted") {
    return { message: "Cannot return - sheet is not in submitted status." };
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: only transition if the sheet is still "submitted", so a
      // concurrent approve/return cannot double-apply this transition.
      const updated = await tx
        .update(gradeSheets)
        .set({
          status: "returned",
          returnedAt: new Date(),
          returnedBy: session.userId,
          returnRemarks: remarks,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeSheets.id, gradeSheetId),
            eq(gradeSheets.status, "submitted")
          )
        )
        .returning({ id: gradeSheets.id });

      if (updated.length === 0) {
        throw new ConcurrentTransitionError();
      }

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "principal_return",
        remarks,
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:principal_return",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
      newState: { remarks },
    });

    return { success: true, message: "Grade sheet returned to adviser." };
  } catch (error) {
    if (error instanceof ConcurrentTransitionError) {
      return { message: CONCURRENT_TRANSITION_MESSAGE };
    }

    logger.error("[grades] Failed to return grade sheet", {
      error,
      gradeSheetId,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade sheet return");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to return grade sheet. Please try again or contact support." };
  }
}

/**
 * Principal approves grade sheet.
 */
export async function principalApproveAction(
  _prevState: ApproveGradeSheetFormState,
  formData: FormData
): Promise<ApproveGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:principal_review")) {
    return { message: "You do not have permission to approve grades." };
  }

  const parsed = ApproveGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "submitted") {
    return { message: "Cannot approve - sheet is not in submitted status." };
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: only transition if the sheet is still "submitted", so a
      // concurrent approve/return cannot double-apply this transition.
      const updated = await tx
        .update(gradeSheets)
        .set({
          status: "principal_approved",
          principalApprovedAt: new Date(),
          principalApprovedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeSheets.id, gradeSheetId),
            eq(gradeSheets.status, "submitted")
          )
        )
        .returning({ id: gradeSheets.id });

      if (updated.length === 0) {
        throw new ConcurrentTransitionError();
      }

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "principal_approve",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:principal_approve",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
    });

    return { success: true, message: "Grade sheet approved by principal." };
  } catch (error) {
    if (error instanceof ConcurrentTransitionError) {
      return { message: CONCURRENT_TRANSITION_MESSAGE };
    }

    logger.error("[grades] Failed to approve grade sheet", {
      error,
      gradeSheetId,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade sheet approval");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to approve grade sheet. Please try again or contact support." };
  }
}

// ─── Publish & Lock Actions ──────────────────────────────────────────────────

/**
 * Publish grades to student portal.
 */
export async function publishGradesAction(
  _prevState: PublishGradeSheetFormState,
  formData: FormData
): Promise<PublishGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:publish")) {
    return { message: "You do not have permission to publish grades." };
  }

  const parsed = PublishGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "principal_approved") {
    return { message: "Cannot publish - sheet is not in principal_approved status." };
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: only transition if the sheet is still "principal_approved",
      // so two operators cannot both publish the same sheet.
      const updated = await tx
        .update(gradeSheets)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeSheets.id, gradeSheetId),
            eq(gradeSheets.status, "principal_approved")
          )
        )
        .returning({ id: gradeSheets.id });

      if (updated.length === 0) {
        throw new ConcurrentTransitionError();
      }

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "publish",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:publish",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
    });

    return { success: true, message: "Grades published to student portal." };
  } catch (error) {
    if (error instanceof ConcurrentTransitionError) {
      return { message: CONCURRENT_TRANSITION_MESSAGE };
    }

    logger.error("[grades] Failed to publish grades", {
      error,
      gradeSheetId,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade publication");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to publish grades. Please try again or contact support." };
  }
}

/**
 * Lock grades (immutable).
 */
export async function lockGradesAction(
  _prevState: LockGradeSheetFormState,
  formData: FormData
): Promise<LockGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:lock")) {
    return { message: "You do not have permission to lock grades." };
  }

  const parsed = LockGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "published") {
    return { message: "Cannot lock - sheet is not in published status." };
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: only transition if the sheet is still "published", so a
      // concurrent lock/unlock cannot double-apply this transition.
      const updated = await tx
        .update(gradeSheets)
        .set({
          status: "locked",
          lockedAt: new Date(),
          lockedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeSheets.id, gradeSheetId),
            eq(gradeSheets.status, "published")
          )
        )
        .returning({ id: gradeSheets.id });

      if (updated.length === 0) {
        throw new ConcurrentTransitionError();
      }

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "lock",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:lock",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
    });

    return { success: true, message: "Grades locked." };
  } catch (error) {
    if (error instanceof ConcurrentTransitionError) {
      return { message: CONCURRENT_TRANSITION_MESSAGE };
    }

    logger.error("[grades] Failed to lock grades", {
      error,
      gradeSheetId,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade lock");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to lock grades. Please try again or contact support." };
  }
}

/**
 * Unlock grades (admin only, requires reason).
 */
export async function unlockGradesAction(
  _prevState: UnlockGradeSheetFormState,
  formData: FormData
): Promise<UnlockGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:unlock")) {
    return { message: "You do not have permission to unlock grades." };
  }

  const parsed = UnlockGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId, reason } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "locked") {
    return { message: "Cannot unlock - sheet is not in locked status." };
  }

  try {
    await db.transaction(async (tx) => {
      // Compare-and-set: only transition if the sheet is still "locked", so a
      // concurrent unlock cannot clear the workflow timestamps twice.
      const updated = await tx
        .update(gradeSheets)
        .set({
          status: "draft",
          lockedAt: null,
          lockedBy: null,
          publishedAt: null,
          publishedBy: null,
          principalApprovedAt: null,
          principalApprovedBy: null,
          submittedAt: null,
          submittedBy: null,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeSheets.id, gradeSheetId),
            eq(gradeSheets.status, "locked")
          )
        )
        .returning({ id: gradeSheets.id });

      if (updated.length === 0) {
        throw new ConcurrentTransitionError();
      }

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "unlock",
        remarks: reason,
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:unlock",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
      newState: { reason },
    });

    return { success: true, message: "Grades unlocked for editing." };
  } catch (error) {
    if (error instanceof ConcurrentTransitionError) {
      return { message: CONCURRENT_TRANSITION_MESSAGE };
    }

    logger.error("[grades] Failed to unlock grades", {
      error,
      gradeSheetId,
      reason,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade unlock");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to unlock grades. Please try again or contact support." };
  }
}
