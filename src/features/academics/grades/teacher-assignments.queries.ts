import "server-only";

/**
 * Teacher Assignments Queries
 *
 * Legacy queries for teacher assignments management.
 * The teacher assignment workflow is secondary to the adviser-based grade sheet workflow.
 */

import { db } from "@/lib/db";
import { eq, and, asc, desc, isNull, sql } from "drizzle-orm";
import {
  teacherAssignments,
  users,
  subjects,
  sections,
  gradeLevels,
  schoolYears,
  subjectOfferings,
} from "@/lib/db/schema";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { calculatePagination, calculateOffset } from "@/lib/types/pagination";

// ─── Type Definitions ────────────────────────────────────────────────────────

/**
 * Teacher assignment row for the assignments management page
 */
export type TeacherAssignmentListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  schoolYearId: string;
  schoolYearLabel: string;
  isActiveYear: boolean;
  createdAt: Date;
};

// ─── Teacher Assignment Queries ──────────────────────────────────────────────

/**
 * Check if a teacher is assigned to a section.
 * Checks both legacy teacherAssignments table and new subjectOfferings table.
 */
export async function isTeacherAssignedToSection(
  teacherId: string,
  sectionId: string,
  schoolYearId: string
): Promise<boolean> {
  // Check legacy teacherAssignments table
  const [legacyAssignment] = await db
    .select({ id: teacherAssignments.id })
    .from(teacherAssignments)
    .where(
      and(
        eq(teacherAssignments.teacherId, teacherId),
        eq(teacherAssignments.sectionId, sectionId),
        eq(teacherAssignments.schoolYearId, schoolYearId),
        isNull(teacherAssignments.deletedAt)
      )
    )
    .limit(1);

  if (legacyAssignment) {
    return true;
  }

  // Check new subjectOfferings table
  const [subjectOfferingAssignment] = await db
    .select({ id: subjectOfferings.id })
    .from(subjectOfferings)
    .where(
      and(
        eq(subjectOfferings.teacherId, teacherId),
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .limit(1);

  return !!subjectOfferingAssignment;
}

/**
 * Get all teacher assignments with full details for the management page.
 *
 * @deprecated Use getPaginatedTeacherAssignments for large datasets.
 * This function loads all records into memory which may cause performance issues.
 */
export async function getAllTeacherAssignments(
  schoolYearId?: string
): Promise<TeacherAssignmentListItem[]> {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      "[DEPRECATED] getAllTeacherAssignments() loads all records into memory. " +
        "Use getPaginatedTeacherAssignments() instead for better performance."
    );
  }

  const whereConditions = [isNull(teacherAssignments.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(teacherAssignments.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      id: teacherAssignments.id,
      teacherId: teacherAssignments.teacherId,
      teacherName: users.username,
      teacherEmail: users.email,
      subjectId: teacherAssignments.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      sectionId: teacherAssignments.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      schoolYearId: teacherAssignments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: teacherAssignments.createdAt,
    })
    .from(teacherAssignments)
    .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
    .where(and(...whereConditions))
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(sections.name),
      asc(subjects.name)
    );

  return rows as TeacherAssignmentListItem[];
}

/**
 * Get paginated teacher assignments with full details.
 * Recommended for the management page to avoid loading all records into memory.
 */
export async function getPaginatedTeacherAssignments(
  pagination: PaginationParams,
  schoolYearId?: string
): Promise<PaginatedResult<TeacherAssignmentListItem>> {
  const whereConditions = [isNull(teacherAssignments.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(teacherAssignments.schoolYearId, schoolYearId));
  }

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teacherAssignments)
      .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
      .where(and(...whereConditions)),
    db
      .select({
        id: teacherAssignments.id,
        teacherId: teacherAssignments.teacherId,
        teacherName: users.username,
        teacherEmail: users.email,
        subjectId: teacherAssignments.subjectId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        sectionId: teacherAssignments.sectionId,
        sectionName: sections.name,
        gradeLevelName: gradeLevels.name,
        gradeLevelOrder: gradeLevels.order,
        schoolYearId: teacherAssignments.schoolYearId,
        schoolYearLabel: schoolYears.label,
        isActiveYear: schoolYears.isActive,
        createdAt: teacherAssignments.createdAt,
      })
      .from(teacherAssignments)
      .innerJoin(users, eq(teacherAssignments.teacherId, users.id))
      .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
      .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(teacherAssignments.schoolYearId, schoolYears.id))
      .where(and(...whereConditions))
      .orderBy(
        desc(schoolYears.startDate),
        asc(gradeLevels.order),
        asc(sections.name),
        asc(subjects.name)
      )
      .limit(pagination.pageSize)
      .offset(calculateOffset(pagination.page, pagination.pageSize)),
  ]);

  return {
    data: rows as TeacherAssignmentListItem[],
    pagination: calculatePagination(pagination.page, pagination.pageSize, countResult[0]?.count ?? 0),
  };
}
