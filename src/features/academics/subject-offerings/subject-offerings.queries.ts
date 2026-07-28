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
  CurriculumForSubjectPicker,
  SubjectForManualOffering,
} from "./subject-offerings.schema";
import type { ShsStrandCode } from "@/lib/constants/strands";
import type { TermOffering } from "@/lib/constants/term-offerings";

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
      termOffered: subjectOfferings.termOffered,
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
    termOffered: row.termOffered as TermOffering,
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
      termOffered: subjectOfferings.termOffered,
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
    termOffered: row.termOffered as TermOffering,
    isActive: row.isActive,
    sequenceOrder: row.sequenceOrder,
    createdAt: row.createdAt,
  };
}

// ─── Manual Subject Offering Queries ──────────────────────────────────────────

/**
 * Get published curriculums that have elective subjects for a grade level.
 * Used for the curriculum picker in manual subject offering dialog.
 */
export async function getCurriculumsWithSubjectsForGradeLevel(
  gradeLevelId: string
): Promise<CurriculumForSubjectPicker[]> {
  // First get all published curriculums
  const publishedCurriculums = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      version: curriculums.version,
    })
    .from(curriculums)
    .where(eq(curriculums.status, "published"))
    .orderBy(asc(curriculums.name), asc(curriculums.version));

  if (publishedCurriculums.length === 0) {
    return [];
  }

  // Get ELECTIVE subject counts per curriculum for this grade level
  const subjectCounts = await db
    .select({
      curriculumId: subjects.curriculumId,
      count: count(),
    })
    .from(subjects)
    .where(
      and(
        eq(subjects.gradeLevelId, gradeLevelId),
        eq(subjects.isCore, false), // Only electives
        isNull(subjects.deletedAt),
        inArray(
          subjects.curriculumId,
          publishedCurriculums.map((c) => c.id)
        )
      )
    )
    .groupBy(subjects.curriculumId);

  // Build map of curriculum -> elective count
  const countMap = new Map<string, number>();
  for (const row of subjectCounts) {
    if (row.curriculumId) {
      countMap.set(row.curriculumId, Number(row.count));
    }
  }

  // Return curriculums with their elective counts (filter out those with 0)
  return publishedCurriculums
    .map((c) => ({
      id: c.id,
      name: c.name,
      version: c.version,
      subjectCount: countMap.get(c.id) || 0,
    }))
    .filter((c) => c.subjectCount > 0);
}

/**
 * Get available subjects from a curriculum for manual offering.
 * Shows:
 * - Subjects not yet offered in the section
 * - Elective subjects (isCore=false) that don't have strand-specific offerings yet
 */
export async function getAvailableSubjectsForManualOffering(
  curriculumId: string,
  gradeLevelId: string,
  sectionId: string,
  schoolYearId: string
): Promise<SubjectForManualOffering[]> {
  // Get existing offerings with their strand assignments
  const existingOfferings = await db
    .select({
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
      isCore: subjects.isCore,
      strandId: subjectOfferings.strandId,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    );

  // Track which subjects are fully offered (core) or have strand assignments
  const coreSubjectIds = new Set<string>();
  const coreSubjectCodes = new Set<string>();
  const electivesWithStrand = new Set<string>(); // Electives that already have strand assignment

  for (const o of existingOfferings) {
    if (o.isCore) {
      // Core subjects can only be offered once
      coreSubjectIds.add(o.subjectId);
      coreSubjectCodes.add(o.subjectCode);
    } else if (o.strandId) {
      // Elective WITH strand - can't add another strand assignment
      electivesWithStrand.add(o.subjectId);
    }
    // Electives WITHOUT strand are still available for strand linking
  }

  // Get curriculum info
  const [curriculum] = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      status: curriculums.status,
    })
    .from(curriculums)
    .where(eq(curriculums.id, curriculumId))
    .limit(1);

  if (!curriculum || curriculum.status !== "published") {
    return [];
  }

  // Get ONLY elective subjects from the curriculum for the grade level
  // (Core subjects are handled by "Generate Offerings" button)
  const subjectRows = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      units: subjects.units,
      isCore: subjects.isCore,
      sequenceOrder: subjects.sequenceOrder,
    })
    .from(subjects)
    .where(
      and(
        eq(subjects.curriculumId, curriculumId),
        eq(subjects.gradeLevelId, gradeLevelId),
        eq(subjects.isCore, false), // Only electives
        isNull(subjects.deletedAt)
      )
    )
    .orderBy(asc(subjects.sequenceOrder), asc(subjects.name));

  // Filter electives:
  // - Exclude if it's a core subject already offered
  // - Exclude if it already has a strand assignment (can't add another)
  // - Include electives that don't exist OR exist but without strand (can link to strand)
  const availableSubjects = subjectRows.filter(
    (s) => !coreSubjectIds.has(s.id) &&
           !coreSubjectCodes.has(s.code) &&
           !electivesWithStrand.has(s.id)
  );

  if (availableSubjects.length === 0) {
    return [];
  }

  // Get strand associations for elective subjects
  const electiveSubjectIds = availableSubjects
    .filter((s) => !s.isCore)
    .map((s) => s.id);

  const strandAssociations =
    electiveSubjectIds.length > 0
      ? await db
          .select({
            subjectId: subjectStrands.subjectId,
            strandId: subjectStrands.strandId,
            strandCode: strands.code,
          })
          .from(subjectStrands)
          .innerJoin(strands, eq(subjectStrands.strandId, strands.id))
          .where(
            and(
              inArray(subjectStrands.subjectId, electiveSubjectIds),
              isNull(subjectStrands.deletedAt)
            )
          )
      : [];

  // Build strand map per subject
  const strandMap = new Map<string, Array<{ strandId: string; strandCode: string }>>();
  for (const assoc of strandAssociations) {
    const existing = strandMap.get(assoc.subjectId) || [];
    existing.push({ strandId: assoc.strandId, strandCode: assoc.strandCode });
    strandMap.set(assoc.subjectId, existing);
  }

  return availableSubjects.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    units: row.units,
    isCore: row.isCore,
    curriculumId: curriculum.id,
    curriculumName: curriculum.name,
    sequenceOrder: row.sequenceOrder,
    strandAssociations: strandMap.get(row.id) || [],
  }));
}
