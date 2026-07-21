/**
 * Grading periods for the academic year.
 * Supports both quarterly (Q1-Q4) and trimester (T1-T3) systems.
 * The active system is configured per school year via gradingPeriodSystems table.
 */
export const GRADING_PERIODS = ["Q1", "Q2", "Q3", "Q4", "T1", "T2", "T3"] as const;

export type GradingPeriod = (typeof GRADING_PERIODS)[number];

/** Quarterly periods subset */
export const QUARTERLY_PERIODS = ["Q1", "Q2", "Q3", "Q4"] as const;
export type QuarterlyPeriod = (typeof QUARTERLY_PERIODS)[number];

/** Trimester periods subset */
export const TRIMESTER_PERIODS = ["T1", "T2", "T3"] as const;
export type TrimesterPeriod = (typeof TRIMESTER_PERIODS)[number];

export const GRADING_PERIOD_LABELS: Record<GradingPeriod, string> = {
  Q1: "First Quarter",
  Q2: "Second Quarter",
  Q3: "Third Quarter",
  Q4: "Fourth Quarter",
  T1: "First Trimester",
  T2: "Second Trimester",
  T3: "Third Trimester",
};

/**
 * Grade sheet workflow statuses with simplified approval chain.
 * draft → submitted → principal_approved → published → locked
 * Can be returned at any stage for corrections.
 */
export const GRADE_SHEET_STATUSES = [
  "draft",
  "submitted",
  "principal_approved",
  "published",
  "locked",
  "returned",
] as const;

export type GradeSheetStatus = (typeof GRADE_SHEET_STATUSES)[number];

export const GRADE_SHEET_STATUS_LABELS: Record<GradeSheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  principal_approved: "Principal Approved",
  published: "Published",
  locked: "Locked",
  returned: "Returned",
};

/**
 * Grade approval workflow actions.
 */
export const GRADE_APPROVAL_ACTIONS = [
  "submit",
  "principal_return",
  "principal_approve",
  "publish",
  "lock",
  "unlock",
] as const;

export type GradeApprovalAction = (typeof GRADE_APPROVAL_ACTIONS)[number];

export const GRADE_APPROVAL_ACTION_LABELS: Record<GradeApprovalAction, string> = {
  submit: "Submitted for Review",
  principal_return: "Returned by Principal",
  principal_approve: "Approved by Principal",
  publish: "Published to Portal",
  lock: "Locked",
  unlock: "Unlocked for Editing",
};

// ─── DepEd Grade Scale and Remarks ────────────────────────────────────────────

/**
 * DepEd grade remarks based on grade value.
 * Used for both UI display and server-side validation.
 */
export const DEPED_GRADE_REMARKS = {
  OUTSTANDING: "Outstanding",
  VERY_SATISFACTORY: "Very Satisfactory",
  SATISFACTORY: "Satisfactory",
  FAIRLY_SATISFACTORY: "Fairly Satisfactory",
  DID_NOT_MEET: "Did Not Meet Expectations",
} as const;

export type DepEdGradeRemarks = (typeof DEPED_GRADE_REMARKS)[keyof typeof DEPED_GRADE_REMARKS];

/**
 * Get the appropriate remarks for a grade value according to DepEd scale.
 * This is the single source of truth for grade-to-remarks mapping.
 *
 * @param grade - The numeric grade value (0-100)
 * @returns The corresponding DepEd remarks string
 */
export function getGradeRemarks(grade: number): DepEdGradeRemarks {
  if (grade < 75) return DEPED_GRADE_REMARKS.DID_NOT_MEET;
  if (grade < 80) return DEPED_GRADE_REMARKS.FAIRLY_SATISFACTORY;
  if (grade < 85) return DEPED_GRADE_REMARKS.SATISFACTORY;
  if (grade < 90) return DEPED_GRADE_REMARKS.VERY_SATISFACTORY;
  return DEPED_GRADE_REMARKS.OUTSTANDING;
}

/**
 * Validate that remarks match the expected value for a grade.
 * Returns true if remarks are valid (either matching or undefined/null).
 *
 * @param grade - The numeric grade value
 * @param remarks - The provided remarks string
 * @returns true if valid, false if mismatch
 */
export function validateGradeRemarks(grade: number, remarks?: string | null): boolean {
  // If no remarks provided, that's valid (server will auto-set)
  if (!remarks) return true;

  const expected = getGradeRemarks(grade);
  return remarks === expected;
}
