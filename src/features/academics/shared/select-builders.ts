import "server-only";

import {
  sections,
  gradeLevels,
  schoolYears,
  users,
} from "@/lib/db/schema";

/**
 * Shared Select Object Builders
 *
 * Reusable SELECT configurations for common join patterns across
 * academics queries. Use spread operator to include these in your selects.
 *
 * @example
 * ```ts
 * const rows = await db
 *   .select({
 *     id: sectionAdvisers.id,
 *     ...sectionContextSelect,
 *     ...userInfoSelect(users),
 *     createdAt: sectionAdvisers.createdAt,
 *   })
 *   .from(sectionAdvisers)
 *   .innerJoin(sections, eq(sectionAdvisers.sectionId, sections.id))
 *   .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
 *   .innerJoin(schoolYears, eq(sectionAdvisers.schoolYearId, schoolYears.id))
 *   .innerJoin(users, eq(sectionAdvisers.userId, users.id));
 * ```
 */

/**
 * Section fields with grade level and school year context.
 * Use when joining sections → gradeLevels → schoolYears.
 */
export const sectionContextSelect = {
  sectionId: sections.id,
  sectionName: sections.name,
  gradeLevelId: sections.gradeLevelId,
  gradeLevelName: gradeLevels.name,
  gradeLevelOrder: gradeLevels.order,
  schoolYearId: sections.schoolYearId,
  schoolYearLabel: schoolYears.label,
  isActiveYear: schoolYears.isActive,
} as const;

/**
 * Basic section fields without school year context.
 * Use when school year comes from another table.
 */
export const sectionBaseSelect = {
  sectionId: sections.id,
  sectionName: sections.name,
  gradeLevelId: sections.gradeLevelId,
  gradeLevelName: gradeLevels.name,
  gradeLevelOrder: gradeLevels.order,
} as const;

/**
 * School year fields.
 * Use when school year is joined separately.
 */
export const schoolYearSelect = {
  schoolYearId: schoolYears.id,
  schoolYearLabel: schoolYears.label,
  isActiveYear: schoolYears.isActive,
} as const;

/**
 * User information fields (username, email).
 * Use when joining users table for audit or assignment info.
 */
export const userInfoSelect = {
  userName: users.username,
  userEmail: users.email,
} as const;

/**
 * Grade level fields for academic context.
 */
export const gradeLevelSelect = {
  gradeLevelId: gradeLevels.id,
  gradeLevelName: gradeLevels.name,
  gradeLevelOrder: gradeLevels.order,
} as const;
