import "server-only";

/**
 * Grade Sheet Validation Helpers
 *
 * Server-side authorization and completeness checks used by the grade sheet
 * actions. Deliberately NOT a `"use server"` module: every export of a
 * `"use server"` file becomes a publicly callable server-action endpoint, and
 * none of these helpers performs its own session/permission check — they assume
 * the caller has already run `requireSession()` + `hasPermission()`.
 *
 * Callers: `grade-sheet.actions.ts`.
 */

import { db } from "@/lib/db";
import {
  sections,
  gradeSheets,
  gradeSheetEntries,
  sectionAdvisers,
  gradeLevels,
  enrollments,
  studentSubjectEnrollments,
  subjectOfferings,
} from "@/lib/db/schema";
import { eq, and, sql, isNull, isNotNull, inArray, exists } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  QUARTERLY_PERIODS,
  TRIMESTER_PERIODS,
} from "@/lib/constants/grading-periods";
import { getGradeGroup } from "@/lib/constants/grade-groups";
import { getValidTermsForPeriod } from "@/lib/constants/term-offerings";
import {
  getStudentsInSection,
  getSubjectsForGradeLevel,
} from "./grades.queries";

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
 * Count grades entered on a sheet, restricted to the scope its `totalExpected`
 * was derived from.
 *
 * Both sides of `totalExpected - totalEntered` must cover the same students and
 * subjects. An unscoped count also picks up stale rows — a withdrawn student's
 * grades, or a subject whose offering was later deactivated — which inflate
 * `totalEntered`, understate `missingCount`, and let an incomplete sheet clear
 * the submission gate.
 *
 * `subjectScope` differs per caller because the expectation does: the SHS path
 * expects one grade per active subject offering, while the curriculum-based
 * paths expect one per grade-level subject.
 */
async function countEnteredGrades(
  gradeSheetId: string,
  studentIds: string[],
  subjectScope: SQL
): Promise<number> {
  if (studentIds.length === 0) {
    return 0;
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gradeSheetEntries)
    .where(
      and(
        eq(gradeSheetEntries.gradeSheetId, gradeSheetId),
        isNotNull(gradeSheetEntries.grade),
        inArray(gradeSheetEntries.studentId, studentIds),
        subjectScope
      )
    );

  return row?.count ?? 0;
}

/**
 * Validate that all enrolled students have grades for all subjects.
 *
 * Performance: Uses parallel queries via Promise.all to minimize sequential DB round-trips.
 * - Step 1: Fetch grade sheet (required for subsequent queries)
 * - Step 2: Parallel fetch of section info and students
 * - Step 3: For SHS, parallel fetch of enrollments, SSE count, and entered grades count
 * - Step 4: For non-SHS, fetch subjects, then count entered grades in that scope
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
  // Only these (currently enrolled) students count toward `totalExpected`, so
  // they also bound every entered-grade count below.
  const studentIds = studentsList.map((s) => s.id);

  if (studentCount === 0) {
    return {
      isComplete: false,
      message: "No students enrolled in this section.",
    };
  }

  let totalExpected: number;
  let subjectCount: number;

  if (isSHS) {
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
    const [sseCountResult, enteredForOfferings] = await Promise.all([
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
      // Mirror the offering predicate above (and `getGradeSheetForPeriod`, which
      // is what the adviser's grid renders) so a grade left behind by a
      // deactivated or out-of-term offering cannot pad the entered count.
      countEnteredGrades(
        gradeSheetId,
        studentIds,
        exists(
          db
            .select({ one: sql`1` })
            .from(subjectOfferings)
            .where(
              and(
                eq(subjectOfferings.subjectId, gradeSheetEntries.subjectId),
                eq(subjectOfferings.sectionId, gradeSheet.sectionId),
                eq(subjectOfferings.schoolYearId, gradeSheet.schoolYearId),
                eq(subjectOfferings.isActive, true),
                isNull(subjectOfferings.deletedAt),
                inArray(subjectOfferings.termOffered, validTerms)
              )
            )
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

      // Re-query entered count if we had to fallback (rare edge case).
      // This branch runs precisely because no active offering matched, so the
      // expectation is curriculum-based — scope the count to those subjects,
      // NOT to offerings, or it would always come back zero.
      const totalEntered = await countEnteredGrades(
        gradeSheetId,
        studentIds,
        inArray(
          gradeSheetEntries.subjectId,
          subjects.map((s) => s.id)
        )
      );
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
    const totalEntered = enteredForOfferings;
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

  // Non-SHS path: the expectation is curriculum-based (students × grade-level
  // subjects) and never consults subject offerings, so the entered count must
  // be scoped to those same subjects. That makes it depend on the subject
  // fetch, which is why the two are no longer issued in parallel; the early
  // return below also skips the count entirely when nothing is expected.
  const subjectsResult = await getSubjectsForGradeLevel(
    section.gradeLevelId,
    gradeSheet.schoolYearId
  );

  subjectCount = subjectsResult.length;
  totalExpected = studentCount * subjectCount;

  if (totalExpected === 0) {
    return {
      isComplete: false,
      message: "No subjects configured for this grade level.",
    };
  }

  const totalEntered = await countEnteredGrades(
    gradeSheetId,
    studentIds,
    inArray(
      gradeSheetEntries.subjectId,
      subjectsResult.map((s) => s.id)
    )
  );
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
