"use server";

/**
 * Grade Sheet CRUD Actions
 *
 * Actions for creating, saving, and submitting grade sheets.
 * These are the adviser-facing actions for grade entry.
 */

import { db } from "@/lib/db";
import {
  gradeSheets,
  gradeSheetEntries,
  gradeApprovals,
  sectionAdvisers,
} from "@/lib/db/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  CreateGradeSheetSchema,
  SaveGradeSheetEntriesSchema,
  SubmitGradeSheetSchema,
  type CreateGradeSheetFormState,
  type SaveGradeSheetEntriesFormState,
  type SubmitGradeSheetFormState,
} from "./grades.schema";
import { logger } from "@/lib/observability/logger";
import { logCreateAction } from "@/lib/utils/audit-logger";
import {
  isUniqueViolationError,
  isForeignKeyViolationError,
} from "@/lib/utils/pg-error";

// ─── Error Handling Helpers ─────────────────────────────────────────────────

/**
 * Get a user-friendly error message for common PostgreSQL errors.
 * Uses pg-error utilities to check error codes without relying on PostgresError type.
 *
 * @param error - The caught error
 * @param context - Context for the error message (e.g., "grade sheet", "grade entry")
 * @returns User-friendly message or null if not a recognized PostgreSQL error
 */
function getPostgresErrorMessage(error: unknown, context: string): string | null {
  if (isUniqueViolationError(error)) {
    return `This ${context} has already been processed. Please refresh and try again.`;
  }
  if (isForeignKeyViolationError(error)) {
    return `Invalid reference: the ${context} references data that no longer exists.`;
  }
  return null;
}
import { getGradeRemarks } from "@/lib/constants/grading-periods";
// Validation helpers live in a non-"use server" module: exporting them from
// this file would publish each one as its own callable server-action endpoint,
// and none of them performs a session/permission check of its own.
import {
  isAssignedSectionAdviser,
  validatePreviousPeriodsSubmitted,
  getValidSubjectIdsForSection,
  validateGradeSheetCompleteness,
} from "./grade-sheet-validation";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

// ─── Grade Sheet CRUD Actions ────────────────────────────────────────────────

/**
 * Create or get a grade sheet for a section/period.
 */
export async function createOrGetGradeSheetAction(
  _prevState: CreateGradeSheetFormState,
  formData: FormData
): Promise<CreateGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:encode")) {
    return { message: PERMISSION_ERRORS.GRADES_CREATE_SHEET };
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
    logger.error("[grades] Failed to create grade sheet", {
      error,
      sectionId,
      schoolYearId,
      gradingPeriod,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade sheet");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to create grade sheet. Please try again or contact support." };
  }
}

/**
 * Save grade entries to a grade sheet.
 */
export async function saveGradeSheetEntriesAction(
  _prevState: SaveGradeSheetEntriesFormState,
  formData: FormData
): Promise<SaveGradeSheetEntriesFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:encode")) {
    return { message: PERMISSION_ERRORS.GRADES_ENCODE };
  }

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

  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
  });

  if (!gradeSheet) {
    return { message: "Grade sheet not found." };
  }

  if (!["draft", "returned"].includes(gradeSheet.status)) {
    return { message: "Cannot edit grades - sheet is not in draft or returned status." };
  }

  if (
    session.role === "teacher" &&
    !(await isAssignedSectionAdviser(
      session.userId,
      gradeSheet.sectionId,
      gradeSheet.schoolYearId
    ))
  ) {
    return { message: "You are not authorized to edit this grade sheet." };
  }

  const entrySubjectIds = [...new Set(entries.map((e) => e.subjectId))];
  if (entrySubjectIds.length > 0) {
    const validSubjectIds = await getValidSubjectIdsForSection(
      gradeSheet.sectionId,
      gradeSheet.schoolYearId
    );

    const invalidSubjects = entrySubjectIds.filter((id) => !validSubjectIds.has(id));
    if (invalidSubjects.length > 0) {
      logger.warn("[grades] Attempted to save grades for invalid subjects", {
        gradeSheetId,
        invalidSubjects,
        userId: session.userId,
      });
      return {
        message: "Some subjects are not valid for this section. Grade entry rejected.",
      };
    }
  }

  // Collapse to one write per cell, last occurrence winning — the same result
  // the previous per-entry loop produced. This is load-bearing, not tidiness:
  // the payload is not deduplicated by the schema, and a multi-row
  // INSERT ... ON CONFLICT DO UPDATE aborts if two rows hit the same conflict
  // target ("cannot affect row a second time").
  const latestByCell = new Map<string, (typeof entries)[number]>();
  for (const entry of entries) {
    latestByCell.set(`${entry.studentId}:${entry.subjectId}`, entry);
  }

  const gradedValues: (typeof gradeSheetEntries.$inferInsert)[] = [];
  const clearedCells: { studentId: string; subjectId: string }[] = [];

  for (const entry of latestByCell.values()) {
    if (entry.grade === null || entry.grade === "" || entry.grade === undefined) {
      clearedCells.push({ studentId: entry.studentId, subjectId: entry.subjectId });
      continue;
    }

    const numGrade = typeof entry.grade === "number" ? entry.grade : parseFloat(String(entry.grade));
    const validatedRemarks = !isNaN(numGrade) ? getGradeRemarks(numGrade) : entry.remarks;

    gradedValues.push({
      gradeSheetId,
      studentId: entry.studentId,
      subjectId: entry.subjectId,
      grade: String(entry.grade),
      remarks: validatedRemarks ?? null,
    });
  }

  // One timestamp for the whole save — every statement below is in one
  // transaction, so they shared an effectively identical `new Date()` before.
  const savedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      if (gradedValues.length > 0) {
        await tx
          .insert(gradeSheetEntries)
          .values(gradedValues)
          .onConflictDoUpdate({
            target: [
              gradeSheetEntries.gradeSheetId,
              gradeSheetEntries.studentId,
              gradeSheetEntries.subjectId,
            ],
            // `excluded` is the row this statement proposed, so a single
            // statement still applies each cell's own grade and remarks.
            set: {
              grade: sql`excluded.grade`,
              remarks: sql`excluded.remarks`,
              updatedAt: savedAt,
            },
          });
      }

      if (clearedCells.length > 0) {
        // Clear grades by setting to null (soft clear, preserves rows for the
        // audit trail). Matched as explicit (student, subject) pairs — filtering
        // by two separate IN lists would form a cross-product and wipe cells the
        // adviser never touched.
        await tx
          .update(gradeSheetEntries)
          .set({
            grade: null,
            remarks: null,
            updatedAt: savedAt,
          })
          .where(
            and(
              eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
              or(
                ...clearedCells.map((cell) =>
                  and(
                    eq(gradeSheetEntries.studentId, cell.studentId),
                    eq(gradeSheetEntries.subjectId, cell.subjectId)
                  )
                )
              )
            )
          );
      }

      await tx
        .update(gradeSheets)
        .set({ updatedAt: savedAt, updatedBy: session.userId })
        .where(eq(gradeSheets.id, gradeSheetId));
    });

    return { success: true, message: "Grades saved successfully." };
  } catch (error) {
    logger.error("[grades] Failed to save grade entries", {
      error,
      gradeSheetId,
      entryCount: entries.length,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade entry");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to save grades. Please try again or contact support." };
  }
}

/**
 * Submit grade sheet for principal review.
 */
export async function submitGradeSheetAction(
  _prevState: SubmitGradeSheetFormState,
  formData: FormData
): Promise<SubmitGradeSheetFormState> {
  const session = await requireStaffSession();

  if (!hasPermission(session.role, "grades:submit")) {
    return { message: PERMISSION_ERRORS.GRADES_SUBMIT };
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

  if (
    session.role === "teacher" &&
    !(await isAssignedSectionAdviser(
      session.userId,
      gradeSheet.sectionId,
      gradeSheet.schoolYearId
    ))
  ) {
    return { message: "You are not authorized to submit this grade sheet." };
  }

  const periodValidation = await validatePreviousPeriodsSubmitted(
    gradeSheet.sectionId,
    gradeSheet.schoolYearId,
    gradeSheet.gradingPeriod
  );
  if (!periodValidation.valid) {
    return { message: periodValidation.message };
  }

  const validationResult = await validateGradeSheetCompleteness(gradeSheetId);
  if (!validationResult.isComplete) {
    return {
      message: validationResult.message,
      missingCount: validationResult.missingCount,
      totalExpected: validationResult.totalExpected,
    };
  }

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

    return { success: true, message: "Grade sheet submitted for review." };
  } catch (error) {
    logger.error("[grades] Failed to submit grade sheet", {
      error,
      gradeSheetId,
      userId: session.userId,
    });

    const pgMessage = getPostgresErrorMessage(error, "grade sheet submission");
    if (pgMessage) {
      return { message: pgMessage };
    }

    return { message: "Failed to submit grade sheet. Please try again or contact support." };
  }
}
