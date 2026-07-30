/**
 * Term offerings for SHS (Grade 11-12) subject availability.
 *
 * Allows subjects to be offered in specific semesters/trimesters
 * rather than the entire school year.
 *
 * The valid term options depend on the school year's grading system type:
 * - Quarterly (Q1-Q4): full_year, first_semester, second_semester
 * - Trimester (T1-T3): full_year, first_trimester, second_trimester, third_trimester
 */

import type { GradingSystemType } from "./grading-systems";

// ─── Term Offering Values ──────────────────────────────────────────────────────

export const TERM_OFFERINGS = [
  "full_year",
  "first_semester",
  "second_semester",
  "first_trimester",
  "second_trimester",
  "third_trimester",
] as const;

export type TermOffering = (typeof TERM_OFFERINGS)[number];

// ─── Display Labels ────────────────────────────────────────────────────────────

export const TERM_OFFERING_LABELS: Record<TermOffering, string> = {
  full_year: "Full Year",
  first_semester: "First Semester",
  second_semester: "Second Semester",
  first_trimester: "First Trimester",
  second_trimester: "Second Trimester",
  third_trimester: "Third Trimester",
};

// ─── Period Mapping ────────────────────────────────────────────────────────────

/**
 * Map term to applicable grading periods based on grading system type.
 *
 * For Quarterly System (Q1-Q4):
 * - full_year: Q1, Q2, Q3, Q4
 * - first_semester: Q1, Q2
 * - second_semester: Q3, Q4
 *
 * For Trimester System (T1-T3):
 * - full_year: T1, T2, T3
 * - first_trimester: T1
 * - second_trimester: T2
 * - third_trimester: T3
 */
export function getPeriodsForTerm(
  term: TermOffering,
  systemType: GradingSystemType
): readonly string[] {
  if (systemType === "quarterly") {
    switch (term) {
      case "full_year":
        return ["Q1", "Q2", "Q3", "Q4"];
      case "first_semester":
        return ["Q1", "Q2"];
      case "second_semester":
        return ["Q3", "Q4"];
      default:
        // Trimester terms not valid in quarterly system - default to full year
        return ["Q1", "Q2", "Q3", "Q4"];
    }
  } else {
    // trimester
    switch (term) {
      case "full_year":
        return ["T1", "T2", "T3"];
      case "first_trimester":
        return ["T1"];
      case "second_trimester":
        return ["T2"];
      case "third_trimester":
        return ["T3"];
      default:
        // Semester terms not valid in trimester system - default to full year
        return ["T1", "T2", "T3"];
    }
  }
}

/**
 * Check if a subject should appear for a given grading period.
 *
 * @param term - The term the subject is offered in
 * @param period - The current grading period (e.g., "Q1", "T2")
 * @param systemType - The school year's grading system type
 * @returns true if the subject should be visible/active in this period
 */
export function isSubjectInPeriod(
  term: TermOffering,
  period: string,
  systemType: GradingSystemType
): boolean {
  const periodsForTerm = getPeriodsForTerm(term, systemType);
  return periodsForTerm.includes(period);
}

// ─── Valid Terms Per Period (for SQL filtering) ────────────────────────────────

/**
 * Get valid term offerings that include a given grading period.
 * This is the inverse of getPeriodsForTerm - used for SQL WHERE clause filtering.
 *
 * For Quarterly System:
 * - Q1, Q2 → full_year, first_semester
 * - Q3, Q4 → full_year, second_semester
 *
 * For Trimester System:
 * - T1 → full_year, first_trimester
 * - T2 → full_year, second_trimester
 * - T3 → full_year, third_trimester
 *
 * @param period - The grading period (e.g., "Q1", "T2")
 * @param systemType - The school year's grading system type
 * @returns Array of term offerings that are valid for that period
 */
export function getValidTermsForPeriod(
  period: string,
  systemType: GradingSystemType
): TermOffering[] {
  if (systemType === "quarterly") {
    switch (period) {
      case "Q1":
      case "Q2":
        return ["full_year", "first_semester"];
      case "Q3":
      case "Q4":
        return ["full_year", "second_semester"];
      default:
        return ["full_year"];
    }
  } else {
    switch (period) {
      case "T1":
        return ["full_year", "first_trimester"];
      case "T2":
        return ["full_year", "second_trimester"];
      case "T3":
        return ["full_year", "third_trimester"];
      default:
        return ["full_year"];
    }
  }
}

// ─── Valid Terms Per System Type ───────────────────────────────────────────────

/**
 * Get valid term options based on school year's grading system type.
 *
 * Use this to filter UI options in the term selection dropdown.
 *
 * @param systemType - The school year's grading system type
 * @returns Array of valid term offerings for that system
 */
export function getValidTermsForSystem(
  systemType: GradingSystemType
): TermOffering[] {
  if (systemType === "quarterly") {
    return ["full_year", "first_semester", "second_semester"];
  } else {
    return ["full_year", "first_trimester", "second_trimester", "third_trimester"];
  }
}

/**
 * Get term options with labels for UI dropdowns.
 *
 * @param systemType - The school year's grading system type
 * @returns Array of { value, label } for select options
 */
export function getTermOptionsForSystem(
  systemType: GradingSystemType
): Array<{ value: TermOffering; label: string }> {
  return getValidTermsForSystem(systemType).map((term) => ({
    value: term,
    label: TERM_OFFERING_LABELS[term],
  }));
}
