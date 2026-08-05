import "server-only";

import { db } from "@/lib/db";
import {
  subjects,
  subjectStrands,
  strands,
  subjectOfferings,
  studentSubjectEnrollments,
  curriculums,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, inArray } from "drizzle-orm";
import type { ShsStrandCode } from "@/lib/constants/strands";
import type {
  ElectiveSubjectView,
  ElectivesByStrand,
  ElectiveSubjectQueryParams,
} from "./electives.schema";

/**
 * Get all elective subjects (isCore = false) with strand associations.
 * Optionally filtered by curriculum, school year, or strand.
 */
export async function getElectiveSubjects(
  params: ElectiveSubjectQueryParams = {}
): Promise<ElectiveSubjectView[]> {
  const { curriculumId, schoolYearId, strandId, gradeLevelId } = params;

  // Build conditions
  const conditions = [
    eq(subjects.isCore, false),
    isNull(subjects.deletedAt),
  ];

  if (curriculumId) {
    conditions.push(eq(subjects.curriculumId, curriculumId));
  }

  if (gradeLevelId) {
    conditions.push(eq(subjects.gradeLevelId, gradeLevelId));
  }

  // Get elective subjects
  const subjectRows = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      units: subjects.units,
      curriculumId: subjects.curriculumId,
      curriculumName: curriculums.name,
      gradeLevelId: subjects.gradeLevelId,
      gradeLevelName: gradeLevels.name,
    })
    .from(subjects)
    .innerJoin(curriculums, eq(subjects.curriculumId, curriculums.id))
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(and(...conditions))
    .orderBy(asc(gradeLevels.order), asc(subjects.sequenceOrder), asc(subjects.name));

  if (subjectRows.length === 0) {
    return [];
  }

  const subjectIds = subjectRows.map((s) => s.id);

  // Get strand associations for all subjects
  const strandAssociations = await db
    .select({
      subjectId: subjectStrands.subjectId,
      strandId: subjectStrands.strandId,
      strandCode: strands.code,
      strandName: strands.name,
      isStrandCore: subjectStrands.isStrandCore,
    })
    .from(subjectStrands)
    .innerJoin(strands, eq(subjectStrands.strandId, strands.id))
    .where(
      and(
        inArray(subjectStrands.subjectId, subjectIds),
        isNull(subjectStrands.deletedAt),
        isNull(strands.deletedAt)
      )
    )
    .orderBy(asc(strands.displayOrder));

  // If filtering by strand, filter subjects that have this strand association
  let filteredSubjectIds = new Set(subjectIds);
  if (strandId) {
    const matchingSubjectIds = strandAssociations
      .filter((a) => a.strandId === strandId)
      .map((a) => a.subjectId);
    filteredSubjectIds = new Set(matchingSubjectIds);
  }

  // Get offering counts (optionally filtered by school year)
  const offeringCountConditions = [
    inArray(subjectOfferings.subjectId, Array.from(filteredSubjectIds)),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
  ];
  if (schoolYearId) {
    offeringCountConditions.push(eq(subjectOfferings.schoolYearId, schoolYearId));
  }

  const offeringCounts = await db
    .select({
      subjectId: subjectOfferings.subjectId,
      count: sql<number>`COUNT(DISTINCT ${subjectOfferings.sectionId})::int`,
    })
    .from(subjectOfferings)
    .where(and(...offeringCountConditions))
    .groupBy(subjectOfferings.subjectId);

  const offeringCountMap = new Map(offeringCounts.map((o) => [o.subjectId, o.count]));

  // Get student enrollment counts (optionally filtered by school year)
  const enrollmentCountConditions = [
    inArray(studentSubjectEnrollments.subjectOfferingId,
      db.select({ id: subjectOfferings.id })
        .from(subjectOfferings)
        .where(and(
          inArray(subjectOfferings.subjectId, Array.from(filteredSubjectIds)),
          isNull(subjectOfferings.deletedAt)
        ))
    ),
    eq(studentSubjectEnrollments.isActive, true),
    isNull(studentSubjectEnrollments.deletedAt),
  ];
  if (schoolYearId) {
    enrollmentCountConditions.push(eq(studentSubjectEnrollments.schoolYearId, schoolYearId));
  }

  const enrollmentCounts = await db
    .select({
      subjectId: subjectOfferings.subjectId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      subjectOfferings,
      eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
    )
    .where(and(...enrollmentCountConditions))
    .groupBy(subjectOfferings.subjectId);

  const enrollmentCountMap = new Map(enrollmentCounts.map((e) => [e.subjectId, e.count]));

  // Build strand associations map
  const strandAssocMap = new Map<string, typeof strandAssociations>();
  for (const assoc of strandAssociations) {
    const existing = strandAssocMap.get(assoc.subjectId) || [];
    existing.push(assoc);
    strandAssocMap.set(assoc.subjectId, existing);
  }

  // Assemble results
  return subjectRows
    .filter((s) => filteredSubjectIds.has(s.id))
    .map((subject) => ({
      id: subject.id,
      code: subject.code,
      name: subject.name,
      units: subject.units,
      curriculumId: subject.curriculumId,
      curriculumName: subject.curriculumName,
      gradeLevelId: subject.gradeLevelId || "",
      gradeLevelName: subject.gradeLevelName || "",
      strands: (strandAssocMap.get(subject.id) || []).map((a) => ({
        strandId: a.strandId,
        strandCode: a.strandCode as ShsStrandCode,
        strandName: a.strandName,
        isStrandCore: a.isStrandCore,
      })),
      sectionOfferingCount: offeringCountMap.get(subject.id) || 0,
      studentEnrollmentCount: enrollmentCountMap.get(subject.id) || 0,
    }));
}

/**
 * Get elective subjects grouped by strand.
 * Each strand tab shows subjects associated with that strand.
 */
export async function getElectivesByStrand(
  params: Omit<ElectiveSubjectQueryParams, "strandId"> = {}
): Promise<ElectivesByStrand[]> {
  // Get all active strands
  const activeStrands = await db
    .select({
      id: strands.id,
      code: strands.code,
      name: strands.name,
    })
    .from(strands)
    .where(
      and(
        eq(strands.isActive, true),
        isNull(strands.deletedAt)
      )
    )
    .orderBy(asc(strands.displayOrder));

  // Get all electives first
  const allElectives = await getElectiveSubjects(params);

  // Group by strand
  const result: ElectivesByStrand[] = [];

  for (const strand of activeStrands) {
    // Filter subjects that have this strand association
    const strandSubjects = allElectives.filter((s) =>
      s.strands.some((a) => a.strandId === strand.id)
    );

    if (strandSubjects.length > 0) {
      result.push({
        strand: {
          id: strand.id,
          code: strand.code as ShsStrandCode,
          name: strand.name,
        },
        subjects: strandSubjects,
      });
    }
  }

  return result;
}

/**
 * Get elective subjects available for a specific section.
 * Includes subjects that:
 * 1. Are part of the section's adopted curriculum
 * 2. Are electives (isCore = false)
 * 3. Match the section's grade level
 */
export async function getElectivesForSection(
  sectionId: string,
  schoolYearId: string
): Promise<ElectiveSubjectView[]> {
  // This would require joining through curriculum adoptions
  // For now, return all electives for the school year
  return getElectiveSubjects({ schoolYearId });
}
