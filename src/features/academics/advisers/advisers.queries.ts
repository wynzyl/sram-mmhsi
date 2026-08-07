import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  sectionAdvisers,
  sections,
  gradeLevels,
  schoolYears,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { AdviserView, TeacherOption, SectionOption } from "./advisers.schema";

// ─── Get All Adviser Assignments ─────────────────────────────────────────────

/**
 * Get all adviser assignments with section, user, and school year info.
 * Ordered by school year (newest first), then grade level, then section name.
 */
export async function getAdviserAssignments(
  schoolYearId?: string
): Promise<AdviserView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SECTIONS);
  cacheLife("hours");

  const whereConditions = [isNull(sectionAdvisers.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(sectionAdvisers.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      id: sectionAdvisers.id,
      sectionId: sectionAdvisers.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      userId: sectionAdvisers.userId,
      userName: users.username,
      userEmail: users.email,
      schoolYearId: sectionAdvisers.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: sectionAdvisers.createdAt,
    })
    .from(sectionAdvisers)
    .innerJoin(sections, eq(sectionAdvisers.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sectionAdvisers.schoolYearId, schoolYears.id))
    .innerJoin(users, eq(sectionAdvisers.userId, users.id))
    .where(and(...whereConditions))
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(sections.name)
    );

  return rows;
}

// ─── Get Adviser For Section ─────────────────────────────────────────────────

/**
 * Get the adviser assigned to a specific section for a school year.
 * Returns null if no adviser is assigned.
 */
export async function getAdviserForSection(
  sectionId: string,
  schoolYearId: string
): Promise<AdviserView | null> {
  const [row] = await db
    .select({
      id: sectionAdvisers.id,
      sectionId: sectionAdvisers.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      userId: sectionAdvisers.userId,
      userName: users.username,
      userEmail: users.email,
      schoolYearId: sectionAdvisers.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: sectionAdvisers.createdAt,
    })
    .from(sectionAdvisers)
    .innerJoin(sections, eq(sectionAdvisers.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sectionAdvisers.schoolYearId, schoolYears.id))
    .innerJoin(users, eq(sectionAdvisers.userId, users.id))
    .where(
      and(
        eq(sectionAdvisers.sectionId, sectionId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

// ─── Get Sections Advised By User ────────────────────────────────────────────

/**
 * Get all sections where a user is the adviser for a school year.
 * Used for teacher's grade entry view.
 */
export async function getAdviserSections(
  userId: string,
  schoolYearId: string
): Promise<AdviserView[]> {
  const rows = await db
    .select({
      id: sectionAdvisers.id,
      sectionId: sectionAdvisers.sectionId,
      sectionName: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      userId: sectionAdvisers.userId,
      userName: users.username,
      userEmail: users.email,
      schoolYearId: sectionAdvisers.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: sectionAdvisers.createdAt,
    })
    .from(sectionAdvisers)
    .innerJoin(sections, eq(sectionAdvisers.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sectionAdvisers.schoolYearId, schoolYears.id))
    .innerJoin(users, eq(sectionAdvisers.userId, users.id))
    .where(
      and(
        eq(sectionAdvisers.userId, userId),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows;
}

// ─── Get Available Teachers ──────────────────────────────────────────────────

// Re-export from shared module for backwards compatibility
export { getAvailableTeachers } from "../shared/user-queries";

// ─── Get Sections For Assignment ─────────────────────────────────────────────

/**
 * Get all sections with their adviser status for a school year.
 * Used for adviser assignment form - shows which sections already have advisers.
 */
export async function getSectionsForAdviserAssignment(
  schoolYearId: string
): Promise<SectionOption[]> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelName: gradeLevels.name,
      schoolYearId: sections.schoolYearId,
      schoolYearLabel: schoolYears.label,
      adviserId: sectionAdvisers.id,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
    .leftJoin(
      sectionAdvisers,
      and(
        eq(sectionAdvisers.sectionId, sections.id),
        eq(sectionAdvisers.schoolYearId, schoolYearId),
        isNull(sectionAdvisers.deletedAt)
      )
    )
    .where(
      and(
        eq(sections.schoolYearId, schoolYearId),
        isNull(sections.deletedAt)
      )
    )
    .orderBy(asc(gradeLevels.order), asc(sections.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    gradeLevelName: row.gradeLevelName,
    schoolYearId: row.schoolYearId,
    schoolYearLabel: row.schoolYearLabel,
    hasAdviser: row.adviserId !== null,
  }));
}
