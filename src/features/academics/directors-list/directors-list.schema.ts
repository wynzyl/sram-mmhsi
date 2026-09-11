/**
 * Director's List Schemas
 *
 * Zod schemas for filter validation and TypeScript interfaces for query results.
 */

import { z } from "zod";
import type { GradeGroup } from "@/lib/constants/grade-groups";

// ─── Filter Schema ───────────────────────────────────────────────────────────

/**
 * Schema for Director's List filter parameters.
 */
export const directorsListFilterSchema = z.object({
  schoolYearId: z.string().uuid().optional(),
  gradingPeriod: z.string().optional(),
  gradeLevelId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
});

export type DirectorsListFilter = z.infer<typeof directorsListFilterSchema>;

// ─── Query Result Types ──────────────────────────────────────────────────────

/**
 * A single student's Director's List entry.
 */
export interface DirectorsListEntry {
  /** Student ID */
  studentId: string;
  /** Student reference number (e.g., STU-00001) */
  studentRef: string;
  /** Student first name */
  firstName: string;
  /** Student middle name */
  middleName: string | null;
  /** Student last name */
  lastName: string;
  /** Full student name (formatted) */
  studentName: string;
  /** Section ID */
  sectionId: string;
  /** Section name */
  sectionName: string;
  /** Grade level ID */
  gradeLevelId: string;
  /** Grade level name */
  gradeLevelName: string;
  /** Grade level order (for sorting) */
  gradeLevelOrder: number;
  /** Grade group (casa, lower_elem, etc.) */
  gradeGroup: GradeGroup;
  /** Grading period (Q1, Q2, etc.) */
  gradingPeriod: string;
  /** General Weighted Average (rounded to 2 decimal places) */
  gwa: number;
  /** Number of subjects included in GWA calculation */
  subjectCount: number;
  /** Rank within grade level/section (same GWA = same rank) */
  rank: number;
  /** The GWA threshold for Director's List qualification */
  threshold: number;
}

/**
 * Summary statistics for Director's List.
 */
export interface DirectorsListSummary {
  /** Total qualifying students */
  totalQualifying: number;
  /** Breakdown by grade group */
  byGradeGroup: Record<GradeGroup, number>;
  /** Top performer (highest GWA) */
  topPerformer: DirectorsListEntry | null;
}

/**
 * Complete Director's List response with entries and summary.
 */
export interface DirectorsListResult {
  entries: DirectorsListEntry[];
  summary: DirectorsListSummary;
  filters: {
    schoolYearId: string;
    schoolYearLabel: string;
    gradingPeriod: string;
    gradeLevelId: string | null;
    gradeLevelName: string | null;
    sectionId: string | null;
    sectionName: string | null;
  };
}

// ─── Export Report Types ─────────────────────────────────────────────────────

/**
 * Metadata for Director's List report generation.
 */
export interface DirectorsListReportMeta {
  schoolYearLabel: string;
  gradingPeriod: string;
  gradingPeriodLabel: string;
  gradeLabel: string;
  sectionLabel: string;
  generatedAt: Date;
}

/**
 * Row data for report export (flattened for PDF/XLSX).
 */
export interface DirectorsListReportRow {
  rank: number;
  studentRef: string;
  studentName: string;
  gradeLevelName: string;
  sectionName: string;
  gwa: number;
  subjectCount: number;
}
