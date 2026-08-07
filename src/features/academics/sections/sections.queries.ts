import "server-only";
import { cacheLife, cacheTag, unstable_noStore } from "next/cache";
import { db } from "@/lib/db";
import {
  sections,
  gradeLevels,
  schoolYears,
  enrollments,
  teacherAssignments,
  students,
  strands,
  studentSubjectEnrollments,
  subjectOfferings,
  subjects,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, desc, inArray } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { SectionView, SectionDependencyCounts, StudentInSection } from "./sections.schema";

// ─── Get All Sections ─────────────────────────────────────────────────────────

/**
 * Get all active sections with grade level and school year info.
 * Ordered by school year (newest first), then grade level order, then section name.
 */
export async function getAllSections(): Promise<SectionView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SECTIONS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: sections.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: sections.createdAt,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
    .where(isNull(sections.deletedAt))
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(sections.name)
    );

  // Get dependency counts for all sections in one batch
  const sectionIds = rows.map((r) => r.id);
  const counts = await getSectionDependencyCountsBatch(sectionIds);

  return rows.map((row) => ({
    ...row,
    enrollmentCount: counts.get(row.id)?.enrollmentCount ?? 0,
    assignmentCount: counts.get(row.id)?.assignmentCount ?? 0,
  }));
}

// ─── Get Sections By School Year ──────────────────────────────────────────────

/**
 * Get active sections for a specific school year.
 * Ordered by grade level order, then section name.
 */
export async function getSectionsBySchoolYear(
  schoolYearId: string
): Promise<SectionView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SECTIONS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: sections.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: sections.createdAt,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(sections.schoolYearId, schoolYearId),
        isNull(sections.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  // Get dependency counts
  const sectionIds = rows.map((r) => r.id);
  const counts = await getSectionDependencyCountsBatch(sectionIds);

  return rows.map((row) => ({
    ...row,
    enrollmentCount: counts.get(row.id)?.enrollmentCount ?? 0,
    assignmentCount: counts.get(row.id)?.assignmentCount ?? 0,
  }));
}

// ─── Get Section By ID ────────────────────────────────────────────────────────

/**
 * Get a single section by ID with all details.
 *
 * Performance: Runs section data and dependency counts in parallel.
 */
export async function getSectionById(
  sectionId: string
): Promise<SectionView | null> {
  // Run both queries in parallel since they don't depend on each other
  const [rows, counts] = await Promise.all([
    db
      .select({
        id: sections.id,
        name: sections.name,
        gradeLevelId: sections.gradeLevelId,
        gradeLevelName: gradeLevels.name,
        gradeLevelOrder: gradeLevels.order,
        schoolYearId: sections.schoolYearId,
        schoolYearLabel: schoolYears.label,
        isActiveYear: schoolYears.isActive,
        createdAt: sections.createdAt,
      })
      .from(sections)
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
      .where(
        and(
          eq(sections.id, sectionId),
          isNull(sections.deletedAt)
        )
      )
      .limit(1),

    getSectionDependencyCounts(sectionId),
  ]);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    ...counts,
  };
}

// ─── Get Section Dependency Counts ────────────────────────────────────────────

/**
 * Get counts of enrollments and teacher assignments for a section.
 * Used to determine if a section can be deleted.
 */
export async function getSectionDependencyCounts(
  sectionId: string
): Promise<SectionDependencyCounts> {
  const [enrollmentResult, assignmentResult] = await Promise.all([
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.sectionId, sectionId),
          isNull(enrollments.cancelledAt)
        )
      ),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(teacherAssignments)
      .where(
        and(
          eq(teacherAssignments.sectionId, sectionId),
          isNull(teacherAssignments.deletedAt)
        )
      ),
  ]);

  return {
    enrollmentCount: Number(enrollmentResult[0]?.count ?? 0),
    assignmentCount: Number(assignmentResult[0]?.count ?? 0),
  };
}

/**
 * Batch get dependency counts for multiple sections.
 * More efficient than individual queries.
 */
async function getSectionDependencyCountsBatch(
  sectionIds: string[]
): Promise<Map<string, SectionDependencyCounts>> {
  if (sectionIds.length === 0) {
    return new Map();
  }

  const [enrollmentCounts, assignmentCounts] = await Promise.all([
    db
      .select({
        sectionId: enrollments.sectionId,
        count: sql<number>`COUNT(*)`,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.sectionId, sectionIds),
          isNull(enrollments.cancelledAt)
        )
      )
      .groupBy(enrollments.sectionId),
    db
      .select({
        sectionId: teacherAssignments.sectionId,
        count: sql<number>`COUNT(*)`,
      })
      .from(teacherAssignments)
      .where(
        and(
          inArray(teacherAssignments.sectionId, sectionIds),
          isNull(teacherAssignments.deletedAt)
        )
      )
      .groupBy(teacherAssignments.sectionId),
  ]);

  const enrollmentMap = new Map(
    enrollmentCounts.map((r) => [r.sectionId, Number(r.count)])
  );
  const assignmentMap = new Map(
    assignmentCounts.map((r) => [r.sectionId, Number(r.count)])
  );

  const result = new Map<string, SectionDependencyCounts>();
  for (const id of sectionIds) {
    result.set(id, {
      enrollmentCount: enrollmentMap.get(id) ?? 0,
      assignmentCount: assignmentMap.get(id) ?? 0,
    });
  }

  return result;
}

// ─── Get Students In Section ─────────────────────────────────────────────────

/**
 * Get all enrolled students in a section for grade entry.
 * Only returns students with "enrolled" status (not pending/cancelled).
 * Includes strand information for SHS students (Grade 11-12).
 * Includes strand-aware subject enrollment counts (core + strand-specific).
 * Ordered by lastName, firstName for consistent display.
 *
 * Performance: Runs independent queries in parallel where possible.
 *
 * @param sectionId - The section ID
 * @param schoolYearId - Optional school year ID for filtering offerings (recommended for accuracy)
 */
export async function getStudentsInSection(
  sectionId: string,
  schoolYearId?: string
): Promise<StudentInSection[]> {
  // Opt out of Next.js caching to ensure fresh data after offerings change
  unstable_noStore();

  // Build offerings filter conditions
  const offeringsConditions = [
    eq(subjectOfferings.sectionId, sectionId),
    eq(subjectOfferings.isActive, true),
    isNull(subjectOfferings.deletedAt),
  ];
  if (schoolYearId) {
    offeringsConditions.push(eq(subjectOfferings.schoolYearId, schoolYearId));
  }

  // Phase 1: Run students query and available offerings query in PARALLEL
  const [rows, availableOfferingsResult] = await Promise.all([
    db
      .select({
        studentId: students.id,
        studentRef: students.referenceNumber,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        suffix: students.suffix,
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        strandId: enrollments.strandId,
        strandCode: strands.code,
        strandName: strands.name,
        schoolYearId: enrollments.schoolYearId,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .leftJoin(strands, eq(enrollments.strandId, strands.id))
      .where(
        and(
          eq(enrollments.sectionId, sectionId),
          eq(enrollments.status, "enrolled"),
          isNull(students.deletedAt)
        )
      )
      .orderBy(asc(students.lastName), asc(students.firstName)),

    // Available offerings query (independent of student data)
    db
      .select({
        strandId: subjectOfferings.strandId,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(subjectOfferings)
      .where(and(...offeringsConditions))
      .groupBy(subjectOfferings.strandId),
  ]);

  if (rows.length === 0) {
    return [];
  }

  // Phase 2: Get subject counts (depends on enrollmentIds from Phase 1)
  const enrollmentIds = rows.map((r) => r.enrollmentId);

  // Count enrolled subjects per enrollment with strand info
  const subjectCountsResult = await db
    .select({
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      offeringStrandId: subjectOfferings.strandId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(studentSubjectEnrollments)
    .innerJoin(
      subjectOfferings,
      eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
    )
    .where(
      and(
        inArray(studentSubjectEnrollments.enrollmentId, enrollmentIds),
        eq(subjectOfferings.sectionId, sectionId),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .groupBy(studentSubjectEnrollments.enrollmentId, subjectOfferings.strandId);

  // Build lookup maps
  const enrollmentSubjectCounts = new Map<string, Array<{ strandId: string | null; count: number }>>();
  for (const row of subjectCountsResult) {
    const existing = enrollmentSubjectCounts.get(row.enrollmentId) || [];
    existing.push({ strandId: row.offeringStrandId, count: row.count });
    enrollmentSubjectCounts.set(row.enrollmentId, existing);
  }

  const offeringsByStrand = new Map<string | null, number>();
  for (const row of availableOfferingsResult) {
    offeringsByStrand.set(row.strandId, row.count);
  }

  // Helper to calculate strand-aware counts
  function calculateSubjectCount(
    enrollmentId: string,
    studentStrandId: string | null
  ): number {
    const counts = enrollmentSubjectCounts.get(enrollmentId) || [];
    let total = 0;
    for (const { strandId, count } of counts) {
      // Include if: strandId is null (core/all tracks) OR matches student's strand
      if (strandId === null || strandId === studentStrandId) {
        total += count;
      }
    }
    return total;
  }

  function calculateSubjectTotal(studentStrandId: string | null): number {
    let total = 0;
    for (const [strandId, count] of offeringsByStrand) {
      // Include if: strandId is null (core/all tracks) OR matches student's strand
      if (strandId === null || strandId === studentStrandId) {
        total += count;
      }
    }
    return total;
  }

  return rows.map((row) => ({
    studentId: row.studentId,
    studentRef: row.studentRef,
    firstName: row.firstName,
    middleName: row.middleName,
    lastName: row.lastName,
    suffix: row.suffix,
    enrollmentId: row.enrollmentId,
    enrollmentStatus: row.enrollmentStatus,
    strandId: row.strandId,
    strandCode: row.strandCode,
    strandName: row.strandName,
    subjectCount: calculateSubjectCount(row.enrollmentId, row.strandId),
    subjectTotal: calculateSubjectTotal(row.strandId),
  }));
}
