"use server";

import { db } from "@/lib/db";
import {
  subjectOfferings,
  sections,
  subjects,
  schoolYears,
  gradeLevels,
  users,
  strands,
  subjectStrands,
  studentSubjectEnrollments,
  curriculumAdoptions,
  curriculums,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, count, inArray } from "drizzle-orm";
import type {
  SubjectOfferingView,
  SubjectForOffering,
  TeacherOption,
} from "./subject-offerings.schema";
import type { ShsStrandCode } from "@/lib/constants/strands";

/**
 * Get all subject offerings for a section.
 */
export async function getSubjectOfferingsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<SubjectOfferingView[]> {
  const rows = await db
    .select({
      id: subjectOfferings.id,
      sectionId: subjectOfferings.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      schoolYearId: subjectOfferings.schoolYearId,
      schoolYearLabel: schoolYears.label,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
      strandId: subjectOfferings.strandId,
      strandCode: strands.code,
      isActive: subjectOfferings.isActive,
      sequenceOrder: subjectOfferings.sequenceOrder,
      createdAt: subjectOfferings.createdAt,
      studentCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${studentSubjectEnrollments}
         WHERE ${studentSubjectEnrollments.subjectOfferingId} = ${subjectOfferings.id}
         AND ${studentSubjectEnrollments.isActive} = true
         AND ${studentSubjectEnrollments.deletedAt} IS NULL)
      `,
    })
    .from(subjectOfferings)
    .innerJoin(sections, eq(subjectOfferings.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(schoolYears, eq(subjectOfferings.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .leftJoin(strands, eq(subjectOfferings.strandId, strands.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  return rows.map((row) => ({
    id: row.id,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelId: row.gradeLevelId,
    gradeLevelName: row.gradeLevelName,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectUnits: row.subjectUnits,
    isCore: row.isCore,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    strandId: row.strandId,
    strandCode: row.strandCode as ShsStrandCode | null,
    isActive: row.isActive,
    sequenceOrder: row.sequenceOrder,
    createdAt: row.createdAt,
    studentCount: row.studentCount,
  }));
}

/**
 * Get subjects from adopted curriculum for a section's grade level.
 * Used for generating subject offerings.
 */
export async function getSubjectsForOfferingGeneration(
  sectionId: string,
  schoolYearId: string
): Promise<SubjectForOffering[]> {
  // Get section's grade level
  const [section] = await db
    .select({
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(eq(sections.id, sectionId))
    .limit(1);

  if (!section) {
    return [];
  }

  // Get adopted curriculum for this grade level + school year
  const [adoption] = await db
    .select({
      curriculumId: curriculumAdoptions.curriculumId,
    })
    .from(curriculumAdoptions)
    .innerJoin(curriculums, eq(curriculumAdoptions.curriculumId, curriculums.id))
    .where(
      and(
        eq(curriculumAdoptions.gradeLevelId, section.gradeLevelId),
        eq(curriculumAdoptions.schoolYearId, schoolYearId),
        isNull(curriculumAdoptions.deletedAt),
        eq(curriculums.status, "published")
      )
    )
    .limit(1);

  if (!adoption) {
    return [];
  }

  // Get subjects from the adopted curriculum
  const subjectRows = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      units: subjects.units,
      isCore: subjects.isCore,
      gradeLevelId: subjects.gradeLevelId,
      sequenceOrder: subjects.sequenceOrder,
    })
    .from(subjects)
    .where(
      and(
        eq(subjects.curriculumId, adoption.curriculumId),
        eq(subjects.gradeLevelId, section.gradeLevelId),
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(asc(subjects.sequenceOrder), asc(subjects.name));

  if (subjectRows.length === 0) {
    return [];
  }

  // Get strand associations for elective subjects
  const electiveSubjectIds = subjectRows
    .filter((s) => !s.isCore)
    .map((s) => s.id);

  const strandAssociations =
    electiveSubjectIds.length > 0
      ? await db
          .select({
            subjectId: subjectStrands.subjectId,
            strandId: subjectStrands.strandId,
          })
          .from(subjectStrands)
          .where(
            and(
              inArray(subjectStrands.subjectId, electiveSubjectIds),
              isNull(subjectStrands.deletedAt)
            )
          )
      : [];

  // Build strand map per subject
  const strandMap = new Map<string, string[]>();
  for (const assoc of strandAssociations) {
    const existing = strandMap.get(assoc.subjectId) || [];
    existing.push(assoc.strandId);
    strandMap.set(assoc.subjectId, existing);
  }

  return subjectRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    units: row.units,
    isCore: row.isCore,
    gradeLevelId: row.gradeLevelId!,
    gradeLevelName: section.gradeLevelName,
    sequenceOrder: row.sequenceOrder,
    strandIds: row.isCore ? undefined : strandMap.get(row.id),
  }));
}

/**
 * Get teachers available for assignment.
 */
export async function getTeachersForAssignment(): Promise<TeacherOption[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.username,
      email: users.email,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "teacher"),
        eq(users.isActive, true),
        isNull(users.deletedAt)
      )
    )
    .orderBy(asc(users.username));

  return rows;
}

/**
 * Check if offerings already exist for a section + school year.
 */
export async function hasExistingOfferings(
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  const [result] = await db
    .select({ count: count() })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    );

  return result.count > 0;
}

/**
 * Get a single subject offering by ID.
 */
/**
 * Teacher's assigned classes for the grades dashboard.
 * Shows subjects assigned to a teacher via subject offerings.
 */
export type TeacherClassCard = {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectUnits: string;
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
  studentCount: number;
};

/**
 * Get subject offerings assigned to a specific teacher for the grades dashboard.
 * Used by teachers (non-advisers) to see their assigned classes.
 */
export async function getSubjectOfferingsForTeacher(
  teacherId: string,
  schoolYearId: string
): Promise<TeacherClassCard[]> {
  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      sectionId: subjectOfferings.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      schoolYearId: subjectOfferings.schoolYearId,
      schoolYearLabel: schoolYears.label,
      studentCount: sql<number>`
        (SELECT COUNT(*)::int FROM ${studentSubjectEnrollments}
         WHERE ${studentSubjectEnrollments.subjectOfferingId} = ${subjectOfferings.id}
         AND ${studentSubjectEnrollments.isActive} = true
         AND ${studentSubjectEnrollments.deletedAt} IS NULL)
      `,
    })
    .from(subjectOfferings)
    .innerJoin(sections, eq(subjectOfferings.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(schoolYears, eq(subjectOfferings.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(subjectOfferings.teacherId, teacherId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name), asc(subjects.name));

  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectUnits: row.subjectUnits,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelId: row.gradeLevelId,
    gradeLevelName: row.gradeLevelName,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    studentCount: row.studentCount,
  }));
}

export async function getSubjectOfferingById(
  id: string
): Promise<SubjectOfferingView | null> {
  const [row] = await db
    .select({
      id: subjectOfferings.id,
      sectionId: subjectOfferings.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      subjectUnits: subjects.units,
      isCore: subjects.isCore,
      schoolYearId: subjectOfferings.schoolYearId,
      schoolYearLabel: schoolYears.label,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
      strandId: subjectOfferings.strandId,
      strandCode: strands.code,
      isActive: subjectOfferings.isActive,
      sequenceOrder: subjectOfferings.sequenceOrder,
      createdAt: subjectOfferings.createdAt,
    })
    .from(subjectOfferings)
    .innerJoin(sections, eq(subjectOfferings.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(schoolYears, eq(subjectOfferings.schoolYearId, schoolYears.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .leftJoin(strands, eq(subjectOfferings.strandId, strands.id))
    .where(and(eq(subjectOfferings.id, id), isNull(subjectOfferings.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelId: row.gradeLevelId,
    gradeLevelName: row.gradeLevelName,
    subjectId: row.subjectId,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    subjectUnits: row.subjectUnits,
    isCore: row.isCore,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    strandId: row.strandId,
    strandCode: row.strandCode as ShsStrandCode | null,
    isActive: row.isActive,
    sequenceOrder: row.sequenceOrder,
    createdAt: row.createdAt,
  };
}
