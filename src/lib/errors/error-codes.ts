/**
 * Standardized error codes for SRAMS application.
 * Organized by domain with severity levels for auditing and monitoring.
 *
 * Naming convention: {DOMAIN}_{DESCRIPTION}
 * - AUTH_* : Authentication/authorization
 * - VAL_*  : Validation errors
 * - DB_*   : Database constraints
 * - STU_*  : Student operations
 * - ENR_*  : Enrollment
 * - PAY_*  : Payments
 * - OR_*   : Receipt tracking
 * - GRD_*  : Grades
 * - ASM_*  : Assessments
 * - FEE_*  : Fee schedules
 * - SYS_*  : System errors
 */

// ─── Error Code Definitions ───────────────────────────────────────────────────

export const ERROR_CODES = {
  // ─── Authentication & Authorization ─────────────────────────────────────────
  AUTH_UNAUTHENTICATED: "AUTH_UNAUTHENTICATED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTH_PERMISSION_DENIED: "AUTH_PERMISSION_DENIED",
  AUTH_ROLE_REQUIRED: "AUTH_ROLE_REQUIRED",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  AUTH_PASSWORD_EXPIRED: "AUTH_PASSWORD_EXPIRED",

  // ─── Validation ─────────────────────────────────────────────────────────────
  VAL_SCHEMA_MISMATCH: "VAL_SCHEMA_MISMATCH",
  VAL_REQUIRED_FIELD: "VAL_REQUIRED_FIELD",
  VAL_INVALID_FORMAT: "VAL_INVALID_FORMAT",
  VAL_INVALID_EMAIL: "VAL_INVALID_EMAIL",
  VAL_INVALID_PHONE: "VAL_INVALID_PHONE",
  VAL_INVALID_DATE: "VAL_INVALID_DATE",
  VAL_INVALID_UUID: "VAL_INVALID_UUID",
  VAL_OUT_OF_RANGE: "VAL_OUT_OF_RANGE",

  // ─── Database ───────────────────────────────────────────────────────────────
  DB_UNIQUE_VIOLATION: "DB_UNIQUE_VIOLATION",
  DB_FOREIGN_KEY_VIOLATION: "DB_FOREIGN_KEY_VIOLATION",
  DB_NOT_NULL_VIOLATION: "DB_NOT_NULL_VIOLATION",
  DB_CHECK_VIOLATION: "DB_CHECK_VIOLATION",
  DB_CONNECTION_FAILED: "DB_CONNECTION_FAILED",
  DB_QUERY_TIMEOUT: "DB_QUERY_TIMEOUT",
  DB_TRANSACTION_FAILED: "DB_TRANSACTION_FAILED",
  DB_RECORD_NOT_FOUND: "DB_RECORD_NOT_FOUND",

  // ─── Student Operations ─────────────────────────────────────────────────────
  STU_REFERENCE_DUPLICATE: "STU_REFERENCE_DUPLICATE",
  STU_EMAIL_DUPLICATE: "STU_EMAIL_DUPLICATE",
  STU_LRN_DUPLICATE: "STU_LRN_DUPLICATE",
  STU_NOT_FOUND: "STU_NOT_FOUND",
  STU_ALREADY_ENROLLED: "STU_ALREADY_ENROLLED",
  STU_HAS_ACTIVE_ENROLLMENT: "STU_HAS_ACTIVE_ENROLLMENT",
  STU_DELETE_HAS_RECORDS: "STU_DELETE_HAS_RECORDS",

  // ─── Enrollment ─────────────────────────────────────────────────────────────
  ENR_INVALID_STATUS_TRANSITION: "ENR_INVALID_STATUS_TRANSITION",
  ENR_NOT_FOUND: "ENR_NOT_FOUND",
  ENR_ALREADY_EXISTS: "ENR_ALREADY_EXISTS",
  ENR_STUDENT_NOT_ELIGIBLE: "ENR_STUDENT_NOT_ELIGIBLE",
  ENR_SCHOOL_YEAR_CLOSED: "ENR_SCHOOL_YEAR_CLOSED",
  ENR_SECTION_FULL: "ENR_SECTION_FULL",
  ENR_GRADE_LEVEL_MISMATCH: "ENR_GRADE_LEVEL_MISMATCH",
  ENR_DOCUMENTS_INCOMPLETE: "ENR_DOCUMENTS_INCOMPLETE",
  ENR_HAS_UNPAID_BALANCE: "ENR_HAS_UNPAID_BALANCE",

  // ─── Payments ───────────────────────────────────────────────────────────────
  PAY_AMOUNT_EXCEEDS_BALANCE: "PAY_AMOUNT_EXCEEDS_BALANCE",
  PAY_AMOUNT_INVALID: "PAY_AMOUNT_INVALID",
  PAY_REFERENCE_REQUIRED: "PAY_REFERENCE_REQUIRED",
  PAY_ALREADY_POSTED: "PAY_ALREADY_POSTED",
  PAY_ALREADY_VOIDED: "PAY_ALREADY_VOIDED",
  PAY_NOT_FOUND: "PAY_NOT_FOUND",
  PAY_VOID_NOT_ALLOWED: "PAY_VOID_NOT_ALLOWED",
  PAY_ALLOCATION_MISMATCH: "PAY_ALLOCATION_MISMATCH",

  // ─── Official Receipt (OR) Tracking ─────────────────────────────────────────
  OR_BOOKLET_NOT_FOUND: "OR_BOOKLET_NOT_FOUND",
  OR_BOOKLET_NOT_ACTIVE: "OR_BOOKLET_NOT_ACTIVE",
  OR_BOOKLET_EXHAUSTED: "OR_BOOKLET_EXHAUSTED",
  OR_NUMBER_ALREADY_USED: "OR_NUMBER_ALREADY_USED",
  OR_NUMBER_OUT_OF_RANGE: "OR_NUMBER_OUT_OF_RANGE",
  OR_SERIES_DUPLICATE: "OR_SERIES_DUPLICATE",
  OR_INVALID_RANGE: "OR_INVALID_RANGE",
  OR_CANNOT_VOID: "OR_CANNOT_VOID",

  // ─── Grades ─────────────────────────────────────────────────────────────────
  GRD_RECORD_NOT_FOUND: "GRD_RECORD_NOT_FOUND",
  GRD_RECORD_LOCKED: "GRD_RECORD_LOCKED",
  GRD_ALREADY_SUBMITTED: "GRD_ALREADY_SUBMITTED",
  GRD_INVALID_SCORE: "GRD_INVALID_SCORE",
  GRD_NOT_ASSIGNED: "GRD_NOT_ASSIGNED",
  GRD_PERIOD_CLOSED: "GRD_PERIOD_CLOSED",

  // ─── Assessments ────────────────────────────────────────────────────────────
  ASM_NOT_FOUND: "ASM_NOT_FOUND",
  ASM_ALREADY_EXISTS: "ASM_ALREADY_EXISTS",
  ASM_ENROLLMENT_NOT_ASSESSED: "ASM_ENROLLMENT_NOT_ASSESSED",
  ASM_ITEM_NOT_FOUND: "ASM_ITEM_NOT_FOUND",
  ASM_BALANCE_MISMATCH: "ASM_BALANCE_MISMATCH",
  ASM_TRANSFER_INVALID: "ASM_TRANSFER_INVALID",

  // ─── Fee Schedules ──────────────────────────────────────────────────────────
  FEE_SCHEDULE_NOT_FOUND: "FEE_SCHEDULE_NOT_FOUND",
  FEE_SCHEDULE_IN_USE: "FEE_SCHEDULE_IN_USE",
  FEE_ITEM_NOT_FOUND: "FEE_ITEM_NOT_FOUND",
  FEE_TEMPLATE_NOT_FOUND: "FEE_TEMPLATE_NOT_FOUND",
  FEE_TEMPLATE_IN_USE: "FEE_TEMPLATE_IN_USE",

  // ─── System ─────────────────────────────────────────────────────────────────
  SYS_INTERNAL_ERROR: "SYS_INTERNAL_ERROR",
  SYS_SERVICE_UNAVAILABLE: "SYS_SERVICE_UNAVAILABLE",
  SYS_RATE_LIMITED: "SYS_RATE_LIMITED",
  SYS_MAINTENANCE_MODE: "SYS_MAINTENANCE_MODE",
  SYS_CONFIGURATION_ERROR: "SYS_CONFIGURATION_ERROR",
  SYS_UNKNOWN_ERROR: "SYS_UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Severity Levels ──────────────────────────────────────────────────────────

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Maps error codes to severity levels.
 * - low: User input errors, validation failures
 * - medium: Business rule violations, constraint errors
 * - high: Authentication failures, permission denials
 * - critical: Financial operations, system failures
 */
export const ERROR_SEVERITY: Record<ErrorCode, ErrorSeverity> = {
  // Auth - high severity (security-related)
  AUTH_UNAUTHENTICATED: "high",
  AUTH_SESSION_EXPIRED: "medium",
  AUTH_SESSION_INVALID: "high",
  AUTH_PERMISSION_DENIED: "high",
  AUTH_ROLE_REQUIRED: "high",
  AUTH_INVALID_CREDENTIALS: "high",
  AUTH_ACCOUNT_LOCKED: "high",
  AUTH_PASSWORD_EXPIRED: "medium",

  // Validation - low severity (user input errors)
  VAL_SCHEMA_MISMATCH: "low",
  VAL_REQUIRED_FIELD: "low",
  VAL_INVALID_FORMAT: "low",
  VAL_INVALID_EMAIL: "low",
  VAL_INVALID_PHONE: "low",
  VAL_INVALID_DATE: "low",
  VAL_INVALID_UUID: "low",
  VAL_OUT_OF_RANGE: "low",

  // Database - medium to high severity
  DB_UNIQUE_VIOLATION: "medium",
  DB_FOREIGN_KEY_VIOLATION: "medium",
  DB_NOT_NULL_VIOLATION: "medium",
  DB_CHECK_VIOLATION: "medium",
  DB_CONNECTION_FAILED: "critical",
  DB_QUERY_TIMEOUT: "high",
  DB_TRANSACTION_FAILED: "high",
  DB_RECORD_NOT_FOUND: "medium",

  // Student - low to medium severity
  STU_REFERENCE_DUPLICATE: "medium",
  STU_EMAIL_DUPLICATE: "low",
  STU_LRN_DUPLICATE: "medium",
  STU_NOT_FOUND: "medium",
  STU_ALREADY_ENROLLED: "medium",
  STU_HAS_ACTIVE_ENROLLMENT: "medium",
  STU_DELETE_HAS_RECORDS: "medium",

  // Enrollment - medium severity
  ENR_INVALID_STATUS_TRANSITION: "medium",
  ENR_NOT_FOUND: "medium",
  ENR_ALREADY_EXISTS: "medium",
  ENR_STUDENT_NOT_ELIGIBLE: "medium",
  ENR_SCHOOL_YEAR_CLOSED: "medium",
  ENR_SECTION_FULL: "low",
  ENR_GRADE_LEVEL_MISMATCH: "medium",
  ENR_DOCUMENTS_INCOMPLETE: "low",
  ENR_HAS_UNPAID_BALANCE: "medium",

  // Payments - critical severity (financial)
  PAY_AMOUNT_EXCEEDS_BALANCE: "critical",
  PAY_AMOUNT_INVALID: "critical",
  PAY_REFERENCE_REQUIRED: "medium",
  PAY_ALREADY_POSTED: "critical",
  PAY_ALREADY_VOIDED: "critical",
  PAY_NOT_FOUND: "medium",
  PAY_VOID_NOT_ALLOWED: "critical",
  PAY_ALLOCATION_MISMATCH: "critical",

  // OR Tracking - critical severity (financial)
  OR_BOOKLET_NOT_FOUND: "medium",
  OR_BOOKLET_NOT_ACTIVE: "critical",
  OR_BOOKLET_EXHAUSTED: "critical",
  OR_NUMBER_ALREADY_USED: "critical",
  OR_NUMBER_OUT_OF_RANGE: "critical",
  OR_SERIES_DUPLICATE: "medium",
  OR_INVALID_RANGE: "medium",
  OR_CANNOT_VOID: "critical",

  // Grades - medium severity
  GRD_RECORD_NOT_FOUND: "medium",
  GRD_RECORD_LOCKED: "medium",
  GRD_ALREADY_SUBMITTED: "medium",
  GRD_INVALID_SCORE: "low",
  GRD_NOT_ASSIGNED: "medium",
  GRD_PERIOD_CLOSED: "medium",

  // Assessments - medium to high severity
  ASM_NOT_FOUND: "medium",
  ASM_ALREADY_EXISTS: "medium",
  ASM_ENROLLMENT_NOT_ASSESSED: "medium",
  ASM_ITEM_NOT_FOUND: "medium",
  ASM_BALANCE_MISMATCH: "high",
  ASM_TRANSFER_INVALID: "high",

  // Fee Schedules - medium severity
  FEE_SCHEDULE_NOT_FOUND: "medium",
  FEE_SCHEDULE_IN_USE: "medium",
  FEE_ITEM_NOT_FOUND: "medium",
  FEE_TEMPLATE_NOT_FOUND: "medium",
  FEE_TEMPLATE_IN_USE: "medium",

  // System - critical severity
  SYS_INTERNAL_ERROR: "critical",
  SYS_SERVICE_UNAVAILABLE: "critical",
  SYS_RATE_LIMITED: "medium",
  SYS_MAINTENANCE_MODE: "low",
  SYS_CONFIGURATION_ERROR: "critical",
  SYS_UNKNOWN_ERROR: "critical",
};

/**
 * Check if an error code requires auditing based on severity.
 * Medium, high, and critical errors are always audited.
 */
export function shouldAuditError(code: ErrorCode): boolean {
  const severity = ERROR_SEVERITY[code];
  return severity !== "low";
}

/**
 * Check if an error code should trigger monitoring alerts.
 * High and critical errors trigger alerts.
 */
export function shouldAlertError(code: ErrorCode): boolean {
  const severity = ERROR_SEVERITY[code];
  return severity === "high" || severity === "critical";
}

/**
 * Get the severity level for an error code.
 */
export function getErrorSeverity(code: ErrorCode): ErrorSeverity {
  return ERROR_SEVERITY[code] ?? "medium";
}
