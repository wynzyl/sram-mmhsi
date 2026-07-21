"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { teacherAssignments, sections } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { logAudit, logCreateAction } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import { AssignTeacherSchema, type AssignTeacherFormState } from "@/lib/validators/academics";

// ─── Assign Teacher ─────────────────────────────────────────────────────────

/**
 * Assign a teacher to a subject/section combination for a school year.
 * Consolidated here from grades.actions.ts for consistent architecture.
 */
export async function assignTeacherAction(
  _prevState: AssignTeacherFormState,
  formData: FormData
): Promise<AssignTeacherFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "assignments:manage")) {
    return { message: "You do not have permission to manage teacher assignments." };
  }

  const result = parseFormData(AssignTeacherSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const data = result.data;

  // Validate the target section: it must exist, be active, and belong to the
  // same school year as the assignment (an FK alone can't enforce that).
  const section = await db.query.sections.findFirst({
    where: and(eq(sections.id, data.sectionId), isNull(sections.deletedAt)),
    columns: { id: true, schoolYearId: true },
  });

  if (!section) {
    return { errors: { _form: ["The selected section no longer exists."] } };
  }

  if (section.schoolYearId !== data.schoolYearId) {
    return {
      errors: {
        _form: ["The selected section belongs to a different school year."],
      },
    };
  }

  try {
    // Check duplicate (kept inside the try so DB failures route through the
    // structured error handler below).
    const existing = await db.query.teacherAssignments.findFirst({
      where: and(
        eq(teacherAssignments.teacherId, data.teacherId),
        eq(teacherAssignments.subjectId, data.subjectId),
        eq(teacherAssignments.sectionId, data.sectionId),
        eq(teacherAssignments.schoolYearId, data.schoolYearId),
        isNull(teacherAssignments.deletedAt)
      ),
    });

    if (existing) {
      return { errors: { _form: ["This assignment already exists."] } };
    }

    // Insert + audit are atomic: if the audit write fails, the assignment insert
    // is rolled back so a retry can't report a spurious "already exists".
    await db.transaction(async (tx) => {
      const [newAssignment] = await tx
        .insert(teacherAssignments)
        .values({
          teacherId: data.teacherId,
          subjectId: data.subjectId,
          sectionId: data.sectionId,
          schoolYearId: data.schoolYearId,
          createdBy: session.userId,
        })
        .returning({ id: teacherAssignments.id });

      await logCreateAction(session, "teacher_assignments", newAssignment.id, data, {
        throwOnFail: true,
      });
    });

    revalidatePath("/staff/academics/teacher-assignments");
    return { success: true, message: "Teacher assigned successfully." };
  } catch (error) {
    logger.error("[teacher-assignments] Failed to assign teacher", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Remove Teacher Assignment ──────────────────────────────────────────────

const RemoveTeacherAssignmentSchema = z.object({
  id: z.string().uuid("Invalid assignment ID"),
});

export type RemoveTeacherAssignmentFormState = BaseFormState<
  z.infer<typeof RemoveTeacherAssignmentSchema>
>;

export async function removeTeacherAssignmentAction(
  _prevState: RemoveTeacherAssignmentFormState,
  formData: FormData
): Promise<RemoveTeacherAssignmentFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "assignments:manage")) {
    return { message: "You do not have permission to manage teacher assignments." };
  }

  const parsed = RemoveTeacherAssignmentSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id } = parsed.data;

  try {
    // Verify assignment exists
    const assignment = await db.query.teacherAssignments.findFirst({
      where: and(
        eq(teacherAssignments.id, id),
        isNull(teacherAssignments.deletedAt)
      ),
    });

    if (!assignment) {
      return { message: "Assignment not found." };
    }

    // Soft delete the assignment
    await db
      .update(teacherAssignments)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(teacherAssignments.id, id));

    // Audit log
    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "assignments:delete",
      targetEntity: "teacher_assignments",
      targetId: id,
      previousState: {
        teacherId: assignment.teacherId,
        subjectId: assignment.subjectId,
        sectionId: assignment.sectionId,
        schoolYearId: assignment.schoolYearId,
      },
    });

    revalidatePath("/staff/academics/teacher-assignments");
    return { success: true, message: "Teacher assignment removed successfully." };
  } catch (error) {
    logger.error("[teacher-assignments] Failed to remove assignment", { error });
    return { message: "An unexpected error occurred." };
  }
}
