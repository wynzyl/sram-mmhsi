/**
 * Grading periods (quarters) for the academic year.
 * Used in grade sheets, grade records, and report cards.
 */
export const GRADING_PERIODS = ["Q1", "Q2", "Q3", "Q4"] as const;

export type GradingPeriod = (typeof GRADING_PERIODS)[number];

export const GRADING_PERIOD_LABELS: Record<GradingPeriod, string> = {
  Q1: "First Quarter",
  Q2: "Second Quarter",
  Q3: "Third Quarter",
  Q4: "Fourth Quarter",
};

/**
 * Grade sheet workflow statuses.
 * draft → submitted → (returned | approved) → released
 */
export const GRADE_SHEET_STATUSES = [
  "draft",
  "submitted",
  "returned",
  "approved",
  "released",
] as const;

export type GradeSheetStatus = (typeof GRADE_SHEET_STATUSES)[number];

export const GRADE_SHEET_STATUS_LABELS: Record<GradeSheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
  released: "Released",
};

/**
 * Grade approval workflow actions.
 */
export const GRADE_APPROVAL_ACTIONS = [
  "submit",
  "return",
  "approve",
  "release",
  "unlock",
] as const;

export type GradeApprovalAction = (typeof GRADE_APPROVAL_ACTIONS)[number];

export const GRADE_APPROVAL_ACTION_LABELS: Record<GradeApprovalAction, string> = {
  submit: "Submitted for Review",
  return: "Returned to Teacher",
  approve: "Approved",
  release: "Released to Students",
  unlock: "Unlocked for Editing",
};
