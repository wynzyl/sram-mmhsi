"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { teacherAssignments } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { z } from "zod";
import { logger } from "@/lib/observability/logger";
import { logAudit } from "@/lib/utils/audit-logger";
import type { BaseFormState } from "@/lib/validators/common-schemas";

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
