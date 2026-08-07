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
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
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

// ─── Principal Review Actions ────────────────────────────────────────────────

/**
 * Principal returns grade sheet with remarks.
 */
export async function principalReturnAction(
  _prevState: ReturnGradeSheetFormState,
  formData: FormData
): Promise<ReturnGradeSheetFormState> {
  const session = await requireSession();

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
      await tx
        .update(gradeSheets)
        .set({
          status: "returned",
          returnedAt: new Date(),
          returnedBy: session.userId,
          returnRemarks: remarks,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

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
    logger.error("[grades] Failed to return grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Principal approves grade sheet.
 */
export async function principalApproveAction(
  _prevState: ApproveGradeSheetFormState,
  formData: FormData
): Promise<ApproveGradeSheetFormState> {
  const session = await requireSession();

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
      await tx
        .update(gradeSheets)
        .set({
          status: "principal_approved",
          principalApprovedAt: new Date(),
          principalApprovedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

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
    logger.error("[grades] Failed to approve grade sheet", { error });
    return { message: "An unexpected error occurred." };
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
  const session = await requireSession();

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
      await tx
        .update(gradeSheets)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

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
    logger.error("[grades] Failed to publish grades", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Lock grades (immutable).
 */
export async function lockGradesAction(
  _prevState: LockGradeSheetFormState,
  formData: FormData
): Promise<LockGradeSheetFormState> {
  const session = await requireSession();

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
      await tx
        .update(gradeSheets)
        .set({
          status: "locked",
          lockedAt: new Date(),
          lockedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

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
    logger.error("[grades] Failed to lock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Unlock grades (admin only, requires reason).
 */
export async function unlockGradesAction(
  _prevState: UnlockGradeSheetFormState,
  formData: FormData
): Promise<UnlockGradeSheetFormState> {
  const session = await requireSession();

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
      await tx
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
        .where(eq(gradeSheets.id, gradeSheetId));

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
    logger.error("[grades] Failed to unlock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}
