"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { teacherAssignments, gradeRecords, subjects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logDeleteAction, logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  AssignTeacherSchema,
  RemoveAssignmentSchema,
  CreateSubjectSchema,
  DeleteSubjectSchema,
  type AssignTeacherFormState,
  type RemoveAssignmentFormState,
  type CreateSubjectFormState,
  type DeleteSubjectFormState,
} from "./subjects.schema";
import {
  LockGradesSchema,
  type LockGradesFormState,
} from "../grades/grades.schema";
import { logger } from "@/lib/observability/logger";

// ─── Subject Management ─────────────────────────────────────────────────────

export async function createSubjectAction(
  _prevState: CreateSubjectFormState,
  formData: FormData
): Promise<CreateSubjectFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "sections:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(CreateSubjectSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { name, code, gradeLevelId } = result.data;

  // Check duplicate code
  const existing = await db.query.subjects.findFirst({
    where: and(eq(subjects.code, code), isNull(subjects.deletedAt)),
  });

  if (existing) {
    return { errors: { code: ["Subject code already exists."] } };
  }

  const fallbackCurriculum = await db.query.curriculums.findFirst({
    columns: { id: true },
  });
  if (!fallbackCurriculum) {
    return { message: "No curriculum configured. Create a curriculum before adding subjects." };
  }

  try {
    const [newSubject] = await db
      .insert(subjects)
      .values({
        name,
        code,
        curriculumId: fallbackCurriculum.id,
        gradeLevelId,
        createdBy: session.userId,
      })
      .returning({ id: subjects.id });

    await logCreateAction(session, "subjects", newSubject.id, { name, code, gradeLevelId }, { throwOnFail: true });

    revalidatePath("/staff/academics/subjects");
    return { success: true, message: "Subject created successfully." };
  } catch (error) {
    logger.error("[academics] Failed to create subject", { error });
    return { message: "An unexpected error occurred." };
  }
}

export async function deleteSubjectAction(
  _prevState: DeleteSubjectFormState,
  formData: FormData
): Promise<DeleteSubjectFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "sections:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(DeleteSubjectSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  try {
    await db
      .update(subjects)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(subjects.id, parsed.data.subjectId));

    await logDeleteAction(session, "subjects", parsed.data.subjectId, "Soft delete", { throwOnFail: true });

    revalidatePath("/staff/academics/subjects");
    return { success: true, message: "Subject deleted successfully." };
  } catch (error) {
    logger.error("[academics] Failed to delete subject", { error });
    return { message: "Failed to delete subject. It might be assigned to a teacher." };
  }
}

// ─── Assign Teacher ─────────────────────────────────────────────────────────

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

  const parsed = result;

  const data = parsed.data;

  // Check duplicate
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

  try {
    const [newAssignment] = await db
      .insert(teacherAssignments)
      .values({
        teacherId: data.teacherId,
        subjectId: data.subjectId,
        sectionId: data.sectionId,
        schoolYearId: data.schoolYearId,
        createdBy: session.userId,
      })
      .returning({ id: teacherAssignments.id });

    await logCreateAction(session, "teacher_assignments", newAssignment.id, data, { throwOnFail: true });

    revalidatePath("/staff/academics/assignments");
    return { success: true, message: "Teacher assigned successfully." };
  } catch (error) {
    logger.error("[academics] Failed to assign teacher", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Remove Assignment ──────────────────────────────────────────────────────

export async function removeAssignmentAction(
  _prevState: RemoveAssignmentFormState,
  formData: FormData
): Promise<RemoveAssignmentFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "assignments:manage")) {
    return { message: "You do not have permission to remove teacher assignments." };
  }

  const result = parseFormData(RemoveAssignmentSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  try {
    await db
      .update(teacherAssignments)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(teacherAssignments.id, parsed.data.assignmentId));

    await logDeleteAction(session, "teacher_assignments", parsed.data.assignmentId, "Soft delete", { throwOnFail: true });

    revalidatePath("/staff/academics/assignments");
    return { success: true, message: "Assignment removed." };
  } catch (error) {
    logger.error("[academics] Failed to remove assignment", { error });
    return { message: "Failed to remove assignment. It might be linked to existing grades." };
  }
}

// ─── Lock Grades ────────────────────────────────────────────────────────────

export async function lockGradesAction(
  _prevState: LockGradesFormState,
  formData: FormData
): Promise<LockGradesFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "grades:lock")) {
    return { message: "You do not have permission to lock grades." };
  }

  const result = parseFormData(LockGradesSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { assignmentId, gradingPeriod } = parsed.data;

  try {
    await db
      .update(gradeRecords)
      .set({
        status: "locked",
        lockedAt: new Date(),
        lockedBy: session.userId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(
        and(
          eq(gradeRecords.teacherAssignmentId, assignmentId),
          eq(gradeRecords.gradingPeriod, gradingPeriod)
        )
      );

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grade_records:lock",
      targetEntity: "grade_records",
      targetId: assignmentId,
      context: `Assignment: ${assignmentId}, Period: ${gradingPeriod}`,
    }, { throwOnFail: true });

    revalidatePath(`/staff/academics/assignments/${assignmentId}`);
    return { success: true, message: "Grades locked successfully." };
  } catch (error) {
    logger.error("[academics] Failed to lock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}
