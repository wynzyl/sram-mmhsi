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
 * Grade sheet workflow statuses with full approval chain.
 * draft → submitted → coordinator_approved → principal_approved → published → locked
 * Can be returned at any stage for corrections.
 */
export const GRADE_SHEET_STATUSES = [
  "draft",
  "submitted",
  "coordinator_approved",
  "principal_approved",
  "published",
  "locked",
  "returned",
] as const;

export type GradeSheetStatus = (typeof GRADE_SHEET_STATUSES)[number];

export const GRADE_SHEET_STATUS_LABELS: Record<GradeSheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  coordinator_approved: "Coordinator Approved",
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
  "coordinator_return",
  "coordinator_approve",
  "principal_return",
  "principal_approve",
  "publish",
  "lock",
  "unlock",
] as const;

export type GradeApprovalAction = (typeof GRADE_APPROVAL_ACTIONS)[number];

export const GRADE_APPROVAL_ACTION_LABELS: Record<GradeApprovalAction, string> = {
  submit: "Submitted for Review",
  coordinator_return: "Returned by Coordinator",
  coordinator_approve: "Approved by Coordinator",
  principal_return: "Returned by Principal",
  principal_approve: "Approved by Principal",
  publish: "Published to Portal",
  lock: "Locked",
  unlock: "Unlocked for Editing",
};
