"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { feeSchedules, feeScheduleItems, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

function isGradeLevelIdNotNullDbError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current != null; depth++) {
    if (
      typeof current === "object" &&
      "code" in current &&
      "column_name" in current &&
      (current as { code?: string }).code === "23502" &&
      (current as { column_name?: string }).column_name === "grade_level_id"
    ) {
      return true;
    }
    current =
      typeof current === "object" && current !== null && "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return false;
}

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
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as FeeScheduleFormState["errors"] };
  }

  const { schoolYearId, description, isActive } = parsed.data;

  const existing = await db.query.feeSchedules.findFirst({
    where: eq(feeSchedules.schoolYearId, schoolYearId),
  });

  if (existing) {
    return {
      errors: {
        _form: ["A fee schedule already exists for this school year."],
      },
    };
  }

  try {
    const [newSchedule] = await db
      .insert(feeSchedules)
      .values({
        schoolYearId,
        gradeLevelId: null,
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
    if (isGradeLevelIdNotNullDbError(error)) {
      return {
        message:
          'Database is missing the latest migration: grade_level_id must allow NULL for school-wide schedules. From the project root run: npm run db:migrate — or apply drizzle/0006_standard_fee_catalog_one_per_school_year_and_assessment_fee_item_link.sql manually.',
      };
    }
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
    description: formData.get("description"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as FeeScheduleFormState["errors"] };
  }

  const { schoolYearId, description, isActive } = parsed.data;

  const existing = await db.query.feeSchedules.findFirst({
    where: eq(feeSchedules.schoolYearId, schoolYearId),
  });

  if (existing && existing.id !== id) {
    return {
      errors: {
        _form: ["A fee schedule already exists for this school year."],
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
        gradeLevelId: null,
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
        feeScheduleId: parsed.data.feeScheduleId,
        description: parsed.data.description,
        amount: String(parsed.data.amount),
        isDiscount: parsed.data.isDiscount,
        order: parsed.data.order,
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
