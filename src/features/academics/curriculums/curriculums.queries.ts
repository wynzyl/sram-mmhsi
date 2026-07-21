import "server-only";

import { db } from "@/lib/db";
import {
  curriculums,
  curriculumAdoptions,
  subjects,
  gradeLevels,
  schoolYears,
  users,
  gradeRecords,
  teacherAssignments,
  sections,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, desc, sql } from "drizzle-orm";

// Re-export types from the client-safe types file
export type {
  CurriculumListRow,
  CurriculumDetail,
  SubjectListRow,
  AdoptionRow,
  CurriculumVersionRow,
  AdoptionMatrixCell,
  CurriculumDropdownOption,
} from "./curriculums.types";

import type {
  CurriculumListRow,
  CurriculumDetail,
  SubjectListRow,
  CurriculumVersionRow,
  AdoptionMatrixCell,
  CurriculumDropdownOption,
} from "./curriculums.types";
import type { CurriculumStatus } from "./curriculums.schema";

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get all curriculums with filters.
 * Returns summary data for the list view.
 */
export async function listCurriculums(filter?: {
  status?: CurriculumStatus;
  rootId?: string;
  gradeLevelId?: string;
}): Promise<CurriculumListRow[]> {
  // Build base query
  const baseConditions = [];

  if (filter?.status) {
    baseConditions.push(eq(curriculums.status, filter.status));
  }

  if (filter?.rootId) {
    baseConditions.push(eq(curriculums.rootId, filter.rootId));
  }

  // Add grade level filter to base conditions if specified (moved from post-query filter)
  // Use EXISTS subquery for efficient filtering without fetching all records
  if (filter?.gradeLevelId) {
    baseConditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${subjects}
        WHERE ${subjects.curriculumId} = ${curriculums.id}
        AND ${subjects.gradeLevelId} = ${filter.gradeLevelId}
        AND ${subjects.deletedAt} IS NULL
      )`
    );
  }

  // Query curriculums with subject and adoption counts
  const rows = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      description: curriculums.description,
      status: curriculums.status,
      version: curriculums.version,
      rootId: curriculums.rootId,
      createdAt: curriculums.createdAt,
      publishedAt: curriculums.publishedAt,
      createdByName: users.username,
      subjectCount: sql<number>`(
        SELECT COUNT(*) FROM ${subjects}
        WHERE ${subjects.curriculumId} = ${curriculums.id}
        AND ${subjects.deletedAt} IS NULL
      )`.as("subject_count"),
      adoptionCount: sql<number>`(
        SELECT COUNT(*) FROM ${curriculumAdoptions}
        WHERE ${curriculumAdoptions.curriculumId} = ${curriculums.id}
        AND ${curriculumAdoptions.deletedAt} IS NULL
      )`.as("adoption_count"),
    })
    .from(curriculums)
    .leftJoin(users, eq(curriculums.createdBy, users.id))
    .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
    .orderBy(desc(curriculums.updatedAt));

  return rows;
}

/**
 * Get a single curriculum by ID with full details.
 */
export async function getCurriculumById(id: string): Promise<CurriculumDetail | null> {
  // Query 1: Curriculum base info
  const curriculumRow = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      description: curriculums.description,
      status: curriculums.status,
      version: curriculums.version,
      rootId: curriculums.rootId,
      predecessorId: curriculums.predecessorId,
      publishedAt: curriculums.publishedAt,
      archivedAt: curriculums.archivedAt,
      createdAt: curriculums.createdAt,
      updatedAt: curriculums.updatedAt,
    })
    .from(curriculums)
    .where(eq(curriculums.id, id))
    .limit(1);

  if (curriculumRow.length === 0) {
    return null;
  }

  const curriculum = curriculumRow[0];

  // Query 2: Subjects with grade level info
  const subjectRows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      description: subjects.description,
      gradeLevelId: subjects.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      units: subjects.units,
      sequenceOrder: subjects.sequenceOrder,
      isCore: subjects.isCore,
      deletedAt: subjects.deletedAt,
      createdAt: subjects.createdAt,
    })
    .from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(eq(subjects.curriculumId, id))
    .orderBy(asc(gradeLevels.order), asc(subjects.sequenceOrder), asc(subjects.name));

  // Query 3: Adoptions with school year and grade level info
  const adoptionRows = await db
    .select({
      id: curriculumAdoptions.id,
      schoolYearId: curriculumAdoptions.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      gradeLevelId: curriculumAdoptions.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      adoptedAt: curriculumAdoptions.adoptedAt,
      adoptedByName: users.username,
    })
    .from(curriculumAdoptions)
    .innerJoin(schoolYears, eq(curriculumAdoptions.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(curriculumAdoptions.gradeLevelId, gradeLevels.id))
    .leftJoin(users, eq(curriculumAdoptions.adoptedBy, users.id))
    .where(
      and(
        eq(curriculumAdoptions.curriculumId, id),
        isNull(curriculumAdoptions.deletedAt)
      )
    )
    .orderBy(desc(schoolYears.startDate), asc(gradeLevels.order));

  // Query 4: Get user names for audit fields in a single query using LEFT JOINs
  // Previously this was 3 separate queries (N+1 pattern) - now combined into one
  const [auditUsers] = await db
    .select({
      createdByName: sql<string | null>`created_user.username`,
      publishedByName: sql<string | null>`published_user.username`,
      archivedByName: sql<string | null>`archived_user.username`,
    })
    .from(curriculums)
    .leftJoin(
      sql`${users} AS created_user`,
      sql`${curriculums.createdBy} = created_user.id`
    )
    .leftJoin(
      sql`${users} AS published_user`,
      sql`${curriculums.publishedBy} = published_user.id`
    )
    .leftJoin(
      sql`${users} AS archived_user`,
      sql`${curriculums.archivedBy} = archived_user.id`
    )
    .where(eq(curriculums.id, id))
    .limit(1);

  return {
    ...curriculum,
    createdByName: auditUsers?.createdByName ?? null,
    publishedByName: auditUsers?.publishedByName ?? null,
    archivedByName: auditUsers?.archivedByName ?? null,
    subjects: subjectRows.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      description: s.description,
      gradeLevelId: s.gradeLevelId,
      gradeLevelName: s.gradeLevelName,
      units: s.units,
      sequenceOrder: s.sequenceOrder,
      isCore: s.isCore,
      isDeleted: s.deletedAt !== null,
      createdAt: s.createdAt,
    })),
    adoptions: adoptionRows.map((a) => ({
      id: a.id,
      schoolYearId: a.schoolYearId,
      schoolYearLabel: a.schoolYearLabel,
      gradeLevelId: a.gradeLevelId,
      gradeLevelName: a.gradeLevelName,
      isActiveYear: a.isActiveYear,
      adoptedAt: a.adoptedAt,
      adoptedByName: a.adoptedByName,
    })),
  };
}

/**
 * Get the version chain for a curriculum (all versions sharing the same rootId).
 */
export async function getCurriculumVersionChain(
  rootId: string
): Promise<CurriculumVersionRow[]> {
  const rows = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      status: curriculums.status,
      version: curriculums.version,
      publishedAt: curriculums.publishedAt,
      createdAt: curriculums.createdAt,
    })
    .from(curriculums)
    .where(eq(curriculums.rootId, rootId))
    .orderBy(asc(curriculums.version));

  return rows;
}

/**
 * Get the current curriculum for a specific grade level and school year.
 * Returns the adopted curriculum if one exists.
 */
export async function getCurrentCurriculumForGradeAndYear(
  schoolYearId: string,
  gradeLevelId: string
): Promise<CurriculumDetail | null> {
  const adoption = await db
    .select({ curriculumId: curriculumAdoptions.curriculumId })
    .from(curriculumAdoptions)
    .where(
      and(
        eq(curriculumAdoptions.schoolYearId, schoolYearId),
        eq(curriculumAdoptions.gradeLevelId, gradeLevelId),
        isNull(curriculumAdoptions.deletedAt)
      )
    )
    .limit(1);

  if (adoption.length === 0) {
    return null;
  }

  return getCurriculumById(adoption[0].curriculumId);
}

/**
 * Get the adoption matrix for a school year.
 * Returns one cell per grade level, with curriculum info if adopted.
 */
export async function getAdoptionMatrix(
  schoolYearId: string
): Promise<AdoptionMatrixCell[]> {
  // Get all grade levels
  const allGradeLevels = await db
    .select({
      id: gradeLevels.id,
      name: gradeLevels.name,
      order: gradeLevels.order,
    })
    .from(gradeLevels)
    .orderBy(asc(gradeLevels.order));

  // Get adoptions for this school year
  const adoptions = await db
    .select({
      gradeLevelId: curriculumAdoptions.gradeLevelId,
      curriculumId: curriculumAdoptions.curriculumId,
      adoptionId: curriculumAdoptions.id,
      adoptedAt: curriculumAdoptions.adoptedAt,
      curriculumName: curriculums.name,
      curriculumStatus: curriculums.status,
    })
    .from(curriculumAdoptions)
    .innerJoin(curriculums, eq(curriculumAdoptions.curriculumId, curriculums.id))
    .where(
      and(
        eq(curriculumAdoptions.schoolYearId, schoolYearId),
        isNull(curriculumAdoptions.deletedAt)
      )
    );

  // Build adoption map
  const adoptionMap = new Map(
    adoptions.map((a) => [a.gradeLevelId, a])
  );

  // Build matrix
  return allGradeLevels.map((gl) => {
    const adoption = adoptionMap.get(gl.id);
    return {
      gradeLevelId: gl.id,
      gradeLevelName: gl.name,
      gradeLevelOrder: gl.order,
      curriculumId: adoption?.curriculumId ?? null,
      curriculumName: adoption?.curriculumName ?? null,
      curriculumStatus: adoption?.curriculumStatus ?? null,
      adoptionId: adoption?.adoptionId ?? null,
      adoptedAt: adoption?.adoptedAt ?? null,
    };
  });
}

/**
 * Get published curriculums for dropdown selection.
 */
export async function getPublishedCurriculumsForDropdown(): Promise<
  CurriculumDropdownOption[]
> {
  const rows = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      status: curriculums.status,
      version: curriculums.version,
    })
    .from(curriculums)
    .where(eq(curriculums.status, "published"))
    .orderBy(asc(curriculums.name));

  return rows;
}

/**
 * Get subjects for a curriculum grouped by grade level.
 */
export async function getSubjectsByGradeLevelForCurriculum(
  curriculumId: string
): Promise<Map<string, SubjectListRow[]>> {
  const rows = await db
    .select({
      id: subjects.id,
      name: subjects.name,
      code: subjects.code,
      description: subjects.description,
      gradeLevelId: subjects.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      units: subjects.units,
      sequenceOrder: subjects.sequenceOrder,
      isCore: subjects.isCore,
      deletedAt: subjects.deletedAt,
      createdAt: subjects.createdAt,
    })
    .from(subjects)
    .leftJoin(gradeLevels, eq(subjects.gradeLevelId, gradeLevels.id))
    .where(
      and(eq(subjects.curriculumId, curriculumId), isNull(subjects.deletedAt))
    )
    .orderBy(asc(gradeLevels.order), asc(subjects.sequenceOrder), asc(subjects.name));

  const grouped = new Map<string, SubjectListRow[]>();

  for (const row of rows) {
    const gradeKey = row.gradeLevelId ?? "unassigned";
    const existing = grouped.get(gradeKey) ?? [];
    existing.push({
      id: row.id,
      name: row.name,
      code: row.code,
      description: row.description,
      gradeLevelId: row.gradeLevelId,
      gradeLevelName: row.gradeLevelName,
      units: row.units,
      sequenceOrder: row.sequenceOrder,
      isCore: row.isCore,
      isDeleted: row.deletedAt !== null,
      createdAt: row.createdAt,
    });
    grouped.set(gradeKey, existing);
  }

  return grouped;
}

/**
 * Check if a curriculum name is already used (among non-archived curriculums).
 */
export async function isCurriculumNameTaken(
  name: string,
  excludeId?: string
): Promise<boolean> {
  const conditions = [
    sql`LOWER(${curriculums.name}) = LOWER(${name})`,
    sql`${curriculums.status} != 'archived'`,
  ];

  if (excludeId) {
    conditions.push(sql`${curriculums.id} != ${excludeId}`);
  }

  const [result] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(curriculums)
    .where(and(...conditions));

  return (result?.count ?? 0) > 0;
}

/**
 * Get the active school year.
 */
export async function getActiveSchoolYear(): Promise<{
  id: string;
  label: string;
  startDate: Date;
} | null> {
  const [row] = await db
    .select({
      id: schoolYears.id,
      label: schoolYears.label,
      startDate: schoolYears.startDate,
    })
    .from(schoolYears)
    .where(eq(schoolYears.isActive, true))
    .limit(1);

  return row ?? null;
}

/**
 * Get published curriculum names (for validation).
 */
export async function getPublishedCurriculumNames(): Promise<string[]> {
  const rows = await db
    .select({ name: curriculums.name })
    .from(curriculums)
    .where(eq(curriculums.status, "published"));

  return rows.map((r) => r.name);
}

/**
 * Grade level option for dropdowns
 */
export type GradeLevelDropdownOption = {
  id: string;
  name: string;
};

/**
 * Get all grade levels for dropdown selection.
 */
export async function getGradeLevelsForDropdown(): Promise<
  GradeLevelDropdownOption[]
> {
  const rows = await db.query.gradeLevels.findMany({
    columns: { id: true, name: true },
    orderBy: (gl, { asc }) => [asc(gl.order)],
  });

  return rows;
}

/**
 * Get grade levels that are "locked" for a school year.
 * A grade level is locked when grades have been submitted or locked for that SY+grade combo.
 * Returns a Set of grade level IDs that should not allow curriculum changes.
 */
export async function getLockedGradeLevelsForSchoolYear(
  schoolYearId: string
): Promise<Set<string>> {
  // Find grade levels where submitted/locked grades exist for this school year
  // Path: gradeRecords -> teacherAssignments -> sections -> gradeLevelId
  const lockedRows = await db
    .selectDistinct({
      gradeLevelId: sections.gradeLevelId,
    })
    .from(gradeRecords)
    .innerJoin(
      teacherAssignments,
      eq(gradeRecords.teacherAssignmentId, teacherAssignments.id)
    )
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .where(
      and(
        eq(gradeRecords.schoolYearId, schoolYearId),
        sql`${gradeRecords.status} IN ('submitted', 'locked')`
      )
    );

  return new Set(lockedRows.map((r) => r.gradeLevelId));
}
