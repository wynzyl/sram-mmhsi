"use server";

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
 *
 * Grade-sheet edit/submit authorization must be based on the live
 * `sectionAdvisers` relationship — NOT `gradeSheets.adviserId`, which only stores
 * whoever *created* the sheet. An admin may create a sheet on the adviser's behalf,
 * and the assigned teacher must still be able to edit and submit it.
 */
async function isAssignedSectionAdviser(
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
 * Enforces sequential period submission to prevent bypassing UI-level locking.
 *
 * Period order: Q1 → Q2 → Q3 → Q4 (or T1 → T2 → T3 for trimester)
 */
async function validatePreviousPeriodsSubmitted(
  sectionId: string,
  schoolYearId: string,
  currentPeriod: string
): Promise<{ valid: boolean; message?: string }> {
  // Determine which period system is in use
  const periods: readonly string[] = currentPeriod.startsWith("T")
    ? TRIMESTER_PERIODS
    : QUARTERLY_PERIODS;

  const currentIndex = periods.indexOf(currentPeriod);

  // First period doesn't need any previous periods completed
  if (currentIndex <= 0) {
    return { valid: true };
  }

  // Check that all previous periods have submitted grade sheets
  const previousPeriods = periods.slice(0, currentIndex);

  // Query all grade sheets for this section/year
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

  // Create a map keyed by string for flexible lookup
  const sheetMap = new Map<string, string>(
    existingSheets.map((s) => [s.gradingPeriod, s.status])
  );

  // A period only unlocks the next once it is fully approved. Merely "submitted"
  // (awaiting principal review), "returned", "draft", or missing is not enough —
  // this matches the UI's sequential-locking rule and the documented business rule
  // ("Q2 cannot be submitted until Q1 is approved").
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
 * Checks both subject offerings (if present) and curriculum adoption subjects.
 * Used to validate grade entries before saving.
 */
async function getValidSubjectIdsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<Set<string>> {
  const validIds = new Set<string>();

  // First, check subjectOfferings (preferred for sections with offerings configured)
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

  // If no offerings found, fall back to curriculum adoption subjects
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
 * Called before submitting a grade sheet for review.
 *
 * For SHS (Senior High School):
 * - Uses studentSubjectEnrollments to determine expected entries per student
 * - Each student only takes subjects applicable to their strand
 *
 * For non-SHS:
 * - Uses flat calculation: students × subjects from curriculum adoption
 */
async function validateGradeSheetCompleteness(gradeSheetId: string): Promise<{
  isComplete: boolean;
  message?: string;
  missingCount?: number;
  totalExpected?: number;
}> {
  // Get grade sheet with section info and grading period
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

  // Get section with grade level name for group detection
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

  // Get enrolled students
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
    // SHS: Use studentSubjectEnrollments for per-student subject count
    // This handles strand-specific subjects correctly
    const studentIds = studentsList.map((s) => s.id);

    // Get enrollment IDs for students in this section
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

    // Determine grading system type from period (T* = trimester, Q* = quarterly)
    const gradingSystemType = gradeSheet.gradingPeriod.startsWith("T")
      ? "trimester"
      : "quarterly";

    // Get valid term_offered values for this grading period
    // E.g., for T2 (2nd trimester): ["full_year", "second_trimester"]
    const validTerms = getValidTermsForPeriod(
      gradeSheet.gradingPeriod,
      gradingSystemType
    );

    // Count total active studentSubjectEnrollments for this section's students
    // These represent the exact subjects each student should have grades for
    // Filter by active, non-deleted SSE records and offerings to match what's shown in grade entry UI
    // IMPORTANT: Also filter by term_offered to only count subjects applicable to this grading period
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
          // Only count subjects offered in this term (full_year + current term)
          inArray(subjectOfferings.termOffered, validTerms)
        )
      );

    totalExpected = sseCount?.count ?? 0;
    // For display purposes, calculate average subjects per student
    subjectCount = studentCount > 0 ? Math.round(totalExpected / studentCount) : 0;

    if (totalExpected === 0) {
      // Fallback: If no SSE records exist, fall back to curriculum-based calculation
      // This handles cases where SSE hasn't been populated yet
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
    // Non-SHS: Use flat calculation - all students take all subjects
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

  // Count actual entries with grades (grade is numeric, so only check for NOT NULL)
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

  // Verify user is the section's assigned adviser (unless admin). Authorize against
  // the sectionAdvisers relationship rather than gradeSheet.adviserId (the creator),
  // so sheets created by an admin remain editable by the assigned teacher.
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

  // Validate that all subjects belong to this section's curriculum or offerings
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
          // Server-side: Auto-calculate remarks based on grade using DepEd scale
          // This ensures data integrity regardless of client-side logic
          const numGrade = typeof entry.grade === "number" ? entry.grade : parseFloat(String(entry.grade));
          const validatedRemarks = !isNaN(numGrade) ? getGradeRemarks(numGrade) : entry.remarks;

          // Upsert entry
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

  // Verify user is the section's assigned adviser (unless admin). Authorize against
  // the sectionAdvisers relationship rather than gradeSheet.adviserId (the creator),
  // so sheets created by an admin remain submittable by the assigned teacher.
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

  // Enforce period locking: check that previous periods are submitted
  const periodValidation = await validatePreviousPeriodsSubmitted(
    gradeSheet.sectionId,
    gradeSheet.schoolYearId,
    gradeSheet.gradingPeriod
  );
  if (!periodValidation.valid) {
    return { message: periodValidation.message };
  }

  // Validate all students × subjects have entries before submission
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

    return { success: true, message: "Grades unlocked for editing." };
  } catch (error) {
    logger.error("[grades] Failed to unlock grades", { error });
    return { message: "An unexpected error occurred." };
  }
}
