"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  gradeRecords,
  teacherAssignments,
  sections,
  gradeSheets,
  gradeSheetEntries,
  gradeApprovals,
  sectionAdvisers,
} from "@/lib/db/schema";
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
import {
  CreateGradeSheetSchema,
  SaveGradeSheetEntriesSchema,
  SubmitGradeSheetSchema,
  ReturnGradeSheetSchema,
  ApproveGradeSheetSchema,
  PublishGradeSheetSchema,
  LockGradeSheetSchema,
  UnlockGradeSheetSchema,
  type CreateGradeSheetFormState,
  type SaveGradeSheetEntriesFormState,
  type SubmitGradeSheetFormState,
  type ReturnGradeSheetFormState,
  type ApproveGradeSheetFormState,
  type PublishGradeSheetFormState,
  type LockGradeSheetFormState,
  type UnlockGradeSheetFormState,
} from "./grades.schema";
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

// ─── Grade Sheet Workflow Actions (NEW) ──────────────────────────────────────

/**
 * Create or get a grade sheet for a section/period.
 * Advisers call this when starting grade entry.
 */
export async function createOrGetGradeSheetAction(
  _prevState: CreateGradeSheetFormState,
  formData: FormData
): Promise<CreateGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:encode")) {
    return { message: "You do not have permission to create grade sheets." };
  }

  const parsed = CreateGradeSheetSchema.safeParse({
    sectionId: formData.get("sectionId"),
    schoolYearId: formData.get("schoolYearId"),
    gradingPeriod: formData.get("gradingPeriod"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { sectionId, schoolYearId, gradingPeriod } = parsed.data;

  // Verify user is the adviser for this section (unless admin)
  if (session.role === "teacher") {
    const adviser = await db.query.sectionAdvisers.findFirst({
      where: and(
        eq(sectionAdvisers.sectionId, sectionId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        eq(sectionAdvisers.userId, session.userId),
        isNull(sectionAdvisers.deletedAt)
      ),
    });

    if (!adviser) {
      return { message: "You are not the adviser for this section." };
    }
  }

  try {
    // Check if grade sheet already exists
    const existingSheet = await db.query.gradeSheets.findFirst({
      where: and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId),
        eq(gradeSheets.gradingPeriod, gradingPeriod)
      ),
    });

    if (existingSheet) {
      return { success: true, gradeSheetId: existingSheet.id };
    }

    // Create new grade sheet
    const [newSheet] = await db
      .insert(gradeSheets)
      .values({
        sectionId,
        schoolYearId,
        adviserId: session.userId,
        gradingPeriod,
        status: "draft",
        createdBy: session.userId,
      })
      .returning();

    await logCreateAction(session, "grade_sheets", newSheet.id, {
      sectionId,
      schoolYearId,
      gradingPeriod,
    });

    return { success: true, gradeSheetId: newSheet.id };
  } catch (error) {
    logger.error("[grades] Failed to create grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Save grade entries to a grade sheet.
 */
export async function saveGradeSheetEntriesAction(
  _prevState: SaveGradeSheetEntriesFormState,
  formData: FormData
): Promise<SaveGradeSheetEntriesFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:encode")) {
    return { message: "You do not have permission to encode grades." };
  }

  // Parse entries from JSON
  const entriesJson = formData.get("entries");
  if (!entriesJson || typeof entriesJson !== "string") {
    return { message: "Invalid entries data." };
  }

  let parsedEntries;
  try {
    parsedEntries = JSON.parse(entriesJson);
  } catch {
    return { message: "Failed to parse entries JSON." };
  }

  const parsed = SaveGradeSheetEntriesSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
    entries: parsedEntries,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId, entries } = parsed.data;

  // Verify grade sheet exists and is in draft/returned status
  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (!["draft", "returned"].includes(gradeSheet.status)) {
    return { message: "Cannot edit grades - sheet is not in draft or returned status." };
  }

  // Verify user is the adviser (unless admin)
  if (session.role === "teacher" && gradeSheet.adviserId !== session.userId) {
    return { message: "You are not authorized to edit this grade sheet." };
  }

  try {
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        if (entry.grade === null || entry.grade === "" || entry.grade === undefined) {
          // Delete entry if grade is empty
          await tx
            .delete(gradeSheetEntries)
            .where(
              and(
                eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
                eq(gradeSheetEntries.studentId, entry.studentId),
                eq(gradeSheetEntries.subjectId, entry.subjectId)
              )
            );
        } else {
          // Upsert entry
          await tx
            .insert(gradeSheetEntries)
            .values({
              gradeSheetId,
              studentId: entry.studentId,
              subjectId: entry.subjectId,
              grade: String(entry.grade),
              remarks: entry.remarks,
            })
            .onConflictDoUpdate({
              target: [
                gradeSheetEntries.gradeSheetId,
                gradeSheetEntries.studentId,
                gradeSheetEntries.subjectId,
              ],
              set: {
                grade: String(entry.grade),
                remarks: entry.remarks,
                updatedAt: new Date(),
              },
            });
        }
      }

      // Update grade sheet timestamp
      await tx
        .update(gradeSheets)
        .set({ updatedAt: new Date(), updatedBy: session.userId })
        .where(eq(gradeSheets.id, gradeSheetId));
    });

    return { success: true, message: "Grades saved successfully." };
  } catch (error) {
    logger.error("[grades] Failed to save grade entries", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Submit grade sheet for coordinator review.
 */
export async function submitGradeSheetAction(
  _prevState: SubmitGradeSheetFormState,
  formData: FormData
): Promise<SubmitGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:submit")) {
    return { message: "You do not have permission to submit grades." };
  }

  const parsed = SubmitGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (!["draft", "returned"].includes(gradeSheet.status)) {
    return { message: "Cannot submit - sheet is not in draft or returned status." };
  }

  // Verify user is the adviser (unless admin)
  if (session.role === "teacher" && gradeSheet.adviserId !== session.userId) {
    return { message: "You are not authorized to submit this grade sheet." };
  }

  // TODO: Validate all students × subjects have entries before submission
  // For now, allow submission without validation

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "submitted",
          submittedAt: new Date(),
          submittedBy: session.userId,
          returnedAt: null,
          returnedBy: null,
          returnRemarks: null,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "submit",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grade sheet submitted for review." };
  } catch (error) {
    logger.error("[grades] Failed to submit grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Principal returns grade sheet with remarks.
 */
export async function principalReturnAction(
  _prevState: ReturnGradeSheetFormState,
  formData: FormData
): Promise<ReturnGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:principal_review")) {
    return { message: "You do not have permission to review grades." };
  }

  const parsed = ReturnGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
    remarks: formData.get("remarks"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId, remarks } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "submitted") {
    return { message: "Cannot return - sheet is not in submitted status." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "returned",
          returnedAt: new Date(),
          returnedBy: session.userId,
          returnRemarks: remarks,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "principal_return",
        remarks,
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grade sheet returned to adviser." };
  } catch (error) {
    logger.error("[grades] Failed to return grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Principal approves grade sheet.
 */
export async function principalApproveAction(
  _prevState: ApproveGradeSheetFormState,
  formData: FormData
): Promise<ApproveGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:principal_review")) {
    return { message: "You do not have permission to approve grades." };
  }

  const parsed = ApproveGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "submitted") {
    return { message: "Cannot approve - sheet is not in submitted status." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "principal_approved",
          principalApprovedAt: new Date(),
          principalApprovedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "principal_approve",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grade sheet approved by principal." };
  } catch (error) {
    logger.error("[grades] Failed to approve grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Publish grades to student portal.
 */
export async function publishGradesAction(
  _prevState: PublishGradeSheetFormState,
  formData: FormData
): Promise<PublishGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:publish")) {
    return { message: "You do not have permission to publish grades." };
  }

  const parsed = PublishGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "principal_approved") {
    return { message: "Cannot publish - sheet is not in principal_approved status." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "publish",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grades published to student portal." };
  } catch (error) {
    logger.error("[grades] Failed to publish grades", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Lock grades (immutable).
 */
export async function lockGradesAction(
  _prevState: LockGradeSheetFormState,
  formData: FormData
): Promise<LockGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:lock")) {
    return { message: "You do not have permission to lock grades." };
  }

  const parsed = LockGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "published") {
    return { message: "Cannot lock - sheet is not in published status." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "locked",
          lockedAt: new Date(),
          lockedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "lock",
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grades locked." };
  } catch (error) {
    logger.error("[grades] Failed to lock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}

/**
 * Unlock grades (admin only, requires reason).
 */
export async function unlockGradesAction(
  _prevState: UnlockGradeSheetFormState,
  formData: FormData
): Promise<UnlockGradeSheetFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:unlock")) {
    return { message: "You do not have permission to unlock grades." };
  }

  const parsed = UnlockGradeSheetSchema.safeParse({
    gradeSheetId: formData.get("gradeSheetId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { gradeSheetId, reason } = parsed.data;

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (gradeSheet.status !== "locked") {
    return { message: "Cannot unlock - sheet is not in locked status." };
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(gradeSheets)
        .set({
          status: "draft",
          lockedAt: null,
          lockedBy: null,
          publishedAt: null,
          publishedBy: null,
          principalApprovedAt: null,
          principalApprovedBy: null,
          coordinatorApprovedAt: null,
          coordinatorApprovedBy: null,
          submittedAt: null,
          submittedBy: null,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(gradeSheets.id, gradeSheetId));

      await tx.insert(gradeApprovals).values({
        gradeSheetId,
        action: "unlock",
        remarks: reason,
        actorId: session.userId,
        actorRole: session.role,
      });
    });

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "grades:unlock",
      targetEntity: "grade_sheets",
      targetId: gradeSheetId,
      newState: { reason },
    });

    revalidatePath("/staff/grades");
    return { success: true, message: "Grades unlocked for editing." };
  } catch (error) {
    logger.error("[grades] Failed to unlock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}
