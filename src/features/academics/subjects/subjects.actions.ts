"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { teacherAssignments, gradeRecords, subjects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logDeleteAction, logAudit } from "@/lib/utils/audit-logger";
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

  const parsed = CreateSubjectSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    gradeLevelId: formData.get("gradeLevelId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;

  // Check duplicate code
  const existing = await db.query.subjects.findFirst({
    where: and(eq(subjects.code, data.code), isNull(subjects.deletedAt)),
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
        name: data.name,
        code: data.code,
        curriculumId: fallbackCurriculum.id,
        gradeLevelId: data.gradeLevelId,
        createdBy: session.userId,
      })
      .returning({ id: subjects.id });

    await logCreateAction(session, "subjects", newSubject.id, data);

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

  const parsed = DeleteSubjectSchema.safeParse({
    subjectId: formData.get("subjectId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await db
      .update(subjects)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(subjects.id, parsed.data.subjectId));

    await logDeleteAction(session, "subjects", parsed.data.subjectId, "Soft delete");

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

  const parsed = AssignTeacherSchema.safeParse({
    teacherId: formData.get("teacherId"),
    subjectId: formData.get("subjectId"),
    sectionId: formData.get("sectionId"),
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

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

    await logCreateAction(session, "teacher_assignments", newAssignment.id, data);

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

  const parsed = RemoveAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await db
      .update(teacherAssignments)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
      })
      .where(eq(teacherAssignments.id, parsed.data.assignmentId));

    await logDeleteAction(session, "teacher_assignments", parsed.data.assignmentId, "Soft delete");

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

  const parsed = LockGradesSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    gradingPeriod: formData.get("gradingPeriod"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

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
