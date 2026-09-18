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
import type { PeriodView, PeriodOption } from "../schedules.schema";

// ─── Period Queries ──────────────────────────────────────────────────────────

/**
 * Get all periods for a school year, optionally filtered by grade level.
 * Ordered by period number.
 */
export async function getPeriodsForSchoolYear(
  schoolYearId: string,
  gradeLevelId?: string | null
): Promise<PeriodView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  const conditions = [
    eq(periods.schoolYearId, schoolYearId),
    isNull(periods.deletedAt),
  ];

  // If gradeLevelId is provided, filter by it OR null (universal periods)
  if (gradeLevelId !== undefined) {
    if (gradeLevelId === null) {
      conditions.push(isNull(periods.gradeLevelId));
    } else {
      conditions.push(
        sql`(${periods.gradeLevelId} = ${gradeLevelId} OR ${periods.gradeLevelId} IS NULL)`
      );
    }
  }

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
      gradeLevelId: periods.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      isActive: periods.isActive,
      createdAt: periods.createdAt,
    })
    .from(periods)
    .innerJoin(schoolYears, eq(periods.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(periods.gradeLevelId, gradeLevels.id))
    .where(and(...conditions))
    .orderBy(asc(gradeLevels.order), asc(periods.periodNumber));

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
 * Only returns active class periods.
 */
export async function getPeriodsForDropdown(
  schoolYearId: string,
  gradeLevelId?: string | null
): Promise<PeriodOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  const conditions = [
    eq(periods.schoolYearId, schoolYearId),
    eq(periods.isActive, true),
    eq(periods.isClassPeriod, true),
    isNull(periods.deletedAt),
  ];

  if (gradeLevelId !== undefined && gradeLevelId !== null) {
    conditions.push(
      sql`(${periods.gradeLevelId} = ${gradeLevelId} OR ${periods.gradeLevelId} IS NULL)`
    );
  }

  const rows = await db
    .select({
      id: periods.id,
      name: periods.name,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
    })
    .from(periods)
    .where(and(...conditions))
    .orderBy(asc(periods.periodNumber));

  return rows.map((row) => ({
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
