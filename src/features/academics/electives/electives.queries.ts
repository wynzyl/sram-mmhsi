import "server-only";
import { cacheLife, cacheTag } from "next/cache";
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
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { ShsStrandCode } from "@/lib/constants/strands";
import type {
  ElectiveSubjectView,
  ElectivesByStrand,
  ElectiveSubjectQueryParams,
} from "./electives.schema";

/**
 * Get all elective subjects (isCore = false) with strand associations.
 * Optionally filtered by curriculum, school year, or strand.
 *
 * Performance: Uses parallel queries where possible to reduce latency.
 * Query flow: subjects → strand associations → (offering counts || enrollment counts)
 *
 * Cached for performance since elective definitions rarely change.
 */
export async function getElectiveSubjects(
  params: ElectiveSubjectQueryParams = {}
): Promise<ElectiveSubjectView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.CURRICULUMS);
  cacheLife("hours");

  const { curriculumId, schoolYearId, strandId, gradeLevelId } = params;

  // Build conditions for subjects query
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

  // Phase 1: Get elective subjects
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

  // Phase 2: Get strand associations (needed to filter by strandId)
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

  // Compute filtered subject IDs based on strand filter
  let filteredSubjectIds = new Set(subjectIds);
  if (strandId) {
    const matchingSubjectIds = strandAssociations
      .filter((a) => a.strandId === strandId)
      .map((a) => a.subjectId);
    filteredSubjectIds = new Set(matchingSubjectIds);
  }

  // Early return if no subjects match the strand filter
  if (filteredSubjectIds.size === 0) {
    return [];
  }

  const filteredSubjectIdArray = Array.from(filteredSubjectIds);

  // Phase 3: Fetch offering and enrollment counts in PARALLEL
  const offeringCountConditions = [
    inArray(subjectOfferings.subjectId, filteredSubjectIdArray),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
  ];
  if (schoolYearId) {
    offeringCountConditions.push(eq(subjectOfferings.schoolYearId, schoolYearId));
  }

  const enrollmentCountConditions = [
    inArray(studentSubjectEnrollments.subjectOfferingId,
      db.select({ id: subjectOfferings.id })
        .from(subjectOfferings)
        .where(and(
          inArray(subjectOfferings.subjectId, filteredSubjectIdArray),
          isNull(subjectOfferings.deletedAt)
        ))
    ),
    eq(studentSubjectEnrollments.isActive, true),
    isNull(studentSubjectEnrollments.deletedAt),
  ];
  if (schoolYearId) {
    enrollmentCountConditions.push(eq(studentSubjectEnrollments.schoolYearId, schoolYearId));
  }

  // Run both count queries in parallel
  const [offeringCounts, enrollmentCounts] = await Promise.all([
    db
      .select({
        subjectId: subjectOfferings.subjectId,
        count: sql<number>`COUNT(DISTINCT ${subjectOfferings.sectionId})::int`,
      })
      .from(subjectOfferings)
      .where(and(...offeringCountConditions))
      .groupBy(subjectOfferings.subjectId),

    db
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
      .groupBy(subjectOfferings.subjectId),
  ]);

  // Build lookup maps
  const offeringCountMap = new Map(offeringCounts.map((o) => [o.subjectId, o.count]));
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
 *
 * Performance: Fetches strands and electives in parallel since they're independent.
 */
export async function getElectivesByStrand(
  params: Omit<ElectiveSubjectQueryParams, "strandId"> = {}
): Promise<ElectivesByStrand[]> {
  // Fetch strands and electives in PARALLEL (independent queries)
  const [activeStrands, allElectives] = await Promise.all([
    db
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
      .orderBy(asc(strands.displayOrder)),

    getElectiveSubjects(params),
  ]);

  // Group electives by strand
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
