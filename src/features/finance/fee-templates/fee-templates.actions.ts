/**
 * Fee Templates Server Actions
 *
 * Handles CRUD operations for fee templates, template items, schedule assignments, and overrides.
 */

"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { db } from "@/lib/db";
import {
  feeTemplates,
  feeTemplateItems,
  schoolYearFeeSchedules,
  feeScheduleOverrides,
  feeItemTypes,
  assessmentItems,
} from "@/lib/db/schema";
import {
  CreateFeeTemplateSchema,
  AddFeeTemplateItemSchema,
  AssignTemplateToSchoolYearSchema,
  CreateFeeOverrideSchema,
  RemoveFeeTemplateItemSchema,
  DeactivateScheduleSchema,
  type CreateFeeTemplateFormState,
  type AddFeeTemplateItemFormState,
  type AssignTemplateFormState,
  type CreateFeeOverrideFormState,
} from "./fee-templates.schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ─── Template CRUD ────────────────────────────────────────────────────────

export async function createFeeTemplateAction(
  _prevState: CreateFeeTemplateFormState,
  formData: FormData
): Promise<CreateFeeTemplateFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = CreateFeeTemplateSchema.safeParse({
    name: formData.get("name"),
    assessmentBand: formData.get("assessmentBand"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const [template] = await db
    .insert(feeTemplates)
    .values({
      ...parsed.data,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning({ id: feeTemplates.id });

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_template_created",
    targetEntity: "fee_templates",
    targetId: template.id,
    newState: { name: parsed.data.name, band: parsed.data.assessmentBand },
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-templates");

  return { success: true, templateId: template.id };
}

// ─── Template Items ───────────────────────────────────────────────────────

export async function addFeeTemplateItemAction(
  _prevState: AddFeeTemplateItemFormState,
  formData: FormData
): Promise<AddFeeTemplateItemFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = AddFeeTemplateItemSchema.safeParse({
    feeTemplateId: formData.get("feeTemplateId"),
    feeItemTypeId: formData.get("feeItemTypeId"),
    defaultAmount: formData.get("defaultAmount"),
    order: formData.get("order"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Check for duplicate fee type in this template
  const existing = await db.query.feeTemplateItems.findFirst({
    where: and(
      eq(feeTemplateItems.feeTemplateId, parsed.data.feeTemplateId),
      eq(feeTemplateItems.feeItemTypeId, parsed.data.feeItemTypeId)
    ),
  });

  if (existing) {
    return { message: "This fee type is already in this template" };
  }

  const [item] = await db
    .insert(feeTemplateItems)
    .values({
      feeTemplateId: parsed.data.feeTemplateId,
      feeItemTypeId: parsed.data.feeItemTypeId,
      defaultAmount: parsed.data.defaultAmount.toString(),
      order: parsed.data.order ?? 0,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning({ id: feeTemplateItems.id });

  // Load fee type name for audit log
  const feeType = await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.id, parsed.data.feeItemTypeId),
  });

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_template_item_added",
    targetEntity: "fee_template_items",
    targetId: item.id,
    context: parsed.data.feeTemplateId,
    newState: { feeType: feeType?.name, amount: parsed.data.defaultAmount },
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-templates");

  return { success: true, itemId: item.id };
}

export async function removeFeeTemplateItemAction(
  _prevState: { message?: string; success?: boolean },
  formData: FormData
): Promise<{ message?: string; success?: boolean }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = RemoveFeeTemplateItemSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { message: "Invalid item ID" };
  }

  const item = await db.query.feeTemplateItems.findFirst({
    where: eq(feeTemplateItems.id, parsed.data.id),
  });

  if (!item) {
    return { message: "Item not found" };
  }

  // Check if used in any assessment items
  const usedInAssessment = await db.query.assessmentItems.findFirst({
    where: eq(assessmentItems.feeTemplateItemId, parsed.data.id),
    columns: { id: true },
  });

  if (usedInAssessment) {
    return {
      message:
        "This fee item is used in student assessments and cannot be removed. The assessment records must retain the historical fee reference.",
    };
  }

  // Check if used in any fee schedule overrides
  const usedInOverride = await db.query.feeScheduleOverrides.findFirst({
    where: eq(feeScheduleOverrides.feeTemplateItemId, parsed.data.id),
    columns: { id: true },
  });

  if (usedInOverride) {
    return {
      message:
        "This fee item has overrides defined in fee schedules. Remove the overrides first before removing the template item.",
    };
  }

  await db.delete(feeTemplateItems).where(eq(feeTemplateItems.id, parsed.data.id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_template_item_removed",
    targetEntity: "fee_template_items",
    targetId: parsed.data.id,
    context: item.feeTemplateId,
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-templates");

  return { success: true };
}

// ─── Template Assignment ──────────────────────────────────────────────────

export async function assignTemplateToSchoolYearAction(
  _prevState: AssignTemplateFormState,
  formData: FormData
): Promise<AssignTemplateFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = AssignTemplateToSchoolYearSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    assessmentBand: formData.get("assessmentBand"),
    feeTemplateId: formData.get("feeTemplateId"),
    effectiveDate: formData.get("effectiveDate"),
    expiryDate: formData.get("expiryDate") || null,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Check for existing active schedule
  const existing = await db.query.schoolYearFeeSchedules.findFirst({
    where: and(
      eq(schoolYearFeeSchedules.schoolYearId, parsed.data.schoolYearId),
      eq(schoolYearFeeSchedules.assessmentBand, parsed.data.assessmentBand),
      eq(schoolYearFeeSchedules.isActive, true)
    ),
  });

  if (existing) {
    return {
      message:
        "An active fee schedule already exists for this school year and band. Please deactivate it first.",
    };
  }

  const [schedule] = await db
    .insert(schoolYearFeeSchedules)
    .values({
      ...parsed.data,
      isActive: true,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning({ id: schoolYearFeeSchedules.id });

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_template_assigned",
    targetEntity: "school_year_fee_schedules",
    targetId: schedule.id,
    context: parsed.data.schoolYearId,
    newState: {
      band: parsed.data.assessmentBand,
      templateId: parsed.data.feeTemplateId,
    },
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-schedules");

  return { success: true, scheduleId: schedule.id };
}

export async function deactivateFeeScheduleAction(
  _prevState: { message?: string; success?: boolean },
  formData: FormData
): Promise<{ message?: string; success?: boolean }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = DeactivateScheduleSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
  });

  if (!parsed.success) {
    return { message: "Invalid schedule ID" };
  }

  await db
    .update(schoolYearFeeSchedules)
    .set({
      isActive: false,
      updatedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(schoolYearFeeSchedules.id, parsed.data.scheduleId));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_schedule_deactivated",
    targetEntity: "school_year_fee_schedules",
    targetId: parsed.data.scheduleId,
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-schedules");
  revalidatePath(`/staff/finance/fee-schedules/${parsed.data.scheduleId}`);

  return { success: true };
}

export async function activateFeeScheduleAction(
  _prevState: { message?: string; success?: boolean },
  formData: FormData
): Promise<{ message?: string; success?: boolean }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = DeactivateScheduleSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
  });

  if (!parsed.success) {
    return { message: "Invalid schedule ID" };
  }

  await db
    .update(schoolYearFeeSchedules)
    .set({
      isActive: true,
      updatedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(schoolYearFeeSchedules.id, parsed.data.scheduleId));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_schedule_activated",
    targetEntity: "school_year_fee_schedules",
    targetId: parsed.data.scheduleId,
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-schedules");
  revalidatePath(`/staff/finance/fee-schedules/${parsed.data.scheduleId}`);

  return { success: true };
}

// ─── Override Management ──────────────────────────────────────────────────

export async function createFeeOverrideAction(
  _prevState: CreateFeeOverrideFormState,
  formData: FormData
): Promise<CreateFeeOverrideFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = CreateFeeOverrideSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    feeTemplateItemId: formData.get("feeTemplateItemId"),
    overrideAmount: formData.get("overrideAmount"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  // Check for existing override
  const existing = await db.query.feeScheduleOverrides.findFirst({
    where: and(
      eq(feeScheduleOverrides.scheduleId, parsed.data.scheduleId),
      eq(feeScheduleOverrides.feeTemplateItemId, parsed.data.feeTemplateItemId)
    ),
  });

  if (existing) {
    return { message: "An override already exists for this item. Update it instead." };
  }

  const [override] = await db
    .insert(feeScheduleOverrides)
    .values({
      scheduleId: parsed.data.scheduleId,
      feeTemplateItemId: parsed.data.feeTemplateItemId,
      overrideAmount: parsed.data.overrideAmount.toString(),
      reason: parsed.data.reason,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning({ id: feeScheduleOverrides.id });

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_override_created",
    targetEntity: "fee_schedule_overrides",
    targetId: override.id,
    context: parsed.data.scheduleId,
    newState: {
      itemId: parsed.data.feeTemplateItemId,
      amount: parsed.data.overrideAmount,
      reason: parsed.data.reason,
    },
  }, { throwOnFail: true });

  revalidatePath("/staff/finance/fee-schedules");

  return { success: true, overrideId: override.id };
}
