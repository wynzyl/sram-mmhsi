"use server";

import { db } from "@/lib/db";
import { strands, enrollments, subjectStrands } from "@/lib/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  createStrandSchema,
  updateStrandSchema,
  deleteStrandSchema,
  type CreateStrandFormState,
  type UpdateStrandFormState,
  type DeleteStrandFormState,
} from "./strands.schema";
import { strandCodeExists, getStrandById } from "./strands.queries";

/**
 * Create a new strand.
 * Admin only - strands are system configuration.
 */
export async function createStrandAction(
  _prevState: CreateStrandFormState,
  formData: FormData
): Promise<CreateStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage strands." };
  }

  const parsed = createStrandSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    displayOrder: formData.get("displayOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { code, name, description, displayOrder, isActive } = parsed.data;

  // Check if strand code already exists
  if (await strandCodeExists(code)) {
    return { message: `Strand code "${code}" already exists.` };
  }

  const [strand] = await db
    .insert(strands)
    .values({
      code,
      name,
      description: description || null,
      displayOrder,
      isActive,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning();

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "strands:create",
    targetEntity: "strands",
    targetId: strand.id,
    newState: { code, name },
  });

  invalidateTag(CACHE_TAGS.STRANDS);

  return { success: true, strandId: strand.id };
}

/**
 * Update an existing strand.
 * Admin only.
 */
export async function updateStrandAction(
  _prevState: UpdateStrandFormState,
  formData: FormData
): Promise<UpdateStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage strands." };
  }

  const parsed = updateStrandSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    displayOrder: formData.get("displayOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id, name, description, displayOrder, isActive } = parsed.data;

  // Get existing strand for audit
  const existing = await getStrandById(id);
  if (!existing) {
    return { message: "Strand not found." };
  }

  // If deactivating, check for active enrollments
  if (!isActive && existing.isActive) {
    const [activeEnrollments] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.strandId, id),
          eq(enrollments.status, "enrolled")
        )
      );

    if (activeEnrollments.count > 0) {
      return {
        message: `Cannot deactivate strand with ${activeEnrollments.count} active enrollment(s).`,
      };
    }
  }

  await db
    .update(strands)
    .set({
      name,
      description,
      displayOrder,
      isActive,
      updatedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(strands.id, id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "strands:update",
    targetEntity: "strands",
    targetId: id,
    previousState: {
      name: existing.name,
      isActive: existing.isActive,
    },
    newState: { name, isActive },
  });

  invalidateTag(CACHE_TAGS.STRANDS);

  return { success: true };
}

/**
 * Soft delete a strand.
 * Admin only. Cannot delete if strand has enrollments or subjects.
 */
export async function deleteStrandAction(
  _prevState: DeleteStrandFormState,
  formData: FormData
): Promise<DeleteStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage strands." };
  }

  const parsed = deleteStrandSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id } = parsed.data;

  // Get existing strand
  const existing = await getStrandById(id);
  if (!existing) {
    return { message: "Strand not found." };
  }

  // Check for enrollments
  const [enrollmentCount] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.strandId, id));

  if (enrollmentCount.count > 0) {
    return {
      message: `Cannot delete strand with ${enrollmentCount.count} enrollment(s).`,
    };
  }

  // Check for subject associations
  const [subjectCount] = await db
    .select({ count: count() })
    .from(subjectStrands)
    .where(and(eq(subjectStrands.strandId, id), isNull(subjectStrands.deletedAt)));

  if (subjectCount.count > 0) {
    return {
      message: `Cannot delete strand with ${subjectCount.count} subject association(s). Remove subject links first.`,
    };
  }

  // Soft delete
  await db
    .update(strands)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(eq(strands.id, id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "strands:delete",
    targetEntity: "strands",
    targetId: id,
    previousState: { code: existing.code, name: existing.name },
  });

  invalidateTag(CACHE_TAGS.STRANDS);

  return { success: true };
}
