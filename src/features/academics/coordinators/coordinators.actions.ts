"use server";

import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { coordinatorAssignments, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logCreateAction, logDeleteAction } from "@/lib/utils/audit-logger";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  assignCoordinatorSchema,
  removeCoordinatorSchema,
  type AssignCoordinatorFormState,
  type RemoveCoordinatorFormState,
} from "./coordinators.schema";

// ─── Assign Coordinator Action ───────────────────────────────────────────────

/**
 * Assign a coordinator to a grade group for a school year.
 * Only one coordinator per grade group per school year is allowed.
 */
export async function assignCoordinatorAction(
  _prevState: AssignCoordinatorFormState,
  formData: FormData
): Promise<AssignCoordinatorFormState> {
  const session = await requireSession();

  // Only admin/super_admin can manage coordinator assignments
  if (!hasPermission(session.role, "assignments:manage")) {
    return {
      message: "You do not have permission to assign coordinators.",
    };
  }

  const parsed = assignCoordinatorSchema.safeParse({
    userId: formData.get("userId"),
    gradeGroup: formData.get("gradeGroup"),
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { userId, gradeGroup, schoolYearId } = parsed.data;

  // Validate user exists and has coordinator role
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

  if (user.role !== "coordinator") {
    return {
      message: "Only users with coordinator role can be assigned as coordinators.",
    };
  }

  // Check if grade group already has a coordinator
  const [existingAssignment] = await db
    .select({ id: coordinatorAssignments.id })
    .from(coordinatorAssignments)
    .where(
      and(
        eq(coordinatorAssignments.gradeGroup, gradeGroup),
        eq(coordinatorAssignments.schoolYearId, schoolYearId),
        isNull(coordinatorAssignments.deletedAt)
      )
    )
    .limit(1);

  if (existingAssignment) {
    return {
      message: "This grade group already has a coordinator assigned. Remove the existing coordinator first.",
    };
  }

  // Create coordinator assignment
  const [coordinator] = await db
    .insert(coordinatorAssignments)
    .values({
      userId,
      gradeGroup,
      schoolYearId,
      createdBy: session.userId,
    })
    .returning();

  await logCreateAction(session, "coordinator_assignments", coordinator.id, {
    userId,
    gradeGroup,
    schoolYearId,
  });

  invalidateTag(CACHE_TAGS.SECTIONS);

  return {
    success: true,
    message: "Coordinator assigned successfully.",
    coordinatorId: coordinator.id,
  };
}

// ─── Remove Coordinator Action ───────────────────────────────────────────────

/**
 * Remove a coordinator assignment (soft delete).
 */
export async function removeCoordinatorAction(
  _prevState: RemoveCoordinatorFormState,
  formData: FormData
): Promise<RemoveCoordinatorFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "assignments:manage")) {
    return {
      message: "You do not have permission to remove coordinators.",
    };
  }

  const parsed = removeCoordinatorSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { id } = parsed.data;

  // Verify assignment exists
  const [existing] = await db
    .select({
      id: coordinatorAssignments.id,
      userId: coordinatorAssignments.userId,
      gradeGroup: coordinatorAssignments.gradeGroup,
    })
    .from(coordinatorAssignments)
    .where(and(eq(coordinatorAssignments.id, id), isNull(coordinatorAssignments.deletedAt)))
    .limit(1);

  if (!existing) {
    return {
      message: "Coordinator assignment not found.",
    };
  }

  // Soft delete
  await db
    .update(coordinatorAssignments)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(eq(coordinatorAssignments.id, id));

  await logDeleteAction(session, "coordinator_assignments", id, "Coordinator removed");

  invalidateTag(CACHE_TAGS.SECTIONS);

  return {
    success: true,
    message: "Coordinator removed successfully.",
  };
}
