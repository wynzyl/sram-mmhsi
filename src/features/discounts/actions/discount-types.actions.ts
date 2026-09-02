"use server";

import { revalidatePath } from "next/cache";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { db } from "@/lib/db";
import { discountTypes } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  createDiscountTypeSchema,
  updateDiscountTypeSchema,
  type CreateDiscountTypeFormState,
  type UpdateDiscountTypeFormState,
} from "../discounts.schema";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

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
    return { message: PERMISSION_ERRORS.DISCOUNTS_MANAGE_TYPES };
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
    return { message: PERMISSION_ERRORS.DISCOUNTS_MANAGE_TYPES };
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
      message: PERMISSION_ERRORS.DISCOUNTS_MANAGE_TYPES,
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
