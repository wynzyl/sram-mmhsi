import "server-only";
import { db } from "@/lib/db";
import {
  studentSubjectEnrollments,
  subjectOfferings,
  enrollments,
  students,
  subjects,
  sections,
  gradeLevels,
  schoolYears,
  users,
  strands,
  gradeSheetEntries,
  gradeSheets,
} from "@/lib/db/schema";
import type { SubjectOfferingOption } from "./components/ManualSubjectEnrollDialog";
import { eq, and, isNull, sql, asc, count, notInArray, inArray } from "drizzle-orm";
import type { ShsStrandCode } from "@/lib/constants/strands";
import type {
  StudentSubjectEnrollmentView,
  CanChangeStrandResult,
} from "./student-subject-enrollments.schema";

/**
 * Get all subject enrollments for a student enrollment.
 * Note: Cannot use "use cache" here because this file is re-exported through
 * index.ts which is imported by client components.
 */
export async function getStudentSubjectEnrollments(
  enrollmentId: string
): Promise<StudentSubjectEnrollmentView[]> {
  const rows = await db
    .select({
      id: studentSubjectEnrollments.id,
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      subjectOfferingId: studentSubjectEnrollments.subjectOfferingId,
      studentId: studentSubjectEnrollments.studentId,
      studentName: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
      studentRef: students.referenceNumber,
      schoolYearId: studentSubjectEnrollments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      subjectId: subjects.id,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sectionId: sections.id,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
      isActive: studentSubjectEnrollments.isActive,
      withdrawnAt: studentSubjectEnrollments.withdrawnAt,
      withdrawalReason: studentSubjectEnrollments.withdrawalReason,
      createdAt: studentSubjectEnrollments.createdAt,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      subjectOfferings,
      eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
    )
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(sections, eq(subjectOfferings.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(students, eq(studentSubjectEnrollments.studentId, students.id))
    .innerJoin(
      schoolYears,
      eq(studentSubjectEnrollments.schoolYearId, schoolYears.id)
    )
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(
      and(
        eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    )
    .orderBy(asc(subjects.sequenceOrder), asc(subjects.name));

  return rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollmentId,
    subjectOfferingId: row.subjectOfferingId,
    studentId: row.studentId,
    studentName: row.studentName,
    studentRef: row.studentRef,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectUnits: row.subjectUnits,
    isCore: row.isCore,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelName: row.gradeLevelName,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    isActive: row.isActive,
    withdrawnAt: row.withdrawnAt,
    withdrawalReason: row.withdrawalReason,
    createdAt: row.createdAt,
  }));
}

/**
 * Check if a student can change their strand.
 * Returns false if any grade entries exist for their subjects.
 */
export async function canChangeStrand(
  enrollmentId: string
): Promise<CanChangeStrandResult> {
  // Get enrollment with current strand and related info for grade check
  const [enrollment] = await db
    .select({
      studentId: enrollments.studentId,
      sectionId: enrollments.sectionId,
      schoolYearId: enrollments.schoolYearId,
      strandId: enrollments.strandId,
      strandCode: strands.code,
      strandName: strands.name,
    })
    .from(enrollments)
    .leftJoin(strands, eq(enrollments.strandId, strands.id))
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) {
    return {
      canChange: false,
      reason: "Enrollment not found",
      gradeCount: 0,
      currentStrandId: null,
      currentStrandCode: null,
      currentStrandName: null,
    };
  }

  // Enrollment must have section to check grades
  if (!enrollment.sectionId || !enrollment.schoolYearId) {
    return {
      canChange: true,
      reason: undefined,
      gradeCount: 0,
      currentStrandId: enrollment.strandId,
      currentStrandCode: enrollment.strandCode as ShsStrandCode | null,
      currentStrandName: enrollment.strandName,
    };
  }

  // Count grade entries for this student in this section/school year
  // Grade entries link via studentId + gradeSheet's section/schoolYear
  const [gradeCount] = await db
    .select({ count: count() })
    .from(gradeSheetEntries)
    .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
    .where(
      and(
        eq(gradeSheetEntries.studentId, enrollment.studentId),
        eq(gradeSheets.sectionId, enrollment.sectionId),
        eq(gradeSheets.schoolYearId, enrollment.schoolYearId),
        sql`${gradeSheetEntries.grade} IS NOT NULL`
      )
    );

  const hasGrades = gradeCount.count > 0;

  return {
    canChange: !hasGrades,
    reason: hasGrades
      ? `Cannot change strand after grades have been entered (${gradeCount.count} grade(s) recorded).`
      : undefined,
    gradeCount: gradeCount.count,
    currentStrandId: enrollment.strandId,
    currentStrandCode: enrollment.strandCode as ShsStrandCode | null,
    currentStrandName: enrollment.strandName,
  };
}

/**
 * Check if multiple students can change their strands (batch operation).
 * More efficient than calling canChangeStrand() individually for each enrollment.
 *
 * Performance: Uses two batched queries instead of N×2 individual queries.
 *
 * @param enrollmentIds - Array of enrollment IDs to check
 * @returns Map of enrollmentId to CanChangeStrandResult
 */
export async function canChangeStrandBatch(
  enrollmentIds: string[]
): Promise<Map<string, CanChangeStrandResult>> {
  if (enrollmentIds.length === 0) {
    return new Map();
  }

  // Batch query 1: Get all enrollments with strand info
  const enrollmentRows = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      sectionId: enrollments.sectionId,
      schoolYearId: enrollments.schoolYearId,
      strandId: enrollments.strandId,
      strandCode: strands.code,
      strandName: strands.name,
    })
    .from(enrollments)
    .leftJoin(strands, eq(enrollments.strandId, strands.id))
    .where(inArray(enrollments.id, enrollmentIds));

  // Build enrollment map for quick lookup
  const enrollmentMap = new Map(enrollmentRows.map((e) => [e.id, e]));

  // Get unique section/schoolYear/studentId combinations for grade check
  const studentsToCheck = enrollmentRows
    .filter((e) => e.sectionId && e.schoolYearId)
    .map((e) => ({
      enrollmentId: e.id,
      studentId: e.studentId,
      sectionId: e.sectionId!,
      schoolYearId: e.schoolYearId!,
    }));

  // Batch query 2: Get grade counts for all students at once
  const gradeCounts = studentsToCheck.length > 0
    ? await db
        .select({
          studentId: gradeSheetEntries.studentId,
          sectionId: gradeSheets.sectionId,
          schoolYearId: gradeSheets.schoolYearId,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(gradeSheetEntries)
        .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
        .where(
          and(
            inArray(gradeSheetEntries.studentId, studentsToCheck.map((s) => s.studentId)),
            sql`${gradeSheetEntries.grade} IS NOT NULL`
          )
        )
        .groupBy(gradeSheetEntries.studentId, gradeSheets.sectionId, gradeSheets.schoolYearId)
    : [];

  // Build grade count lookup: `studentId:sectionId:schoolYearId` -> count
  const gradeCountMap = new Map<string, number>();
  for (const gc of gradeCounts) {
    const key = `${gc.studentId}:${gc.sectionId}:${gc.schoolYearId}`;
    gradeCountMap.set(key, gc.count);
  }

  // Build results
  const results = new Map<string, CanChangeStrandResult>();

  for (const enrollmentId of enrollmentIds) {
    const enrollment = enrollmentMap.get(enrollmentId);

    if (!enrollment) {
      results.set(enrollmentId, {
        canChange: false,
        reason: "Enrollment not found",
        gradeCount: 0,
        currentStrandId: null,
        currentStrandCode: null,
        currentStrandName: null,
      });
      continue;
    }

    // No section/school year = can change
    if (!enrollment.sectionId || !enrollment.schoolYearId) {
      results.set(enrollmentId, {
        canChange: true,
        reason: undefined,
        gradeCount: 0,
        currentStrandId: enrollment.strandId,
        currentStrandCode: enrollment.strandCode as ShsStrandCode | null,
        currentStrandName: enrollment.strandName,
      });
      continue;
    }

    // Check grade count
    const key = `${enrollment.studentId}:${enrollment.sectionId}:${enrollment.schoolYearId}`;
    const gradeCount = gradeCountMap.get(key) ?? 0;
    const hasGrades = gradeCount > 0;

    results.set(enrollmentId, {
      canChange: !hasGrades,
      reason: hasGrades
        ? `Cannot change strand after grades have been entered (${gradeCount} grade(s) recorded).`
        : undefined,
      gradeCount,
      currentStrandId: enrollment.strandId,
      currentStrandCode: enrollment.strandCode as ShsStrandCode | null,
      currentStrandName: enrollment.strandName,
    });
  }

  return results;
}

/**
 * Get subject enrollments for a section (all students).
 * Used for section-level views.
 */
export async function getSubjectEnrollmentsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<StudentSubjectEnrollmentView[]> {
  const rows = await db
    .select({
      id: studentSubjectEnrollments.id,
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      subjectOfferingId: studentSubjectEnrollments.subjectOfferingId,
      studentId: studentSubjectEnrollments.studentId,
      studentName: sql<string>`${students.firstName} || ' ' || ${students.lastName}`,
      studentRef: students.referenceNumber,
      schoolYearId: studentSubjectEnrollments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      subjectId: subjects.id,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      sectionId: sections.id,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
      isActive: studentSubjectEnrollments.isActive,
      withdrawnAt: studentSubjectEnrollments.withdrawnAt,
      withdrawalReason: studentSubjectEnrollments.withdrawalReason,
      createdAt: studentSubjectEnrollments.createdAt,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      subjectOfferings,
      eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
    )
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(sections, eq(subjectOfferings.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(students, eq(studentSubjectEnrollments.studentId, students.id))
    .innerJoin(
      schoolYears,
      eq(studentSubjectEnrollments.schoolYearId, schoolYears.id)
    )
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(studentSubjectEnrollments.schoolYearId, schoolYearId),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    )
    .orderBy(
      asc(students.lastName),
      asc(students.firstName),
      asc(subjects.sequenceOrder)
    );

  return rows.map((row) => ({
    id: row.id,
    enrollmentId: row.enrollmentId,
    subjectOfferingId: row.subjectOfferingId,
    studentId: row.studentId,
    studentName: row.studentName,
    studentRef: row.studentRef,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectUnits: row.subjectUnits,
    isCore: row.isCore,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelName: row.gradeLevelName,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    isActive: row.isActive,
    withdrawnAt: row.withdrawnAt,
    withdrawalReason: row.withdrawalReason,
    createdAt: row.createdAt,
  }));
}

/**
 * Get available subject offerings for manual enrollment.
 * Returns offerings in the student's section that they are not yet enrolled in.
 *
 * Performance: Runs enrollment lookup and existing enrollments in parallel.
 */
export async function getAvailableOfferingsForEnrollment(
  enrollmentId: string
): Promise<SubjectOfferingOption[]> {
  // Phase 1: Get enrollment info and existing enrollments in PARALLEL
  const [enrollmentRows, existingEnrollments] = await Promise.all([
    db
      .select({
        sectionId: enrollments.sectionId,
        schoolYearId: enrollments.schoolYearId,
      })
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1),

    db
      .select({ subjectOfferingId: studentSubjectEnrollments.subjectOfferingId })
      .from(studentSubjectEnrollments)
      .where(
        and(
          eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
          eq(studentSubjectEnrollments.isActive, true),
          isNull(studentSubjectEnrollments.deletedAt)
        )
      ),
  ]);

  const enrollment = enrollmentRows[0];
  if (!enrollment || !enrollment.sectionId) {
    return [];
  }

  const enrolledOfferingIds = existingEnrollments.map((e) => e.subjectOfferingId);

  // Phase 2: Get available offerings (active, not already enrolled)
  const conditions = [
    eq(subjectOfferings.sectionId, enrollment.sectionId),
    eq(subjectOfferings.schoolYearId, enrollment.schoolYearId),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
  ];

  if (enrolledOfferingIds.length > 0) {
    conditions.push(notInArray(subjectOfferings.id, enrolledOfferingIds));
  }

  const offerings = await db
    .select({
      id: subjectOfferings.id,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      strandId: subjectOfferings.strandId,
      strandCode: strands.code,
      teacherName: users.username,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(strands, eq(subjectOfferings.strandId, strands.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(and(...conditions))
    .orderBy(asc(subjects.isCore), asc(subjects.sequenceOrder), asc(subjects.name));

  return offerings.map((o) => ({
    id: o.id,
    subjectCode: o.subjectCode,
    subjectName: o.subjectName,
    subjectUnits: o.subjectUnits,
    isCore: o.isCore,
    strandId: o.strandId,
    strandCode: o.strandCode,
    teacherName: o.teacherName,
  }));
}
