import "server-only";

/**
 * Director's List Queries
 *
 * Queries for calculating GWA and ranking students who qualify for Director's List.
 * GWA is calculated from published/locked grade sheet entries.
 */

import { db } from "@/lib/db";
import { sql, eq, and, inArray, isNull, asc, desc } from "drizzle-orm";
import {
  gradeSheets,
  gradeSheetEntries,
  students,
  sections,
  gradeLevels,
  schoolYears,
} from "@/lib/db/schema";
import { cacheTag, cacheLife } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import { getGradeGroup, type GradeGroup, GRADE_GROUPS } from "@/lib/constants/grade-groups";
import { getGradingSystemType } from "@/features/academics/grades/shs.queries";
import { QUARTERLY_PERIODS, TRIMESTER_PERIODS, GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";
import type { GradingPeriod } from "@/lib/constants/grading-periods";
import {
  DIRECTORS_LIST_THRESHOLDS,
  qualifiesForDirectorsList,
} from "./directors-list.types";
import type {
  DirectorsListEntry,
  DirectorsListResult,
  DirectorsListSummary,
  DirectorsListFilter,
} from "./directors-list.schema";

// ─── Raw GWA Entry Type ──────────────────────────────────────────────────────

interface RawGwaEntry {
  studentId: string;
  studentRef: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  gradingPeriod: string;
  gwa: number;
  subjectCount: number;
}

// ─── Main Query ──────────────────────────────────────────────────────────────

/**
 * Get Director's List entries for a school year and grading period.
 *
 * Calculates GWA from all subjects per student per grading period where
 * grade sheets are published or locked. Filters to students meeting their
 * academic level's threshold.
 */
export async function getDirectorsList(
  filter: DirectorsListFilter
): Promise<DirectorsListResult> {
  "use cache";
  cacheTag(CACHE_TAGS.DIRECTORS_LIST);
  cacheLife("hours");

  const { schoolYearId, gradingPeriod, gradeLevelId, sectionId } = filter;

  if (!schoolYearId || !gradingPeriod) {
    return {
      entries: [],
      summary: {
        totalQualifying: 0,
        byGradeGroup: Object.fromEntries(GRADE_GROUPS.map((g) => [g, 0])) as Record<GradeGroup, number>,
        topPerformer: null,
      },
      filters: {
        schoolYearId: schoolYearId ?? "",
        schoolYearLabel: "",
        gradingPeriod: gradingPeriod ?? "",
        gradeLevelId: gradeLevelId ?? null,
        gradeLevelName: null,
        sectionId: sectionId ?? null,
        sectionName: null,
      },
    };
  }

  // Build dynamic conditions
  const conditions = [
    eq(gradeSheets.schoolYearId, schoolYearId),
    sql`${gradeSheets.gradingPeriod} = ${gradingPeriod}`,
    inArray(gradeSheets.status, ["published", "locked"]),
    sql`${gradeSheetEntries.grade} IS NOT NULL`,
    isNull(students.deletedAt),
  ];

  if (gradeLevelId) {
    conditions.push(eq(sections.gradeLevelId, gradeLevelId));
  }

  if (sectionId) {
    conditions.push(eq(sections.id, sectionId));
  }

  // Query raw GWA data
  const rawEntries = await db
    .select({
      studentId: students.id,
      studentRef: students.referenceNumber,
      firstName: students.firstName,
      middleName: students.middleName,
      lastName: students.lastName,
      sectionId: sections.id,
      sectionName: sections.name,
      gradeLevelId: gradeLevels.id,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      gradingPeriod: gradeSheets.gradingPeriod,
      // Calculate GWA as average of all subject grades
      gwa: sql<number>`ROUND(AVG(${gradeSheetEntries.grade}::numeric), 2)`,
      subjectCount: sql<number>`COUNT(DISTINCT ${gradeSheetEntries.subjectId})::int`,
    })
    .from(gradeSheetEntries)
    .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
    .innerJoin(students, eq(gradeSheetEntries.studentId, students.id))
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(and(...conditions))
    .groupBy(
      students.id,
      students.referenceNumber,
      students.firstName,
      students.middleName,
      students.lastName,
      sections.id,
      sections.name,
      gradeLevels.id,
      gradeLevels.name,
      gradeLevels.order,
      gradeSheets.gradingPeriod
    )
    .orderBy(
      asc(gradeLevels.order),
      asc(sections.name),
      desc(sql`AVG(${gradeSheetEntries.grade}::numeric)`),
      asc(students.referenceNumber)
    ) as RawGwaEntry[];

  // Filter to qualifying students and add threshold/group info
  const qualifyingEntries: DirectorsListEntry[] = [];
  const byGradeGroup: Record<GradeGroup, number> = {
    casa: 0,
    lower_elem: 0,
    higher_elem: 0,
    jhs: 0,
    shs: 0,
  };

  // First pass: collect all qualifying entries with their GWA
  const preEntries: Array<{
    entry: RawGwaEntry;
    gradeGroup: GradeGroup;
    gwa: number;
    subjectCount: number;
    threshold: number;
  }> = [];

  for (const entry of rawEntries) {
    const gradeGroup = getGradeGroup(entry.gradeLevelName);
    if (!gradeGroup) continue;

    // PostgreSQL returns numeric as string, convert to number
    const gwa = Number(entry.gwa);
    const subjectCount = Number(entry.subjectCount);

    const threshold = DIRECTORS_LIST_THRESHOLDS[gradeGroup];
    if (gwa < threshold) continue;

    byGradeGroup[gradeGroup]++;
    preEntries.push({ entry, gradeGroup, gwa, subjectCount, threshold });
  }

  // Determine ranking strategy:
  // - Global list (no grade level filter): rank by GWA descending across all
  // - Filtered by grade level: rank within grade level (or section if specified)
  const useGlobalRanking = !gradeLevelId;

  if (useGlobalRanking) {
    // Sort all entries by GWA descending for global ranking
    preEntries.sort((a, b) => {
      if (b.gwa !== a.gwa) return b.gwa - a.gwa;
      return a.entry.studentRef.localeCompare(b.entry.studentRef);
    });

    // Assign global ranks (same GWA = same rank)
    let globalRank = 0;
    let lastGwa = -1;
    let count = 0;

    for (const { entry, gradeGroup, gwa, subjectCount, threshold } of preEntries) {
      count++;
      if (gwa !== lastGwa) {
        globalRank = count;
        lastGwa = gwa;
      }

      qualifyingEntries.push({
        studentId: entry.studentId,
        studentRef: entry.studentRef,
        firstName: entry.firstName,
        middleName: entry.middleName,
        lastName: entry.lastName,
        studentName: formatStudentName(entry.firstName, entry.middleName, entry.lastName),
        sectionId: entry.sectionId,
        sectionName: entry.sectionName,
        gradeLevelId: entry.gradeLevelId,
        gradeLevelName: entry.gradeLevelName,
        gradeLevelOrder: Number(entry.gradeLevelOrder),
        gradeGroup,
        gradingPeriod: entry.gradingPeriod,
        gwa,
        subjectCount,
        rank: globalRank,
        threshold,
      });
    }
  } else {
    // Rank within grade level + section (original behavior)
    const rankTrackers = new Map<string, { lastGwa: number; rank: number; count: number }>();

    for (const { entry, gradeGroup, gwa, subjectCount, threshold } of preEntries) {
      // Calculate rank within section (or grade level if no section filter)
      const rankKey = sectionId
        ? entry.sectionId
        : entry.gradeLevelId;
      let tracker = rankTrackers.get(rankKey);
      if (!tracker) {
        tracker = { lastGwa: -1, rank: 0, count: 0 };
        rankTrackers.set(rankKey, tracker);
      }

      tracker.count++;
      if (gwa !== tracker.lastGwa) {
        tracker.rank = tracker.count;
        tracker.lastGwa = gwa;
      }

      qualifyingEntries.push({
        studentId: entry.studentId,
        studentRef: entry.studentRef,
        firstName: entry.firstName,
        middleName: entry.middleName,
        lastName: entry.lastName,
        studentName: formatStudentName(entry.firstName, entry.middleName, entry.lastName),
        sectionId: entry.sectionId,
        sectionName: entry.sectionName,
        gradeLevelId: entry.gradeLevelId,
        gradeLevelName: entry.gradeLevelName,
        gradeLevelOrder: Number(entry.gradeLevelOrder),
        gradeGroup,
        gradingPeriod: entry.gradingPeriod,
        gwa,
        subjectCount,
        rank: tracker.rank,
        threshold,
      });
    }
  }

  // Get filter labels
  const [schoolYear, gradeLevel, section] = await Promise.all([
    db.query.schoolYears.findFirst({
      where: eq(schoolYears.id, schoolYearId),
      columns: { label: true },
    }),
    gradeLevelId
      ? db.query.gradeLevels.findFirst({
          where: eq(gradeLevels.id, gradeLevelId),
          columns: { name: true },
        })
      : null,
    sectionId
      ? db.query.sections.findFirst({
          where: eq(sections.id, sectionId),
          columns: { name: true },
        })
      : null,
  ]);

  const summary: DirectorsListSummary = {
    totalQualifying: qualifyingEntries.length,
    byGradeGroup,
    topPerformer: qualifyingEntries.length > 0 ? qualifyingEntries[0] : null,
  };

  return {
    entries: qualifyingEntries,
    summary,
    filters: {
      schoolYearId,
      schoolYearLabel: schoolYear?.label ?? "",
      gradingPeriod,
      gradeLevelId: gradeLevelId ?? null,
      gradeLevelName: gradeLevel?.name ?? null,
      sectionId: sectionId ?? null,
      sectionName: section?.name ?? null,
    },
  };
}

// ─── Top Performers Query ────────────────────────────────────────────────────

/**
 * Get top N performers for dashboard widget.
 * Returns the highest GWA students across all grade levels.
 */
export async function getTopPerformers(
  schoolYearId: string,
  gradingPeriod: string,
  limit: number = 5
): Promise<DirectorsListEntry[]> {
  "use cache";
  cacheTag(CACHE_TAGS.DIRECTORS_LIST);
  cacheLife("hours");

  const result = await getDirectorsList({
    schoolYearId,
    gradingPeriod,
  });

  // Sort by GWA descending across all entries, then take top N
  const sorted = [...result.entries].sort((a, b) => {
    if (b.gwa !== a.gwa) return b.gwa - a.gwa;
    return a.studentRef.localeCompare(b.studentRef);
  });

  return sorted.slice(0, limit);
}

// ─── Available Periods Query ─────────────────────────────────────────────────

/**
 * Get available grading periods for a school year.
 * Based on the school year's grading system (quarterly or trimester).
 */
export async function getAvailableGradingPeriods(
  schoolYearId: string
): Promise<{ value: string; label: string }[]> {
  const systemType = await getGradingSystemType(schoolYearId);
  const periods = systemType === "trimester" ? TRIMESTER_PERIODS : QUARTERLY_PERIODS;

  return periods.map((p) => ({
    value: p,
    label: GRADING_PERIOD_LABELS[p as GradingPeriod],
  }));
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Format student name as "Last, First M."
 */
function formatStudentName(
  firstName: string,
  middleName: string | null,
  lastName: string
): string {
  const middleInitial = middleName ? ` ${middleName.charAt(0)}.` : "";
  return `${lastName}, ${firstName}${middleInitial}`;
}

// ─── Export for Report Generation ────────────────────────────────────────────

export { getGradingSystemType };
