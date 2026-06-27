/**
 * Student Status Constants
 *
 * Tracks the lifecycle status of a student in the system.
 * This is a student-level status (not enrollment-level) that explicitly tracks:
 *
 * - `active` - Currently enrolled or enrollable
 * - `graduated` - Completed Grade 12
 * - `transferred` - Left for another school
 * - `withdrawn` - Withdrew from enrollment
 * - `cancelled` - Administrative cancellation
 * - `inactive` - Other inactive reasons
 *
 * **Transaction Rules for Archived Students (status !== active):**
 * - ALLOWED: Payments (settle balances), Document Requests, Grade Encoding
 * - BLOCKED: Void OR, Cancel Enrollment, Cancel Assessment, Re-enroll, Re-assess
 *
 * **Usage:**
 * - Default status is "active" for all new students
 * - Status changes via archive actions (single or batch EOY)
 * - Archived students appear in Archive Directory, not Student Directory
 *
 * **Adding a New Status:**
 * 1. Add value to STUDENT_STATUSES array below
 * 2. Add corresponding label to STUDENT_STATUS_LABELS
 * 3. Add description to STUDENT_STATUS_DESCRIPTIONS
 * 4. Generate migration: npm run db:generate
 * 5. Apply migration: npm run db:migrate
 */

export const STUDENT_STATUSES = [
  "active",
  "graduated",
  "transferred",
  "withdrawn",
  "cancelled",
  "inactive",
] as const satisfies readonly [string, ...string[]];

export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Active",
  graduated: "Graduated",
  transferred: "Transferred",
  withdrawn: "Withdrawn",
  cancelled: "Cancelled",
  inactive: "Inactive",
};

export const STUDENT_STATUS_DESCRIPTIONS: Record<StudentStatus, string> = {
  active: "Currently enrolled or enrollable",
  graduated: "Completed Grade 12 / Senior High School",
  transferred: "Left for another school",
  withdrawn: "Withdrew from enrollment",
  cancelled: "Administrative cancellation",
  inactive: "Other inactive reasons",
};

/**
 * Statuses that are considered "archived" (not active)
 */
export const ARCHIVED_STUDENT_STATUSES = STUDENT_STATUSES.filter(
  (s) => s !== "active"
) as Exclude<StudentStatus, "active">[];

/**
 * Check if a student status is considered archived
 */
export function isArchivedStatus(status: StudentStatus): boolean {
  return status !== "active";
}

/**
 * Check if a student status allows new enrollments
 */
export function canEnroll(status: StudentStatus): boolean {
  return status === "active";
}

/**
 * Check if a student status allows document requests
 * (All statuses allow document requests)
 */
export function canRequestDocuments(_status: StudentStatus): boolean {
  void _status; // intentionally unused — all statuses allow document requests
  return true;
}

/**
 * Check if a student status allows payments
 * (All statuses allow payments to settle balances)
 */
export function canMakePayments(_status: StudentStatus): boolean {
  void _status; // intentionally unused — all statuses allow payments to settle balances
  return true;
}
