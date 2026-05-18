/**
 * User-friendly error messages for SRAMS application.
 * Maps error codes to display messages and provides constraint-to-field mapping.
 */

import { ERROR_CODES, type ErrorCode } from "./error-codes";

// ─── User-Friendly Error Messages ─────────────────────────────────────────────

/**
 * User-friendly error messages keyed by error code.
 * These messages are safe to display to end users.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // ─── Authentication & Authorization ─────────────────────────────────────────
  AUTH_UNAUTHENTICATED: "Please log in to continue.",
  AUTH_SESSION_EXPIRED: "Your session has expired. Please log in again.",
  AUTH_SESSION_INVALID: "Your session is no longer valid. Please log in again.",
  AUTH_PERMISSION_DENIED: "You do not have permission to perform this action.",
  AUTH_ROLE_REQUIRED: "This action requires a specific role that you do not have.",
  AUTH_INVALID_CREDENTIALS: "Invalid username or password.",
  AUTH_ACCOUNT_LOCKED: "Your account has been locked. Please contact an administrator.",
  AUTH_PASSWORD_EXPIRED: "Your password has expired. Please reset your password.",

  // ─── Validation ─────────────────────────────────────────────────────────────
  VAL_SCHEMA_MISMATCH: "The submitted data is invalid. Please check your input.",
  VAL_REQUIRED_FIELD: "A required field is missing.",
  VAL_INVALID_FORMAT: "The data format is invalid.",
  VAL_INVALID_EMAIL: "Please enter a valid email address.",
  VAL_INVALID_PHONE: "Please enter a valid Philippine mobile number (e.g., 09171234567).",
  VAL_INVALID_DATE: "Please enter a valid date.",
  VAL_INVALID_UUID: "Invalid identifier format.",
  VAL_OUT_OF_RANGE: "The value is outside the allowed range.",

  // ─── Database ───────────────────────────────────────────────────────────────
  DB_UNIQUE_VIOLATION: "This record already exists. Please use a unique value.",
  DB_FOREIGN_KEY_VIOLATION: "Cannot complete this action because it references other records.",
  DB_NOT_NULL_VIOLATION: "A required value is missing.",
  DB_CHECK_VIOLATION: "The value does not meet the required criteria.",
  DB_CONNECTION_FAILED: "Unable to connect to the database. Please try again later.",
  DB_QUERY_TIMEOUT: "The operation took too long. Please try again.",
  DB_TRANSACTION_FAILED: "The operation could not be completed. Please try again.",
  DB_RECORD_NOT_FOUND: "The requested record could not be found.",

  // ─── Student Operations ─────────────────────────────────────────────────────
  STU_REFERENCE_DUPLICATE: "A student with this reference number already exists.",
  STU_EMAIL_DUPLICATE: "A student with this email address already exists.",
  STU_LRN_DUPLICATE: "A student with this LRN already exists.",
  STU_NOT_FOUND: "Student not found.",
  STU_ALREADY_ENROLLED: "This student is already enrolled for this school year.",
  STU_HAS_ACTIVE_ENROLLMENT: "This student has an active enrollment that must be completed first.",
  STU_DELETE_HAS_RECORDS: "Cannot delete this student because they have existing records.",

  // ─── Enrollment ─────────────────────────────────────────────────────────────
  ENR_INVALID_STATUS_TRANSITION: "This enrollment status change is not allowed.",
  ENR_NOT_FOUND: "Enrollment not found.",
  ENR_ALREADY_EXISTS: "An enrollment already exists for this student and school year.",
  ENR_STUDENT_NOT_ELIGIBLE: "This student is not eligible for enrollment.",
  ENR_SCHOOL_YEAR_CLOSED: "Enrollment is closed for this school year.",
  ENR_SECTION_FULL: "The selected section is already full.",
  ENR_GRADE_LEVEL_MISMATCH: "The grade level does not match the student's eligibility.",
  ENR_DOCUMENTS_INCOMPLETE: "Required documents are missing. Please upload all required documents.",
  ENR_HAS_UNPAID_BALANCE: "This student has an unpaid balance from a previous enrollment.",

  // ─── Payments ───────────────────────────────────────────────────────────────
  PAY_AMOUNT_EXCEEDS_BALANCE: "Payment amount exceeds the outstanding balance.",
  PAY_AMOUNT_INVALID: "Please enter a valid payment amount greater than zero.",
  PAY_REFERENCE_REQUIRED: "A reference number is required for this payment method.",
  PAY_ALREADY_POSTED: "This payment has already been posted.",
  PAY_ALREADY_VOIDED: "This payment has already been voided.",
  PAY_NOT_FOUND: "Payment not found.",
  PAY_VOID_NOT_ALLOWED: "This payment cannot be voided.",
  PAY_ALLOCATION_MISMATCH: "Payment allocations do not match the total amount.",

  // ─── Official Receipt (OR) Tracking ─────────────────────────────────────────
  OR_BOOKLET_NOT_FOUND: "OR booklet not found.",
  OR_BOOKLET_NOT_ACTIVE: "The selected OR booklet is not active. Please select an active booklet.",
  OR_BOOKLET_EXHAUSTED: "The OR booklet is exhausted. Please select a different booklet.",
  OR_NUMBER_ALREADY_USED: "This OR number has already been used.",
  OR_NUMBER_OUT_OF_RANGE: "The OR number is outside the booklet's range.",
  OR_SERIES_DUPLICATE: "An OR booklet with this series already exists.",
  OR_INVALID_RANGE: "Invalid OR number range. End number must be greater than start number.",
  OR_CANNOT_VOID: "This OR cannot be voided.",

  // ─── Grades ─────────────────────────────────────────────────────────────────
  GRD_RECORD_NOT_FOUND: "Grade record not found.",
  GRD_RECORD_LOCKED: "This grade record is locked and cannot be modified.",
  GRD_ALREADY_SUBMITTED: "Grades have already been submitted for this period.",
  GRD_INVALID_SCORE: "Please enter a valid score between 0 and 100.",
  GRD_NOT_ASSIGNED: "You are not assigned to this subject.",
  GRD_PERIOD_CLOSED: "Grade encoding is closed for this grading period.",

  // ─── Assessments ────────────────────────────────────────────────────────────
  ASM_NOT_FOUND: "Assessment not found.",
  ASM_ALREADY_EXISTS: "An assessment already exists for this enrollment.",
  ASM_ENROLLMENT_NOT_ASSESSED: "This enrollment has not been assessed yet.",
  ASM_ITEM_NOT_FOUND: "Assessment item not found.",
  ASM_BALANCE_MISMATCH: "Assessment balance does not match. Please refresh and try again.",
  ASM_TRANSFER_INVALID: "Invalid balance transfer. Please check the amounts.",

  // ─── Fee Schedules ──────────────────────────────────────────────────────────
  FEE_SCHEDULE_NOT_FOUND: "Fee schedule not found.",
  FEE_SCHEDULE_IN_USE: "This fee schedule is in use and cannot be deleted.",
  FEE_ITEM_NOT_FOUND: "Fee item not found.",
  FEE_TEMPLATE_NOT_FOUND: "Fee template not found.",
  FEE_TEMPLATE_IN_USE: "This fee template is in use and cannot be deleted.",

  // ─── System ─────────────────────────────────────────────────────────────────
  SYS_INTERNAL_ERROR: "An unexpected error occurred. Please try again.",
  SYS_SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again later.",
  SYS_RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  SYS_MAINTENANCE_MODE: "The system is currently undergoing maintenance.",
  SYS_CONFIGURATION_ERROR: "A system configuration error occurred. Please contact support.",
  SYS_UNKNOWN_ERROR: "An unknown error occurred. Please try again.",
};

// ─── Database Constraint Mapping ──────────────────────────────────────────────

/**
 * Maps PostgreSQL constraint names to field errors.
 * Format: { constraintName: { field, message, code } }
 */
export const CONSTRAINT_FIELD_MAP: Record<
  string,
  { field: string; message: string; code: ErrorCode }
> = {
  // Student constraints
  students_student_ref_unique: {
    field: "studentRef",
    message: "Student reference number already exists.",
    code: ERROR_CODES.STU_REFERENCE_DUPLICATE,
  },
  students_email_unique: {
    field: "email",
    message: "Email already exists.",
    code: ERROR_CODES.STU_EMAIL_DUPLICATE,
  },
  students_lrn_unique: {
    field: "lrn",
    message: "LRN already exists.",
    code: ERROR_CODES.STU_LRN_DUPLICATE,
  },

  // User constraints
  users_email_unique: {
    field: "email",
    message: "Email already exists.",
    code: ERROR_CODES.DB_UNIQUE_VIOLATION,
  },
  users_username_unique: {
    field: "username",
    message: "Username already exists.",
    code: ERROR_CODES.DB_UNIQUE_VIOLATION,
  },

  // OR Booklet constraints
  receipt_booklets_series_unique: {
    field: "series",
    message: "Booklet series already exists.",
    code: ERROR_CODES.OR_SERIES_DUPLICATE,
  },
  payments_booklet_id_or_number_unique: {
    field: "orNumber",
    message: "OR number already used.",
    code: ERROR_CODES.OR_NUMBER_ALREADY_USED,
  },

  // Enrollment constraints
  enrollments_student_id_school_year_id_unique: {
    field: "schoolYearId",
    message: "Student is already enrolled for this school year.",
    code: ERROR_CODES.ENR_ALREADY_EXISTS,
  },

  // Assessment constraints
  assessments_enrollment_id_unique: {
    field: "enrollmentId",
    message: "An assessment already exists for this enrollment.",
    code: ERROR_CODES.ASM_ALREADY_EXISTS,
  },

  // Fee schedule constraints
  fee_schedules_school_year_id_assessment_band_unique: {
    field: "assessmentBand",
    message: "A fee schedule already exists for this band and school year.",
    code: ERROR_CODES.DB_UNIQUE_VIOLATION,
  },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get user-friendly message for an error code.
 * Falls back to generic message if code not found.
 */
export function getUserMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES[ERROR_CODES.SYS_UNKNOWN_ERROR];
}

/**
 * Get field error from constraint name.
 * Returns null if constraint not mapped.
 */
export function getFieldErrorFromConstraint(
  constraintName: string
): { field: string; message: string; code: ErrorCode } | null {
  return CONSTRAINT_FIELD_MAP[constraintName] ?? null;
}

/**
 * Map PostgreSQL error code to ErrorCode.
 */
export function mapPgErrorCode(pgCode: string): ErrorCode {
  switch (pgCode) {
    case "23505": // unique_violation
      return ERROR_CODES.DB_UNIQUE_VIOLATION;
    case "23503": // foreign_key_violation
      return ERROR_CODES.DB_FOREIGN_KEY_VIOLATION;
    case "23502": // not_null_violation
      return ERROR_CODES.DB_NOT_NULL_VIOLATION;
    case "23514": // check_violation
      return ERROR_CODES.DB_CHECK_VIOLATION;
    case "57014": // query_canceled (timeout)
      return ERROR_CODES.DB_QUERY_TIMEOUT;
    case "40001": // serialization_failure
    case "40P01": // deadlock_detected
      return ERROR_CODES.DB_TRANSACTION_FAILED;
    case "08000": // connection_exception
    case "08003": // connection_does_not_exist
    case "08006": // connection_failure
      return ERROR_CODES.DB_CONNECTION_FAILED;
    default:
      return ERROR_CODES.SYS_INTERNAL_ERROR;
  }
}
