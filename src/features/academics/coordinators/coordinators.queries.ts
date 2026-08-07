import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  coordinatorAssignments,
  schoolYears,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import { GRADE_GROUP_LABELS, type GradeGroup } from "@/lib/constants/grade-groups";
import type { CoordinatorView, CoordinatorUserOption } from "./coordinators.schema";

// ─── Get All Coordinator Assignments ─────────────────────────────────────────

/**
 * Get all coordinator assignments with user and school year info.
 * Ordered by school year (newest first), then grade group.
 */
export async function getCoordinatorAssignments(
  schoolYearId?: string
): Promise<CoordinatorView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SECTIONS);
  cacheLife("hours");

  const whereConditions = [isNull(coordinatorAssignments.deletedAt)];

  if (schoolYearId) {
    whereConditions.push(eq(coordinatorAssignments.schoolYearId, schoolYearId));
  }

  const rows = await db
    .select({
      id: coordinatorAssignments.id,
      userId: coordinatorAssignments.userId,
      userName: users.username,
      userEmail: users.email,
      gradeGroup: coordinatorAssignments.gradeGroup,
      schoolYearId: coordinatorAssignments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: coordinatorAssignments.createdAt,
    })
    .from(coordinatorAssignments)
    .innerJoin(users, eq(coordinatorAssignments.userId, users.id))
    .innerJoin(schoolYears, eq(coordinatorAssignments.schoolYearId, schoolYears.id))
    .where(and(...whereConditions))
    .orderBy(desc(schoolYears.startDate), asc(coordinatorAssignments.gradeGroup));

  return rows.map((row) => ({
    ...row,
    gradeGroupLabel: GRADE_GROUP_LABELS[row.gradeGroup as GradeGroup],
  }));
}

// ─── Get Coordinator For Grade Group ─────────────────────────────────────────

/**
 * Get the coordinator assigned to a specific grade group for a school year.
 * Returns null if no coordinator is assigned.
 */
export async function getCoordinatorForGradeGroup(
  gradeGroup: GradeGroup,
  schoolYearId: string
): Promise<CoordinatorView | null> {
  const [row] = await db
    .select({
      id: coordinatorAssignments.id,
      userId: coordinatorAssignments.userId,
      userName: users.username,
      userEmail: users.email,
      gradeGroup: coordinatorAssignments.gradeGroup,
      schoolYearId: coordinatorAssignments.schoolYearId,
      schoolYearLabel: schoolYears.label,
      isActiveYear: schoolYears.isActive,
      createdAt: coordinatorAssignments.createdAt,
    })
    .from(coordinatorAssignments)
    .innerJoin(users, eq(coordinatorAssignments.userId, users.id))
    .innerJoin(schoolYears, eq(coordinatorAssignments.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(coordinatorAssignments.gradeGroup, gradeGroup),
        eq(coordinatorAssignments.schoolYearId, schoolYearId),
        isNull(coordinatorAssignments.deletedAt)
      )
    )
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    gradeGroupLabel: GRADE_GROUP_LABELS[row.gradeGroup as GradeGroup],
  };
}

// ─── Get Available Coordinators ──────────────────────────────────────────────

// Re-export from shared module for backwards compatibility
export { getAvailableCoordinators } from "../shared/user-queries";

// ─── Get Grade Groups With Assignments ───────────────────────────────────────

/**
 * Get all grade groups with their assignment status for a school year.
 */
export async function getGradeGroupsWithAssignments(
  schoolYearId: string
): Promise<{
  gradeGroup: GradeGroup;
  label: string;
  coordinatorId: string | null;
  coordinatorName: string | null;
}[]> {
  const assignments = await db
    .select({
      gradeGroup: coordinatorAssignments.gradeGroup,
      coordinatorId: coordinatorAssignments.id,
      coordinatorName: users.username,
    })
    .from(coordinatorAssignments)
    .innerJoin(users, eq(coordinatorAssignments.userId, users.id))
    .where(
      and(
        eq(coordinatorAssignments.schoolYearId, schoolYearId),
        isNull(coordinatorAssignments.deletedAt)
      )
    );

  const assignmentMap = new Map(
    assignments.map((a) => [a.gradeGroup, { id: a.coordinatorId, name: a.coordinatorName }])
  );

  return (["casa", "lower_elem", "higher_elem", "jhs", "shs"] as GradeGroup[]).map((group) => ({
    gradeGroup: group,
    label: GRADE_GROUP_LABELS[group],
    coordinatorId: assignmentMap.get(group)?.id ?? null,
    coordinatorName: assignmentMap.get(group)?.name ?? null,
  }));
}
