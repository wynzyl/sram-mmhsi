/**
 * Director's List Types and Qualification Logic
 *
 * Defines GWA thresholds by academic level and qualification functions.
 * Elementary/JHS require 92+ GWA, SHS requires 90+ GWA.
 */

import {
  type GradeGroup,
  getGradeGroup,
} from "@/lib/constants/grade-groups";

// ─── GWA Thresholds by Academic Level ────────────────────────────────────────

/**
 * Director's List GWA thresholds by grade group.
 * - Casa (Kinder): 92+ (same as elementary)
 * - Lower Elementary (Grades 1-3): 92+
 * - Higher Elementary (Grades 4-6): 92+
 * - Junior High School (Grades 7-10): 92+
 * - Senior High School (Grades 11-12): 90+
 */
export const DIRECTORS_LIST_THRESHOLDS: Record<GradeGroup, number> = {
  casa: 92,
  lower_elem: 92,
  higher_elem: 92,
  jhs: 92,
  shs: 90,
};

/**
 * Get the Director's List GWA threshold for a grade group.
 */
export function getDirectorsListThreshold(gradeGroup: GradeGroup): number {
  return DIRECTORS_LIST_THRESHOLDS[gradeGroup];
}

/**
 * Check if a GWA qualifies for Director's List given a grade level name.
 *
 * @param gwa - The General Weighted Average (0-100)
 * @param gradeLevelName - The grade level name (e.g., "Grade 7", "Grade 11")
 * @returns true if the GWA meets the threshold for the grade level
 */
export function qualifiesForDirectorsList(
  gwa: number,
  gradeLevelName: string
): boolean {
  const gradeGroup = getGradeGroup(gradeLevelName);
  if (!gradeGroup) return false;
  return gwa >= DIRECTORS_LIST_THRESHOLDS[gradeGroup];
}

/**
 * Get the threshold for a specific grade level name.
 * Returns null if the grade level is not recognized.
 */
export function getThresholdForGradeLevel(gradeLevelName: string): number | null {
  const gradeGroup = getGradeGroup(gradeLevelName);
  if (!gradeGroup) return null;
  return DIRECTORS_LIST_THRESHOLDS[gradeGroup];
}

// ─── Academic Level Labels ───────────────────────────────────────────────────

export const ACADEMIC_LEVEL_LABELS: Record<GradeGroup, string> = {
  casa: "Kindergarten",
  lower_elem: "Elementary (Grades 1-3)",
  higher_elem: "Elementary (Grades 4-6)",
  jhs: "Junior High School",
  shs: "Senior High School",
};

/**
 * Get a user-friendly label for an academic level.
 */
export function getAcademicLevelLabel(gradeGroup: GradeGroup): string {
  return ACADEMIC_LEVEL_LABELS[gradeGroup];
}
