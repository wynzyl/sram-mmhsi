"use server";

/**
 * Grade Sheet CRUD Actions
 *
 * Actions for creating, saving, and submitting grade sheets.
 * These are the adviser-facing actions for grade entry.
 */

import { db } from "@/lib/db";
import {
  sections,
  gradeSheets,
  gradeSheetEntries,
  gradeApprovals,
  sectionAdvisers,
  gradeLevels,
  enrollments,
  studentSubjectEnrollments,
  subjectOfferings,
} from "@/lib/db/schema";
import { eq, and, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
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
import {
  getGradeRemarks,
  QUARTERLY_PERIODS,
  TRIMESTER_PERIODS,
} from "@/lib/constants/grading-periods";
import { getGradeGroup } from "@/lib/constants/grade-groups";
import { getValidTermsForPeriod } from "@/lib/constants/term-offerings";
import {
  getStudentsInSection,
  getSubjectsForGradeLevel,
} from "./grades.queries";

// ─── Grade Sheet Validation Helpers ──────────────────────────────────────────

/**
 * Check whether a user is the assigned section adviser for a given
 * section + school year.
 */
export async function isAssignedSectionAdviser(
  userId: string,
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  const adviser = await db.query.sectionAdvisers.findFirst({
    where: and(
      eq(sectionAdvisers.sectionId, sectionId),
      eq(sectionAdvisers.schoolYearId, schoolYearId),
      eq(sectionAdvisers.userId, userId),
      isNull(sectionAdvisers.deletedAt)
    ),
    columns: { id: true },
  });
  return Boolean(adviser);
}

/**
 * Validate that previous grading periods have been submitted.
 * Enforces sequential period submission.
 */
export async function validatePreviousPeriodsSubmitted(
  sectionId: string,
  schoolYearId: string,
  currentPeriod: string
): Promise<{ valid: boolean; message?: string }> {
  const periods: readonly string[] = currentPeriod.startsWith("T")
    ? TRIMESTER_PERIODS
    : QUARTERLY_PERIODS;

  const currentIndex = periods.indexOf(currentPeriod);

  if (currentIndex <= 0) {
    return { valid: true };
  }

  const previousPeriods = periods.slice(0, currentIndex);

  const existingSheets = await db
    .select({
      gradingPeriod: gradeSheets.gradingPeriod,
      status: gradeSheets.status,
    })
    .from(gradeSheets)
    .where(
      and(
        eq(gradeSheets.sectionId, sectionId),
        eq(gradeSheets.schoolYearId, schoolYearId)
      )
    );

  const sheetMap = new Map<string, string>(
    existingSheets.map((s) => [s.gradingPeriod, s.status])
  );

  const APPROVED_STATUSES = ["principal_approved", "published", "locked"];
  for (const period of previousPeriods) {
    const status = sheetMap.get(period);
    if (!status || !APPROVED_STATUSES.includes(status)) {
      const periodLabel = period.startsWith("T")
        ? `Trimester ${period.slice(1)}`
        : `Quarter ${period.slice(1)}`;
      return {
        valid: false,
        message: `Cannot submit: ${periodLabel} grades must be approved first. Grades must be completed in order.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Get valid subject IDs for a section.
 */
export async function getValidSubjectIdsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<Set<string>> {
  const validIds = new Set<string>();

  const offeringRows = await db
    .select({ subjectId: subjectOfferings.subjectId })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    );

  for (const row of offeringRows) {
    validIds.add(row.subjectId);
  }

  if (validIds.size === 0) {
    const section = await db.query.sections.findFirst({
      where: eq(sections.id, sectionId),
      columns: { gradeLevelId: true },
    });

    if (section) {
      const subjects = await getSubjectsForGradeLevel(section.gradeLevelId, schoolYearId);
      for (const subject of subjects) {
        validIds.add(subject.id);
      }
    }
  }

  return validIds;
}

/**
 * Validate that all enrolled students have grades for all subjects.
 *
 * Performance: Uses parallel queries via Promise.all to minimize sequential DB round-trips.
 * - Step 1: Fetch grade sheet (required for subsequent queries)
 * - Step 2: Parallel fetch of section info and students
 * - Step 3: For SHS, parallel fetch of enrollments, SSE count, and entered grades count
 * - Step 4: For non-SHS, parallel fetch of subjects and entered grades count
 */
export async function validateGradeSheetCompleteness(gradeSheetId: string): Promise<{
  isComplete: boolean;
  message?: string;
  missingCount?: number;
  totalExpected?: number;
}> {
  // Step 1: Get grade sheet (required first - other queries depend on its values)
  const gradeSheet = await db.query.gradeSheets.findFirst({
    where: eq(gradeSheets.id, gradeSheetId),
    columns: {
      id: true,
      sectionId: true,
      schoolYearId: true,
      gradingPeriod: true,
    },
  });

  if (!gradeSheet) {
    return { isComplete: false, message: "Grade sheet not found." };
  }

  // Step 2: Parallel fetch section info and students
  const [sectionWithGrade, studentsList] = await Promise.all([
    db
      .select({
        sectionId: sections.id,
        gradeLevelId: sections.gradeLevelId,
        gradeLevelName: gradeLevels.name,
      })
      .from(sections)
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .where(eq(sections.id, gradeSheet.sectionId))
      .limit(1),
    getStudentsInSection(gradeSheet.sectionId, gradeSheet.schoolYearId),
  ]);

  if (sectionWithGrade.length === 0) {
    return { isComplete: false, message: "Section not found." };
  }

  const section = sectionWithGrade[0];
  const gradeGroup = getGradeGroup(section.gradeLevelName);
  const isSHS = gradeGroup === "shs";
  const studentCount = studentsList.length;

  if (studentCount === 0) {
    return {
      isComplete: false,
      message: "No students enrolled in this section.",
    };
  }

  let totalExpected: number;
  let subjectCount: number;

  if (isSHS) {
    const studentIds = studentsList.map((s) => s.id);

    // SHS Step 3a: Fetch enrollments first (needed for SSE query)
    const enrollmentRows = await db
      .select({
        studentId: enrollments.studentId,
        enrollmentId: enrollments.id,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.studentId, studentIds),
          eq(enrollments.sectionId, gradeSheet.sectionId),
          eq(enrollments.schoolYearId, gradeSheet.schoolYearId),
          eq(enrollments.status, "enrolled")
        )
      );

    if (enrollmentRows.length === 0) {
      return {
        isComplete: false,
        message: "No active enrollments found for students in this section.",
      };
    }

    const enrollmentIds = enrollmentRows.map((e) => e.enrollmentId);

    const gradingSystemType = gradeSheet.gradingPeriod.startsWith("T")
      ? "trimester"
      : "quarterly";

    const validTerms = getValidTermsForPeriod(
      gradeSheet.gradingPeriod,
      gradingSystemType
    );

    // SHS Step 3b: Parallel fetch SSE count and entered grades count
    const [sseCountResult, enteredCountResult] = await Promise.all([
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(studentSubjectEnrollments)
        .innerJoin(
          subjectOfferings,
          eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
        )
        .where(
          and(
            inArray(studentSubjectEnrollments.enrollmentId, enrollmentIds),
            eq(studentSubjectEnrollments.isActive, true),
            isNull(studentSubjectEnrollments.deletedAt),
            eq(subjectOfferings.sectionId, gradeSheet.sectionId),
            eq(subjectOfferings.schoolYearId, gradeSheet.schoolYearId),
            eq(subjectOfferings.isActive, true),
            isNull(subjectOfferings.deletedAt),
            inArray(subjectOfferings.termOffered, validTerms)
          )
        ),
      db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(gradeSheetEntries)
        .where(
          and(
            eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
            isNotNull(gradeSheetEntries.grade)
          )
        ),
    ]);

    totalExpected = sseCountResult[0]?.count ?? 0;
    subjectCount = studentCount > 0 ? Math.round(totalExpected / studentCount) : 0;

    // Fallback to curriculum-based if no SSE records
    if (totalExpected === 0) {
      const subjects = await getSubjectsForGradeLevel(
        section.gradeLevelId,
        gradeSheet.schoolYearId
      );
      subjectCount = subjects.length;
      totalExpected = studentCount * subjectCount;

      if (totalExpected === 0) {
        return {
          isComplete: false,
          message: "No subjects configured for this grade level or no student subject enrollments found.",
        };
      }

      // Re-query entered count if we had to fallback (rare edge case)
      const [countResult] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(gradeSheetEntries)
        .where(
          and(
            eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
            isNotNull(gradeSheetEntries.grade)
          )
        );

      const totalEntered = countResult?.count ?? 0;
      const missingCount = totalExpected - totalEntered;

      if (missingCount > 0) {
        return {
          isComplete: false,
          message: `Cannot submit: ${missingCount} grade${missingCount > 1 ? "s" : ""} missing. All ${totalExpected} entries (${studentCount} students × ${subjectCount} subjects) must be filled.`,
          missingCount,
          totalExpected,
        };
      }

      return { isComplete: true };
    }

    // Use already-fetched entered count
    const totalEntered = enteredCountResult[0]?.count ?? 0;
    const missingCount = totalExpected - totalEntered;

    if (missingCount > 0) {
      return {
        isComplete: false,
        message: `Cannot submit: ${missingCount} grade${missingCount > 1 ? "s" : ""} missing. All ${totalExpected} entries (${totalExpected} expected entries based on student subject enrollments) must be filled.`,
        missingCount,
        totalExpected,
      };
    }

    return { isComplete: true };
  }

  // Non-SHS path: Parallel fetch subjects and entered grades count
  const [subjectsResult, enteredCountResult] = await Promise.all([
    getSubjectsForGradeLevel(section.gradeLevelId, gradeSheet.schoolYearId),
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(gradeSheetEntries)
      .where(
        and(
          eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
          isNotNull(gradeSheetEntries.grade)
        )
      ),
  ]);

  subjectCount = subjectsResult.length;
  totalExpected = studentCount * subjectCount;

  if (totalExpected === 0) {
    return {
      isComplete: false,
      message: "No subjects configured for this grade level.",
    };
  }

  const totalEntered = enteredCountResult[0]?.count ?? 0;
  const missingCount = totalExpected - totalEntered;

  if (missingCount > 0) {
    return {
      isComplete: false,
      message: `Cannot submit: ${missingCount} grade${missingCount > 1 ? "s" : ""} missing. All ${totalExpected} entries (${studentCount} students × ${subjectCount} subjects) must be filled.`,
      missingCount,
      totalExpected,
    };
  }

  return { isComplete: true };
}

// ─── Grade Sheet CRUD Actions ────────────────────────────────────────────────

/**
 * Create or get a grade sheet for a section/period.
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
  const session = await requireSession();

  if (!hasPermission(session.role, "grades:encode")) {
    return { message: "You do not have permission to encode grades." };
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

  try {
    await db.transaction(async (tx) => {
      for (const entry of entries) {
        if (entry.grade === null || entry.grade === "" || entry.grade === undefined) {
          // Clear grade by setting to null (soft clear, preserves row for audit trail)
          await tx
            .update(gradeSheetEntries)
            .set({
              grade: null,
              remarks: null,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
                eq(gradeSheetEntries.studentId, entry.studentId),
                eq(gradeSheetEntries.subjectId, entry.subjectId)
              )
            );
        } else {
          const numGrade = typeof entry.grade === "number" ? entry.grade : parseFloat(String(entry.grade));
          const validatedRemarks = !isNaN(numGrade) ? getGradeRemarks(numGrade) : entry.remarks;

          await tx
            .insert(gradeSheetEntries)
            .values({
              gradeSheetId,
              studentId: entry.studentId,
              subjectId: entry.subjectId,
              grade: String(entry.grade),
              remarks: validatedRemarks,
            })
            .onConflictDoUpdate({
              target: [
                gradeSheetEntries.gradeSheetId,
                gradeSheetEntries.studentId,
                gradeSheetEntries.subjectId,
              ],
              set: {
                grade: String(entry.grade),
                remarks: validatedRemarks,
                updatedAt: new Date(),
              },
            });
        }
      }

      await tx
        .update(gradeSheets)
        .set({ updatedAt: new Date(), updatedBy: session.userId })
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
