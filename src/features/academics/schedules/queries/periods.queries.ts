import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  periods,
  scheduleSlots,
  schoolYears,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, sql } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { PeriodView, PeriodOption, PeriodGradeGroup } from "../schedules.schema";
import { getPeriodGradeGroup } from "@/lib/constants/period-grade-groups";

// ─── Period Queries ──────────────────────────────────────────────────────────

/**
 * Get all periods for a school year.
 * Returns all periods ordered by grade group, grade level, and period number.
 */
export async function getPeriodsForSchoolYear(
  schoolYearId: string
): Promise<PeriodView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: periods.id,
      schoolYearId: periods.schoolYearId,
      schoolYearLabel: schoolYears.label,
      name: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
      gradeGroup: periods.gradeGroup,
      gradeLevelId: periods.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      isActive: periods.isActive,
      createdAt: periods.createdAt,
    })
    .from(periods)
    .innerJoin(schoolYears, eq(periods.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(periods.gradeLevelId, gradeLevels.id))
    .where(and(eq(periods.schoolYearId, schoolYearId), isNull(periods.deletedAt)))
    .orderBy(asc(periods.gradeGroup), asc(gradeLevels.order), asc(periods.periodNumber));

  return rows;
}

/**
 * Get a single period by ID.
 */
export async function getPeriodById(
  periodId: string
): Promise<PeriodView | null> {
  const rows = await db
    .select({
      id: periods.id,
      schoolYearId: periods.schoolYearId,
      schoolYearLabel: schoolYears.label,
      name: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
      gradeGroup: periods.gradeGroup,
      gradeLevelId: periods.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      isActive: periods.isActive,
      createdAt: periods.createdAt,
    })
    .from(periods)
    .innerJoin(schoolYears, eq(periods.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(periods.gradeLevelId, gradeLevels.id))
    .where(and(eq(periods.id, periodId), isNull(periods.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get periods for dropdown selection.
 * Only returns active class periods that apply to the given grade level.
 *
 * Returns periods where:
 * - Universal (gradeGroup=null AND gradeLevelId=null) OR
 * - Grade group matches the grade level's group OR
 * - Specific grade level matches exactly
 */
export async function getPeriodsForDropdown(
  schoolYearId: string,
  gradeLevelId?: string | null,
  gradeLevelName?: string | null
): Promise<PeriodOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  // Get the period grade group for the specified grade level
  const gradeGroup: PeriodGradeGroup | undefined = gradeLevelName
    ? getPeriodGradeGroup(gradeLevelName)
    : undefined;

  const rows = await db
    .select({
      id: periods.id,
      name: periods.name,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
      gradeGroup: periods.gradeGroup,
      gradeLevelId: periods.gradeLevelId,
    })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.isActive, true),
        eq(periods.isClassPeriod, true),
        isNull(periods.deletedAt)
      )
    )
    .orderBy(asc(periods.periodNumber));

  // Filter periods based on grade level applicability
  const filteredRows = rows.filter((row) => {
    // Universal periods (no gradeGroup and no gradeLevelId)
    if (row.gradeGroup === null && row.gradeLevelId === null) {
      return true;
    }

    // Grade group match (if caller provided a grade level name)
    if (row.gradeGroup !== null && gradeGroup === row.gradeGroup) {
      return true;
    }

    // Specific grade level match
    if (
      row.gradeLevelId !== null &&
      gradeLevelId !== undefined &&
      gradeLevelId !== null &&
      row.gradeLevelId === gradeLevelId
    ) {
      return true;
    }

    // If no gradeLevelId provided, include universal periods only
    if (gradeLevelId === undefined || gradeLevelId === null) {
      return row.gradeGroup === null && row.gradeLevelId === null;
    }

    return false;
  });

  return filteredRows.map((row) => ({
    value: row.id,
    label: `${row.name} (${row.startTime} - ${row.endTime})`,
    startTime: row.startTime,
    endTime: row.endTime,
    isClassPeriod: row.isClassPeriod,
  }));
}

/**
 * Check if a period has any schedule slots assigned.
 */
export async function getPeriodSlotCount(periodId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(scheduleSlots)
    .where(
      and(eq(scheduleSlots.periodId, periodId), isNull(scheduleSlots.deletedAt))
    );

  return Number(result[0]?.count ?? 0);
}
