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
 */
export async function validateGradeSheetCompleteness(gradeSheetId: string): Promise<{
  isComplete: boolean;
  message?: string;
  missingCount?: number;
  totalExpected?: number;
}> {
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

  const sectionWithGrade = await db
    .select({
      sectionId: sections.id,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(eq(sections.id, gradeSheet.sectionId))
    .limit(1);

  if (sectionWithGrade.length === 0) {
    return { isComplete: false, message: "Section not found." };
  }

  const section = sectionWithGrade[0];
  const gradeGroup = getGradeGroup(section.gradeLevelName);
  const isSHS = gradeGroup === "shs";

  const studentsList = await getStudentsInSection(
    gradeSheet.sectionId,
    gradeSheet.schoolYearId
  );
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

    const [sseCount] = await db
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
      );

    totalExpected = sseCount?.count ?? 0;
    subjectCount = studentCount > 0 ? Math.round(totalExpected / studentCount) : 0;

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
    }
  } else {
    const subjects = await getSubjectsForGradeLevel(
      section.gradeLevelId,
      gradeSheet.schoolYearId
    );
    subjectCount = subjects.length;
    totalExpected = studentCount * subjectCount;

    if (totalExpected === 0) {
      return {
        isComplete: false,
        message: "No subjects configured for this grade level.",
      };
    }
  }

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
    const subjectInfo = isSHS
      ? `${totalExpected} expected entries based on student subject enrollments`
      : `${studentCount} students × ${subjectCount} subjects`;

    return {
      isComplete: false,
      message: `Cannot submit: ${missingCount} grade${missingCount > 1 ? "s" : ""} missing. All ${totalExpected} entries (${subjectInfo}) must be filled.`,
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
    logger.error("[grades] Failed to save grade entries", { error });
    return { message: "An unexpected error occurred." };
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
    logger.error("[grades] Failed to submit grade sheet", { error });
    return { message: "An unexpected error occurred." };
  }
}
