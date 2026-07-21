"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { sectionAdvisers, sections, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logCreateAction, logDeleteAction } from "@/lib/utils/audit-logger";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { isUniqueViolationError } from "@/lib/utils/pg-error";
import {
  assignAdviserSchema,
  removeAdviserSchema,
  type AssignAdviserFormState,
  type RemoveAdviserFormState,
} from "./advisers.schema";

// ─── Assign Adviser Action ───────────────────────────────────────────────────

/**
 * Assign a teacher as adviser to a section for a school year.
 * Only one adviser per section per school year is allowed.
 */
export async function assignAdviserAction(
  _prevState: AssignAdviserFormState,
  formData: FormData
): Promise<AssignAdviserFormState> {
  const session = await requireSession();

  // 1. Permission check
  if (!hasPermission(session.role, "advisers:manage")) {
    return {
      message: "You do not have permission to assign advisers.",
    };
  }

  // 2. Validate input
  const parsed = assignAdviserSchema.safeParse({
    sectionId: formData.get("sectionId"),
    userId: formData.get("userId"),
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { sectionId, userId, schoolYearId } = parsed.data;

  // 3. Validate section exists and belongs to the same school year
  const [section] = await db
    .select({ id: sections.id, schoolYearId: sections.schoolYearId })
    .from(sections)
    .where(and(eq(sections.id, sectionId), isNull(sections.deletedAt)))
    .limit(1);

  if (!section) {
    return {
      message: "Section not found.",
    };
  }

  if (section.schoolYearId !== schoolYearId) {
    return {
      message: "Section does not belong to the selected school year.",
    };
  }

  // 4. Validate user exists and is a teacher
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!user) {
    return {
      message: "User not found.",
    };
  }

  if (user.role !== "teacher") {
    return {
      message: "Only teachers can be assigned as advisers.",
    };
  }

  // 5. Check if section already has an adviser
  const [existingAdviser] = await db
    .select({ id: sectionAdvisers.id })
    .from(sectionAdvisers)
    .where(
      and(
        eq(sectionAdvisers.sectionId, sectionId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt)
      )
    )
    .limit(1);

  if (existingAdviser) {
    return {
      message: "This section already has an adviser assigned. Remove the existing adviser first.",
    };
  }

  // 6. Create adviser assignment
  let adviserId: string;
  try {
    const [adviser] = await db
      .insert(sectionAdvisers)
      .values({
        sectionId,
        userId,
        schoolYearId,
        createdBy: session.userId,
      })
      .returning();
    adviserId = adviser.id;
  } catch (error) {
    // A concurrent insert can slip past the existing-adviser check above and hit the
    // unique index (section_advisers_section_sy_uidx). Surface the same guidance.
    if (isUniqueViolationError(error)) {
      return {
        message:
          "This section already has an adviser assigned. Remove the existing adviser first.",
      };
    }
    throw error;
  }

  // 7. Audit log
  await logCreateAction(session, "section_advisers", adviserId, {
    sectionId,
    userId,
    schoolYearId,
  });

  // 8. Invalidate cache
  invalidateTag(CACHE_TAGS.SECTIONS);

  return {
    success: true,
    message: "Adviser assigned successfully.",
    adviserId,
  };
}

// ─── Remove Adviser Action ───────────────────────────────────────────────────

/**
 * Remove an adviser assignment (soft delete).
 */
export async function removeAdviserAction(
  _prevState: RemoveAdviserFormState,
  formData: FormData
): Promise<RemoveAdviserFormState> {
  const session = await requireSession();

  // 1. Permission check
  if (!hasPermission(session.role, "advisers:manage")) {
    return {
      message: "You do not have permission to remove advisers.",
    };
  }

  // 2. Validate input
  const parsed = removeAdviserSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id } = parsed.data;

  // 3. Verify adviser exists
  const [existing] = await db
    .select({
      id: sectionAdvisers.id,
      sectionId: sectionAdvisers.sectionId,
      userId: sectionAdvisers.userId,
    })
    .from(sectionAdvisers)
    .where(and(eq(sectionAdvisers.id, id), isNull(sectionAdvisers.deletedAt)))
    .limit(1);

  if (!existing) {
    return {
      message: "Adviser assignment not found.",
    };
  }

  // 4. Soft delete
  await db
    .update(sectionAdvisers)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
      updatedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(sectionAdvisers.id, id));

  // 5. Audit log
  await logDeleteAction(session, "section_advisers", id, "Adviser removed");

  // 6. Invalidate cache
  invalidateTag(CACHE_TAGS.SECTIONS);

  return {
    success: true,
    message: "Adviser removed successfully.",
  };
}
