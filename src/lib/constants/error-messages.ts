/**
 * Centralized permission error messages for SRAMS.
 *
 * All user-facing permission denial messages should be defined here
 * for consistent UX and easier maintenance.
 *
 * @see src/lib/errors/messages.ts for general error messages
 */

// ─── Permission Errors ──────────────────────────────────────────────────────────

export const PERMISSION_ERRORS = {
  // ─── Users ────────────────────────────────────────────────────────────────────
  USERS_CREATE: "You do not have permission to create users.",
  USERS_UPDATE: "You do not have permission to update users.",
  USERS_RESET_PASSWORD: "You do not have permission to reset passwords.",
  USERS_CHANGE_STATUS: "You do not have permission to change user status.",

  // ─── Students ─────────────────────────────────────────────────────────────────
  STUDENTS_CREATE: "You do not have permission to create students.",
  STUDENTS_UPDATE: "You do not have permission to update students.",
  STUDENTS_UPDATE_PHOTO: "You do not have permission to update student photos",

  // ─── Enrollments ──────────────────────────────────────────────────────────────
  ENROLLMENTS_CREATE: "You do not have permission to create enrollments.",
  ENROLLMENTS_ACTION: "You do not have permission to perform this enrollment action.",
  ENROLLMENTS_UPDATE_DOCUMENTS: "You do not have permission to update enrollment documents.",
  ENROLLMENTS_VIEW: "You do not have permission to view enrollment details.",
  ENROLLMENTS_CONFIRM: "You do not have permission to confirm enrollments.",
  ENROLLMENTS_REQUEST_CANCELLATION: "You do not have permission to request enrollment cancellations.",
  ENROLLMENTS_CANCEL: "You do not have permission to cancel enrollments.",
  ENROLLMENTS_WITHDRAW_CANCELLATION: "You do not have permission to withdraw cancellation requests.",

  // ─── Assessments ──────────────────────────────────────────────────────────────
  ASSESSMENTS_CREATE: "You do not have permission to create assessments.",
  ASSESSMENTS_MODIFY: "You do not have permission to modify assessments.",
  ASSESSMENTS_CANCEL: "You do not have permission to cancel assessments.",
  ASSESSMENTS_REVERSE_TRANSFER: "You do not have permission to reverse balance transfers. This action is restricted to administrators.",

  // ─── Payments ─────────────────────────────────────────────────────────────────
  PAYMENTS_POST: "You do not have permission to post payments.",
  PAYMENTS_VOID: "You do not have permission to void payments.",
  PAYMENTS_REQUEST_VOID: "You do not have permission to request payment voids.",
  PAYMENTS_APPROVE_VOID: "You do not have permission to approve void requests.",
  PAYMENTS_REJECT_VOID: "You do not have permission to reject void requests.",
  PAYMENTS_CANCEL_VOID: "You do not have permission to cancel void requests.",
  PAYMENTS_MANAGE_BOOKLETS: "You do not have permission to manage OR booklets.",

  // ─── Discounts ────────────────────────────────────────────────────────────────
  DISCOUNTS_MANAGE_TYPES: "You do not have permission to manage discount types.",
  DISCOUNTS_REQUEST: "You do not have permission to request discounts.",
  DISCOUNTS_REVIEW: "You do not have permission to review discount requests.",
  DISCOUNTS_CANCEL_REQUEST: "You do not have permission to cancel this request.",
  DISCOUNTS_REVERSE: "You do not have permission to reverse discounts.",
  DISCOUNTS_APPLY: "You do not have permission to apply discounts to assessments.",
  DISCOUNTS_RECALCULATE: "You do not have permission to recalculate cascade discounts.",
  DISCOUNTS_CASCADE_FIX: "You do not have permission to apply cascade fixes.",

  // ─── Finance ──────────────────────────────────────────────────────────────────
  INVOICES_MANAGE: "You do not have permission to manage invoices.",
  INVOICES_SEND: "You do not have permission to send invoices.",
  INVOICES_GENERATE: "You do not have permission to generate invoices.",
  FEE_SCHEDULES_MANAGE: "You do not have permission to manage fee schedules.",

  // ─── Archive ──────────────────────────────────────────────────────────────────
  ARCHIVE_STUDENTS: "You do not have permission to archive students.",
  ARCHIVE_UNARCHIVE: "You do not have permission to unarchive students.",
  ARCHIVE_BATCH: "You do not have permission to batch archive students.",
  ARCHIVE_BATCH_CANCEL: "You do not have permission to batch cancel enrollments.",

  // ─── Documents ────────────────────────────────────────────────────────────────
  DOCUMENTS_CREATE: "You do not have permission to create document requests.",
  DOCUMENTS_PROCESS: "You do not have permission to process document requests.",
  DOCUMENTS_RELEASE: "You do not have permission to release documents.",
  DOCUMENTS_REJECT: "You do not have permission to reject document requests.",
  DOCUMENTS_CANCEL: "You do not have permission to cancel document requests.",

  // ─── Clearances ───────────────────────────────────────────────────────────────
  CLEARANCES_GENERATE: "You do not have permission to generate clearances.",
  CLEARANCES_RESOLVE: "You do not have permission to resolve clearances.",
  CLEARANCES_VIEW: "You do not have permission to view clearances.",

  // ─── School Years ─────────────────────────────────────────────────────────────
  SCHOOL_YEARS_CREATE: "You do not have permission to create school years.",
  SCHOOL_YEARS_UPDATE: "You do not have permission to update school years.",
  SCHOOL_YEARS_DELETE: "You do not have permission to delete school years.",
  SCHOOL_YEARS_CHANGE_STATUS: "You do not have permission to change school year status.",

  // ─── Portal Accounts ──────────────────────────────────────────────────────────
  PORTAL_CREATE: "You do not have permission to create portal accounts.",
  PORTAL_RESET_PASSWORD: "You do not have permission to reset portal passwords.",
  PORTAL_MANAGE: "You do not have permission to manage portal accounts.",

  // ─── System Settings ──────────────────────────────────────────────────────────
  SETTINGS_MODIFY: "You do not have permission to modify system settings.",
  SETTINGS_SPED_FEE: "You do not have permission to modify SPED fee settings.",

  // ─── Academics: Coordinators ──────────────────────────────────────────────────
  COORDINATORS_ASSIGN: "You do not have permission to assign coordinators.",
  COORDINATORS_REMOVE: "You do not have permission to remove coordinators.",

  // ─── Academics: Advisers ──────────────────────────────────────────────────────
  ADVISERS_ASSIGN: "You do not have permission to assign advisers.",
  ADVISERS_REMOVE: "You do not have permission to remove advisers.",

  // ─── Academics: Subject Offerings ─────────────────────────────────────────────
  SUBJECT_OFFERINGS_GENERATE: "You do not have permission to generate subject offerings.",
  SUBJECT_OFFERINGS_DELETE: "You do not have permission to delete subject offerings.",
  SUBJECT_OFFERINGS_ADD: "You do not have permission to add subject offerings.",
  SUBJECT_OFFERINGS_ASSIGN_TEACHER: "You do not have permission to assign teachers.",
  SUBJECT_OFFERINGS_UPDATE_TRACK: "You do not have permission to update track assignments.",

  // ─── Academics: Curriculums ───────────────────────────────────────────────────
  CURRICULUMS_CREATE: "You do not have permission to create curriculums.",
  CURRICULUMS_EDIT: "You do not have permission to edit curriculums.",
  CURRICULUMS_CLONE: "You do not have permission to clone curriculums.",
  CURRICULUMS_PUBLISH: "You do not have permission to publish curriculums.",
  CURRICULUMS_ARCHIVE: "You do not have permission to archive curriculums.",
  CURRICULUMS_MANAGE_ADOPTIONS: "You do not have permission to manage curriculum adoptions.",

  // ─── Academics: Subjects ──────────────────────────────────────────────────────
  SUBJECTS_MANAGE: "You do not have permission to manage subjects.",

  // ─── Academics: Sections ──────────────────────────────────────────────────────
  SECTIONS_MANAGE: "You do not have permission to manage sections.",
  SECTIONS_ASSIGN: "You do not have permission to assign sections.",
  SECTIONS_MANAGE_ASSIGNMENTS: "You do not have permission to manage section assignments.",

  // ─── Academics: Strands ───────────────────────────────────────────────────────
  STRANDS_MANAGE: "You do not have permission to manage tracks.",

  // ─── Academics: Student Subject Enrollments ───────────────────────────────────
  STUDENT_ENROLLMENTS_MANAGE: "You do not have permission to manage student enrollments.",

  // ─── Academics: Grades ────────────────────────────────────────────────────────
  GRADES_REVIEW: "You do not have permission to review grades.",
  GRADES_APPROVE: "You do not have permission to approve grades.",
  GRADES_PUBLISH: "You do not have permission to publish grades.",
  GRADES_LOCK: "You do not have permission to lock grades.",
  GRADES_UNLOCK: "You do not have permission to unlock grades.",
  GRADES_CREATE_SHEET: "You do not have permission to create grade sheets.",
  GRADES_ENCODE: "You do not have permission to encode grades.",
  GRADES_SUBMIT: "You do not have permission to submit grades.",

  // ─── Generic Fallback ─────────────────────────────────────────────────────────
  GENERIC: "You do not have permission to perform this action.",
} as const;

export type PermissionErrorKey = keyof typeof PERMISSION_ERRORS;

/**
 * Helper to get a permission error message.
 * Falls back to generic message if key not found.
 */
export function getPermissionError(key: PermissionErrorKey): string {
  return PERMISSION_ERRORS[key] ?? PERMISSION_ERRORS.GENERIC;
}
