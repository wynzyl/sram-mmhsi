"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { db } from "@/lib/db";
import { feeItemTypes } from "@/lib/db/schema";
import {
  CreateFeeItemTypeSchema,
  UpdateFeeItemTypeSchema,
  ToggleFeeItemTypeSchema,
  type CreateFeeItemTypeFormState,
  type UpdateFeeItemTypeFormState,
  type ToggleFeeItemTypeFormState,
} from "./fee-item-types.schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

const REVALIDATE = "/staff/finance/fee-item-types";

export async function createFeeItemTypeAction(
  _prevState: CreateFeeItemTypeFormState,
  formData: FormData
): Promise<CreateFeeItemTypeFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = CreateFeeItemTypeSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    isDiscount: formData.get("isDiscount") === "true",
    displayOrder: formData.get("displayOrder") || 0,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.code, parsed.data.code),
  });

  if (existing) {
    return { errors: { code: ["A fee type with this code already exists"] } };
  }

  const [type] = await db
    .insert(feeItemTypes)
    .values({
      ...parsed.data,
      isActive: true,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning({ id: feeItemTypes.id });

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_item_type_created",
    targetEntity: "fee_item_types",
    targetId: type.id,
    newState: { code: parsed.data.code, name: parsed.data.name, category: parsed.data.category },
  });

  revalidatePath(REVALIDATE);

  return { success: true, typeId: type.id };
}

export async function updateFeeItemTypeAction(
  _prevState: UpdateFeeItemTypeFormState,
  formData: FormData
): Promise<UpdateFeeItemTypeFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = UpdateFeeItemTypeSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    category: formData.get("category"),
    isDiscount: formData.get("isDiscount") === "true",
    displayOrder: formData.get("displayOrder"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await db.query.feeItemTypes.findFirst({
    where: eq(feeItemTypes.id, parsed.data.id),
  });

  if (!existing) {
    return { message: "Fee item type not found" };
  }

  await db
    .update(feeItemTypes)
    .set({
      name: parsed.data.name ?? existing.name,
      category: parsed.data.category ?? existing.category,
      isDiscount: parsed.data.isDiscount ?? existing.isDiscount,
      displayOrder: parsed.data.displayOrder ?? existing.displayOrder,
      updatedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(feeItemTypes.id, parsed.data.id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "fee_item_type_updated",
    targetEntity: "fee_item_types",
    targetId: parsed.data.id,
    newState: { name: parsed.data.name, category: parsed.data.category },
  });

  revalidatePath(REVALIDATE);

  return { success: true, typeId: parsed.data.id };
}

export async function toggleFeeItemTypeAction(
  _prevState: ToggleFeeItemTypeFormState,
  formData: FormData
): Promise<ToggleFeeItemTypeFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "fee_schedules:manage")) {
    return { message: "Permission denied" };
  }

  const parsed = ToggleFeeItemTypeSchema.safeParse({
    id: formData.get("id"),
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { message: "Invalid request" };
  }

  await db
    .update(feeItemTypes)
    .set({
      isActive: parsed.data.isActive,
      updatedBy: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(feeItemTypes.id, parsed.data.id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: parsed.data.isActive ? "fee_item_type_activated" : "fee_item_type_deactivated",
    targetEntity: "fee_item_types",
    targetId: parsed.data.id,
  });

  revalidatePath(REVALIDATE);

  return { success: true };
}
