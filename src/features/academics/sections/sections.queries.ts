import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  sections,
  gradeLevels,
  schoolYears,
  enrollments,
  teacherAssignments,
} from "@/lib/db/schema";
import { eq, and, isNull, sql, asc, desc, inArray } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { SectionView, SectionDependencyCounts } from "./sections.schema";

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
 */
export async function getSectionById(
  sectionId: string
): Promise<SectionView | null> {
  const [row] = await db
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
    .limit(1);

  if (!row) return null;

  const counts = await getSectionDependencyCounts(sectionId);

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
