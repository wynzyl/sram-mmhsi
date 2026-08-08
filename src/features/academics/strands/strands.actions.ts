"use server";

import { db } from "@/lib/db";
import { strands, enrollments, subjects, sections } from "@/lib/db/schema";
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
import { strandCodeExists, shortCodeExists, getStrandById } from "./strands.queries";

/**
 * Create a new track (strand).
 * Admin only - tracks are system configuration.
 */
export async function createStrandAction(
  _prevState: CreateStrandFormState,
  formData: FormData
): Promise<CreateStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage tracks." };
  }

  const parsed = createStrandSchema.safeParse({
    code: formData.get("code"),
    shortCode: formData.get("shortCode"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    trackCategory: formData.get("trackCategory"),
    displayOrder: formData.get("displayOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { code, shortCode, name, description, trackCategory, displayOrder, isActive } = parsed.data;

  // Check if track code already exists
  if (await strandCodeExists(code)) {
    return { message: `Track code "${code}" already exists.` };
  }

  // Check if short code already exists
  if (await shortCodeExists(shortCode)) {
    return { message: `Short code "${shortCode}" already exists.` };
  }

  const [strand] = await db
    .insert(strands)
    .values({
      code,
      shortCode,
      name,
      description: description || null,
      trackCategory,
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
    newState: { code, shortCode, name, trackCategory },
  });

  invalidateTag(CACHE_TAGS.STRANDS);

  return { success: true, strandId: strand.id };
}

/**
 * Update an existing track (strand).
 * Admin only.
 */
export async function updateStrandAction(
  _prevState: UpdateStrandFormState,
  formData: FormData
): Promise<UpdateStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage tracks." };
  }

  const parsed = updateStrandSchema.safeParse({
    id: formData.get("id"),
    code: formData.get("code"),
    shortCode: formData.get("shortCode"),
    name: formData.get("name"),
    description: formData.get("description") || null,
    trackCategory: formData.get("trackCategory"),
    displayOrder: formData.get("displayOrder") || 0,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id, code, shortCode, name, description, trackCategory, displayOrder, isActive } = parsed.data;

  // Get existing track for audit
  const existing = await getStrandById(id);
  if (!existing) {
    return { message: "Track not found." };
  }

  // Check code uniqueness if changed
  if (code !== existing.code && (await strandCodeExists(code, id))) {
    return { message: `Track code "${code}" already exists.` };
  }

  // Check short code uniqueness if changed
  if (shortCode !== existing.shortCode && (await shortCodeExists(shortCode, id))) {
    return { message: `Short code "${shortCode}" already exists.` };
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
        message: `Cannot deactivate track with ${activeEnrollments.count} active enrollment(s).`,
      };
    }
  }

  await db
    .update(strands)
    .set({
      code,
      shortCode,
      name,
      description,
      trackCategory,
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
      code: existing.code,
      name: existing.name,
      isActive: existing.isActive,
    },
    newState: { code, name, isActive },
  });

  invalidateTag(CACHE_TAGS.STRANDS);

  return { success: true };
}

/**
 * Soft delete a track (strand).
 * Admin only. Cannot delete if track has enrollments, subjects, or sections.
 */
export async function deleteStrandAction(
  _prevState: DeleteStrandFormState,
  formData: FormData
): Promise<DeleteStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "strands:manage")) {
    return { message: "You do not have permission to manage tracks." };
  }

  const parsed = deleteStrandSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id } = parsed.data;

  // Get existing track
  const existing = await getStrandById(id);
  if (!existing) {
    return { message: "Track not found." };
  }

  // Check for enrollments
  const [enrollmentCount] = await db
    .select({ count: count() })
    .from(enrollments)
    .where(eq(enrollments.strandId, id));

  if (enrollmentCount.count > 0) {
    return {
      message: `Cannot delete track with ${enrollmentCount.count} enrollment(s).`,
    };
  }

  // Check for subjects with direct ownership (new model)
  const [subjectCount] = await db
    .select({ count: count() })
    .from(subjects)
    .where(and(eq(subjects.strandId, id), isNull(subjects.deletedAt)));

  if (subjectCount.count > 0) {
    return {
      message: `Cannot delete track with ${subjectCount.count} subject(s). Remove or reassign subjects first.`,
    };
  }

  // Check for sections assigned to this track
  const [sectionCount] = await db
    .select({ count: count() })
    .from(sections)
    .where(and(eq(sections.strandId, id), isNull(sections.deletedAt)));

  if (sectionCount.count > 0) {
    return {
      message: `Cannot delete track with ${sectionCount.count} section(s). Remove or reassign sections first.`,
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
