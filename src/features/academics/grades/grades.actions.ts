"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { gradeRecords, teacherAssignments, sections } from "@/lib/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  SaveGradesSchema,
  SubmitGradesSchema,
  AssignTeacherSchema,
  type SaveGradesFormState,
  type SubmitGradesFormState,
  type AssignTeacherFormState,
} from "@/lib/validators/academics";
import { logger } from "@/lib/observability/logger";
import { logAudit, logCreateAction } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";

// ─── Save Grades (Draft) ────────────────────────────────────────────────────

export async function saveGradesAction(
  _prevState: SaveGradesFormState,
  formData: FormData
): Promise<SaveGradesFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "grades:encode")) {
    return { message: "You do not have permission to encode grades." };
  }

  // Parse complex formData structure (array of objects)
  const gradesJson = formData.get("grades");
  if (!gradesJson || typeof gradesJson !== "string") {
    return { message: "Invalid grades data." };
  }

  let parsedGrades;
  try {
    parsedGrades = JSON.parse(gradesJson);
  } catch {
    return { message: "Failed to parse grades JSON." };
  }

  const parsed = SaveGradesSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    schoolYearId: formData.get("schoolYearId"),
    grades: parsedGrades,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as SaveGradesFormState["errors"] };
  }

  const { assignmentId, schoolYearId, grades } = parsed.data;

  // SECURITY: Verify teacher owns this assignment (prevents IDOR attacks)
  const assignment = await db.query.teacherAssignments.findFirst({
    where: and(
      eq(teacherAssignments.id, assignmentId),
      isNull(teacherAssignments.deletedAt)
    ),
    columns: { id: true, teacherId: true },
  });

  if (!assignment) {
    return { message: "Assignment not found." };
  }

  // For teachers, verify ownership - admins can encode for any assignment
  if (session.role === "teacher" && assignment.teacherId !== session.userId) {
    logger.warn("[grades] Unauthorized grade save attempt", {
      userId: session.userId,
      assignmentId,
      assignmentOwnerId: assignment.teacherId,
    });
    return { message: "You are not authorized to encode grades for this assignment." };
  }

  try {
    await db.transaction(async (tx) => {
      // Filter out empty entries first
      const validGrades = grades.filter(
        (entry) => entry.grade !== null && entry.grade !== undefined && entry.grade !== ""
      );

      if (validGrades.length === 0) {
        return { success: true, message: "No grades to save." };
      }

      // Bulk fetch all existing records in a single query (eliminates N+1)
      const existingRecords = await tx.query.gradeRecords.findMany({
        where: and(
          eq(gradeRecords.teacherAssignmentId, assignmentId),
          eq(gradeRecords.schoolYearId, schoolYearId)
        ),
      });

      // Build a Map for O(1) lookups: key = "studentId:gradingPeriod"
      const existingMap = new Map(
        existingRecords.map((record) => [
          `${record.studentId}:${record.gradingPeriod}`,
          record,
        ])
      );

      // Check for locked/submitted grades before proceeding
      for (const entry of validGrades) {
        const key = `${entry.studentId}:${entry.gradingPeriod}`;
        const existing = existingMap.get(key);
        if (existing && (existing.status === "submitted" || existing.status === "locked")) {
          throw new Error(
            `Grade for student ${entry.studentId} in ${entry.gradingPeriod} is already ${existing.status}.`
          );
        }
      }

      // Separate records into inserts and updates
      const toInsert: Array<typeof gradeRecords.$inferInsert> = [];
      const toUpdate: Array<{ id: string; grade: string }> = [];

      for (const entry of validGrades) {
        const key = `${entry.studentId}:${entry.gradingPeriod}`;
        const existing = existingMap.get(key);

        if (existing) {
          toUpdate.push({
            id: existing.id,
            grade: String(entry.grade),
          });
        } else {
          toInsert.push({
            studentId: entry.studentId,
            teacherAssignmentId: assignmentId,
            schoolYearId: schoolYearId,
            gradingPeriod: entry.gradingPeriod,
            grade: String(entry.grade),
            status: "draft",
            createdBy: session.userId,
            updatedBy: session.userId,
          });
        }
      }

      // Execute batch operations
      if (toInsert.length > 0) {
        await tx.insert(gradeRecords).values(toInsert);
      }

      if (toUpdate.length > 0) {
        // PERFORMANCE: Batch update using SQL CASE statement (80-90% faster than N+1 loop)
        await tx.execute(sql`
          UPDATE grade_records
          SET
            grade = CASE id
              ${sql.join(
                toUpdate.map(r => sql`WHEN ${r.id} THEN ${r.grade}`),
                sql` `
              )}
            END,
            status = 'draft',
            updated_by = ${session.userId},
            updated_at = NOW()
          WHERE id = ANY(ARRAY[${sql.join(toUpdate.map(r => sql`${r.id}`), sql`, `)}])
        `);
      }

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "grades_saved_draft",
        targetEntity: "teacher_assignments",
        targetId: assignmentId,
        context: `Saved ${grades.length} grades.`,
      }, { throwOnFail: true });
    });

    revalidatePath(`/staff/grades/${assignmentId}`);
    return { success: true, message: "Grades saved successfully." };
  } catch (error: unknown) {
    logger.error("[teacher] Failed to save grades", { error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    return { message: message || "An unexpected error occurred." };
  }
}

// ─── Submit Grades ──────────────────────────────────────────────────────────

export async function submitGradesAction(
  _prevState: SubmitGradesFormState,
  formData: FormData
): Promise<SubmitGradesFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "grades:submit")) {
    return { message: "You do not have permission to submit grades." };
  }

  const result = parseFormData(SubmitGradesSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const parsed = result;

  const { assignmentId, gradingPeriod } = parsed.data;

  // SECURITY: Verify teacher owns this assignment (prevents IDOR attacks)
  const assignment = await db.query.teacherAssignments.findFirst({
    where: and(
      eq(teacherAssignments.id, assignmentId),
      isNull(teacherAssignments.deletedAt)
    ),
    columns: { id: true, teacherId: true },
  });

  if (!assignment) {
    return { message: "Assignment not found." };
  }

  // For teachers, verify ownership - admins can submit for any assignment
  if (session.role === "teacher" && assignment.teacherId !== session.userId) {
    logger.warn("[grades] Unauthorized grade submit attempt", {
      userId: session.userId,
      assignmentId,
      assignmentOwnerId: assignment.teacherId,
    });
    return { message: "You are not authorized to submit grades for this assignment." };
  }

  try {
    await db.transaction(async (tx) => {
      // Find all drafts for this period
      const drafts = await tx.query.gradeRecords.findMany({
        where: and(
          eq(gradeRecords.teacherAssignmentId, assignmentId),
          eq(gradeRecords.gradingPeriod, gradingPeriod),
          eq(gradeRecords.status, "draft")
        ),
      });

      if (drafts.length === 0) {
        throw new Error("No draft grades found to submit.");
      }

      // Update to submitted
      await tx
        .update(gradeRecords)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          submittedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(
          and(
            eq(gradeRecords.teacherAssignmentId, assignmentId),
            eq(gradeRecords.gradingPeriod, gradingPeriod),
            eq(gradeRecords.status, "draft")
          )
        );

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "grades_submitted",
        targetEntity: "teacher_assignments",
        targetId: assignmentId,
        context: `Period: ${gradingPeriod}`,
      }, { throwOnFail: true });
    });

    revalidatePath(`/staff/grades/${assignmentId}`);
    return { success: true, message: "Grades submitted successfully." };
  } catch (error: unknown) {
    logger.error("[teacher] Failed to submit grades", { error: String(error) });
    const message = error instanceof Error ? error.message : String(error);
    return { message: message || "An unexpected error occurred." };
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

    revalidatePath("/staff/academics/assignments");
    return { success: true, message: "Teacher assigned successfully." };
  } catch (error) {
    logger.error("[academics] Failed to assign teacher", { error });
    return { message: "An unexpected error occurred." };
  }
}
