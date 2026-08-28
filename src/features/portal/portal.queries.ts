import "server-only";

/**
 * Portal Queries
 *
 * Database queries for the student portal.
 * All queries accept studentId from the validated session (not user input).
 */

import { db } from "@/lib/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  assessments,
  enrollments,
  gradeLevels,
  gradeSheetEntries,
  gradeSheets,
  schoolYears,
  sections,
  subjects,
} from "@/lib/db/schema";
import type { GradeSheetStatus } from "@/lib/constants/grading-periods";
import { calculateOffset } from "@/lib/types/pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PortalAssessmentRow = {
  id: string;
  schoolYearId: string;
  schoolYear: string;
  gradeLevelName: string;
  totalAmount: string;
  totalPaid: string;
  balance: string;
  billingStatus: string;
};

export type PortalGradeRow = {
  id: string;
  schoolYearId: string;
  schoolYearLabel: string;
  schoolYearStart: Date;
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  gradingPeriod: string;
  grade: string | null;
  status: string;
};

export type SectionGrades = {
  schoolYearLabel: string;
  sectionName: string;
  gradeLevelName: string;
  subjects: Array<{ code: string; name: string }>;
  periods: string[];
  grades: Map<string, Map<string, string | null>>; // period -> subjectCode -> grade
};

export type PortalGradesResult = {
  sections: SectionGrades[];
  totalSections: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Only show grades from published or locked grade sheets */
const VISIBLE_GRADE_STATUSES: GradeSheetStatus[] = ["published", "locked"];

/** Default page size for portal grades */
export const PORTAL_GRADES_PAGE_SIZE = 100;

// ─── Assessment Queries ───────────────────────────────────────────────────────

/**
 * Get all assessments for a student.
 * Ordered by school year (most recent first).
 */
export async function getStudentAssessments(
  studentId: string
): Promise<PortalAssessmentRow[]> {
  const rows = await db
    .select({
      id: assessments.id,
      schoolYearId: assessments.schoolYearId,
      schoolYear: schoolYears.label,
      gradeLevelName: gradeLevels.name,
      totalAmount: assessments.totalAmount,
      totalPaid: assessments.totalPaid,
      balance: assessments.balance,
      billingStatus: assessments.billingStatus,
    })
    .from(assessments)
    .innerJoin(schoolYears, eq(assessments.schoolYearId, schoolYears.id))
    .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(eq(assessments.studentId, studentId))
    .orderBy(desc(schoolYears.startDate));

  return rows;
}

// ─── Grade Queries ────────────────────────────────────────────────────────────

/**
 * Get paginated grades for a student.
 * Returns grades grouped by section/school year.
 *
 * @param studentId - Student ID from validated session
 * @param page - Page number (1-indexed)
 * @param pageSize - Number of sections per page
 */
export async function getStudentGrades(
  studentId: string,
  page: number = 1,
  pageSize: number = PORTAL_GRADES_PAGE_SIZE
): Promise<PortalGradesResult> {
  // Base where clause for all queries
  const whereClause = and(
    eq(gradeSheetEntries.studentId, studentId),
    inArray(gradeSheets.status, VISIBLE_GRADE_STATUSES)
  );

  // Step 1: Count distinct school year + section combinations and get paginated sections
  const [countResult, distinctSections] = await Promise.all([
    db
      .select({
        count: sql<number>`COUNT(DISTINCT CONCAT(${gradeSheets.schoolYearId}, '-', ${gradeSheets.sectionId}))`,
      })
      .from(gradeSheetEntries)
      .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
      .where(whereClause)
      .then((r) => r[0]),

    db
      .selectDistinct({
        schoolYearId: gradeSheets.schoolYearId,
        sectionId: gradeSheets.sectionId,
        schoolYearStart: schoolYears.startDate,
        gradeLevelOrder: gradeLevels.order,
      })
      .from(gradeSheetEntries)
      .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
      .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
      .where(whereClause)
      .orderBy(desc(schoolYears.startDate), asc(gradeLevels.order))
      .limit(pageSize)
      .offset(calculateOffset(page, pageSize)),
  ]);

  const totalSections = Number(countResult?.count ?? 0);

  // If no sections, return empty result
  if (distinctSections.length === 0) {
    return { sections: [], totalSections };
  }

  // Step 2: Build filter for visible sections
  const sectionKeys = distinctSections.map(
    (s) => `${s.schoolYearId}-${s.sectionId}`
  );

  // Step 3: Fetch all grade entries for the visible sections
  const rows = await db
    .select({
      id: gradeSheetEntries.id,
      schoolYearId: gradeSheets.schoolYearId,
      schoolYearLabel: schoolYears.label,
      schoolYearStart: schoolYears.startDate,
      sectionId: gradeSheets.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      subjectId: gradeSheetEntries.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      gradingPeriod: gradeSheets.gradingPeriod,
      grade: gradeSheetEntries.grade,
      status: gradeSheets.status,
    })
    .from(gradeSheetEntries)
    .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
    .innerJoin(subjects, eq(gradeSheetEntries.subjectId, subjects.id))
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
    .where(
      and(
        whereClause,
        sql`CONCAT(${gradeSheets.schoolYearId}, '-', ${gradeSheets.sectionId}) IN (${sql.join(
          sectionKeys.map((k) => sql`${k}`),
          sql`, `
        )})`
      )
    )
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(subjects.code),
      asc(gradeSheets.gradingPeriod)
    );

  // Step 4: Group data by school year + section
  const groupedSections = groupGradesBySection(rows);

  return {
    sections: groupedSections,
    totalSections,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Group grade rows by section/school year.
 * Extracted for testability and reuse.
 */
export function groupGradesBySection(rows: PortalGradeRow[]): SectionGrades[] {
  const groupedData = new Map<string, {
    schoolYearLabel: string;
    sectionName: string;
    gradeLevelName: string;
    subjects: Map<string, { code: string; name: string }>;
    periods: Set<string>;
    grades: Map<string, Map<string, string | null>>;
  }>();

  for (const row of rows) {
    const key = `${row.schoolYearId}-${row.sectionId}`;

    if (!groupedData.has(key)) {
      groupedData.set(key, {
        schoolYearLabel: row.schoolYearLabel,
        sectionName: row.sectionName,
        gradeLevelName: row.gradeLevelName,
        subjects: new Map(),
        periods: new Set(),
        grades: new Map(),
      });
    }

    const group = groupedData.get(key)!;

    // Add subject
    if (!group.subjects.has(row.subjectCode)) {
      group.subjects.set(row.subjectCode, { code: row.subjectCode, name: row.subjectName });
    }

    // Add period
    group.periods.add(row.gradingPeriod);

    // Add grade
    if (!group.grades.has(row.gradingPeriod)) {
      group.grades.set(row.gradingPeriod, new Map());
    }
    group.grades.get(row.gradingPeriod)!.set(row.subjectCode, row.grade);
  }

  // Convert to array and sort subjects by code
  return Array.from(groupedData.values()).map((group) => ({
    ...group,
    subjects: Array.from(group.subjects.values()).sort((a, b) =>
      a.code.localeCompare(b.code)
    ),
    periods: Array.from(group.periods).sort(),
  }));
}
