"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { feeSchedules, feeScheduleItems, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  FeeScheduleSchema,
  FeeScheduleItemSchema,
} from "@/lib/validators/finance";
import type {
  FeeScheduleFormState,
  FeeScheduleItemFormState,
} from "@/lib/validators/finance";
import { logger } from "@/lib/observability/logger";

// ─── Fee Schedules ────────────────────────────────────────────────────────────

export async function createFeeScheduleAction(
  _prevState: FeeScheduleFormState,
  formData: FormData
): Promise<FeeScheduleFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "You do not have permission to manage fee schedules." };
  }

  const parsed = FeeScheduleSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as FeeScheduleFormState["errors"] };
  }

  const { schoolYearId, gradeLevelId, description, isActive } = parsed.data;

  // Check for duplicates
  const existing = await db.query.feeSchedules.findFirst({
    where: and(
      eq(feeSchedules.schoolYearId, schoolYearId),
      eq(feeSchedules.gradeLevelId, gradeLevelId)
    ),
  });

  if (existing) {
    return {
      errors: {
        _form: ["A fee schedule already exists for this grade level in the selected school year."],
      },
    };
  }

  try {
    const [newSchedule] = await db
      .insert(feeSchedules)
      .values({
        schoolYearId,
        gradeLevelId,
        description,
        isActive,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: feeSchedules.id });

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "fee_schedule_created",
      targetEntity: "fee_schedules",
      targetId: newSchedule.id,
      newState: JSON.stringify(parsed.data),
    });

    revalidatePath("/admin/finance/fee-schedules");
    return { success: true, message: "Fee schedule created successfully." };
  } catch (error) {
    logger.error("[finance] Failed to create fee schedule", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function updateFeeScheduleAction(
  _prevState: FeeScheduleFormState,
  formData: FormData
): Promise<FeeScheduleFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "You do not have permission to manage fee schedules." };
  }

  const id = formData.get("id") as string;
  if (!id) return { message: "Fee schedule ID is required." };

  const parsed = FeeScheduleSchema.safeParse({
    id,
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId"),
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as FeeScheduleFormState["errors"] };
  }

  const { schoolYearId, gradeLevelId, description, isActive } = parsed.data;

  // Check duplicates
  const existing = await db.query.feeSchedules.findFirst({
    where: and(
      eq(feeSchedules.schoolYearId, schoolYearId),
      eq(feeSchedules.gradeLevelId, gradeLevelId)
    ),
  });

  if (existing && existing.id !== id) {
    return {
      errors: {
        _form: ["A fee schedule already exists for this grade level in the selected school year."],
      },
    };
  }

  try {
    const existingRecord = await db.query.feeSchedules.findFirst({
      where: eq(feeSchedules.id, id),
    });

    if (!existingRecord) {
      return { message: "Fee schedule not found." };
    }

    await db
      .update(feeSchedules)
      .set({
        schoolYearId,
        gradeLevelId,
        description,
        isActive,
        updatedBy: session.userId,
        updatedAt: new Date(),
      })
      .where(eq(feeSchedules.id, id));

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "fee_schedule_updated",
      targetEntity: "fee_schedules",
      targetId: id,
      previousState: JSON.stringify(existingRecord),
      newState: JSON.stringify(parsed.data),
    });

    revalidatePath("/admin/finance/fee-schedules");
    revalidatePath(`/admin/finance/fee-schedules/${id}`);
    return { success: true, message: "Fee schedule updated successfully." };
  } catch (error) {
    logger.error("[finance] Failed to update fee schedule", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Fee Schedule Items ───────────────────────────────────────────────────────

export async function addFeeScheduleItemAction(
  _prevState: FeeScheduleItemFormState,
  formData: FormData
): Promise<FeeScheduleItemFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "You do not have permission to manage fee schedules." };
  }

  const parsed = FeeScheduleItemSchema.safeParse({
    feeScheduleId: formData.get("feeScheduleId"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    isDiscount: formData.get("isDiscount") === "on" || formData.get("isDiscount") === "true",
    order: formData.get("order") || "0",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as FeeScheduleItemFormState["errors"] };
  }

  try {
    const [newItem] = await db
      .insert(feeScheduleItems)
      .values({
        ...parsed.data,
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: feeScheduleItems.id });

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "fee_schedule_item_added",
      targetEntity: "fee_schedule_items",
      targetId: newItem.id,
      newState: JSON.stringify(parsed.data),
    });

    revalidatePath(`/admin/finance/fee-schedules/${parsed.data.feeScheduleId}`);
    return { success: true, message: "Fee item added successfully." };
  } catch (error) {
    logger.error("[finance] Failed to add fee schedule item", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function removeFeeScheduleItemAction(
  _prevState: FeeScheduleItemFormState,
  formData: FormData
): Promise<FeeScheduleItemFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "You do not have permission to manage fee schedules." };
  }

  const id = formData.get("id") as string;
  const feeScheduleId = formData.get("feeScheduleId") as string;
  if (!id || !feeScheduleId) return { message: "Invalid request." };

  try {
    const existing = await db.query.feeScheduleItems.findFirst({
      where: eq(feeScheduleItems.id, id),
    });

    if (!existing) return { message: "Item not found." };

    await db.delete(feeScheduleItems).where(eq(feeScheduleItems.id, id));

    await db.insert(auditLogs).values({
      actor: session.userId,
      actorRole: session.role,
      action: "fee_schedule_item_removed",
      targetEntity: "fee_schedule_items",
      targetId: id,
      previousState: JSON.stringify(existing),
    });

    revalidatePath(`/admin/finance/fee-schedules/${feeScheduleId}`);
    return { success: true, message: "Fee item removed successfully." };
  } catch (error) {
    logger.error("[finance] Failed to remove fee schedule item", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
