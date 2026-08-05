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
  // Get enrollment with current strand
  const [enrollment] = await db
    .select({
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

  // Count grade entries for this enrollment's subjects
  const [gradeCount] = await db
    .select({ count: count() })
    .from(gradeSheetEntries)
    .innerJoin(
      studentSubjectEnrollments,
      eq(gradeSheetEntries.studentSubjectEnrollmentId, studentSubjectEnrollments.id)
    )
    .where(
      and(
        eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
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
 */
export async function getAvailableOfferingsForEnrollment(
  enrollmentId: string
): Promise<SubjectOfferingOption[]> {
  // Get enrollment's section and existing subject enrollments
  const [enrollment] = await db
    .select({
      sectionId: enrollments.sectionId,
      schoolYearId: enrollments.schoolYearId,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment || !enrollment.sectionId) {
    return [];
  }

  // Get subject offering IDs the student is already enrolled in
  const existingEnrollments = await db
    .select({ subjectOfferingId: studentSubjectEnrollments.subjectOfferingId })
    .from(studentSubjectEnrollments)
    .where(
      and(
        eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

  const enrolledOfferingIds = existingEnrollments.map((e) => e.subjectOfferingId);

  // Get available offerings (active, not already enrolled)
  const conditions = [
    eq(subjectOfferings.sectionId, enrollment.sectionId),
    eq(subjectOfferings.schoolYearId, enrollment.schoolYearId),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
  ];

  // Only add notInArray condition if there are enrolled offerings
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
