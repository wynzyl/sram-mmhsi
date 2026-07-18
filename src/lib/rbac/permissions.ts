import { Role, STAFF_ROLES, PORTAL_ROLES, normalizeRole } from "@/lib/constants/roles";

/**
 * RBAC permission map for SRAMS.
 * Per SRAMS Engineering spec §10 — Role Access Baseline.
 */

export type Permission =
  // Students
  | "students:read"
  | "students:create"
  | "students:update"
  | "students:delete"
  // Registrations
  | "registrations:read"
  | "registrations:create"
  | "registrations:review"
  // Curriculums
  | "curriculums:read"
  | "curriculums:create"
  | "curriculums:edit"
  | "curriculums:publish"
  | "curriculums:archive"
  | "curriculums:adopt"
  | "subjects:manage"
  // Enrollments
  | "enrollments:read"
  | "enrollments:create"
  | "enrollments:update"
  /** Confirm enrollment from the ready-to-enroll queue (list-first workflow). */
  | "enrollments:confirm"
  | "enrollments:cancel"
  /** Cancel enrollment while assessment still shows collected payments — admin-only; requires detailed remarks. */
  | "enrollments:cancel_with_balance"
  /** Mark enrolled without cashier payment — admin-only. */
  | "enrollments:override_enroll"
  // Assessments
  | "assessments:read"
  | "assessments:create"
  | "assessments:update"
  /** Reverse a payment transfer between assessments — admin-only; requires detailed remarks. */
  | "assessments:reverse_transfer"
  /** Cancel an assessment directly (independent of enrollment cancellation). */
  | "assessments:cancel"
  /** Cancel assessment while payments have been posted — admin-only; requires detailed remarks. */
  | "assessments:cancel_with_balance"
  // Payments
  | "payments:read"
  | "payments:post"
  /** @deprecated Use payments:void_request instead. Kept for backward compatibility. */
  | "payments:void"
  /** Request a void (cashier, registrar, admin, super_admin). Creates a pending void request for approval. */
  | "payments:void_request"
  /** Approve or reject void requests (admin, super_admin only). */
  | "payments:void_approve"
  // Invoices
  | "invoices:read"
  | "invoices:send"
  // Grades
  | "grades:read"
  | "grades:encode"
  | "grades:submit"
  /** Review grade sheets (return to teacher with remarks) — coordinator/admin */
  | "grades:review"
  /** Approve grade sheets — principal/admin */
  | "grades:approve"
  /** Release grades to students — principal/admin */
  | "grades:release"
  /** Unlock released grades for editing — admin only */
  | "grades:lock"
  // Advisers
  /** View adviser assignments */
  | "advisers:read"
  /** Assign/remove section advisers */
  | "advisers:manage"
  // Receipts
  | "booklets:manage"
  // Reports
  | "reports:view"
  | "reports:finance"
  | "reports:academic"
  // Discounts
  | "discounts:read"
  | "discounts:request"
  | "discounts:review"
  | "discounts:manage"
  /** Apply an approved discount request to an existing (already-finalized) assessment. */
  | "discounts:apply"
  // Clearances
  | "clearances:read"
  | "clearances:create"
  | "clearances:resolve"
  // Archive
  /** View archived students and archive directory */
  | "archive:read"
  /** Archive/unarchive students, batch EOY operations */
  | "archive:manage"
  // Document Requests
  /** View document requests */
  | "documents:read"
  /** Create new document requests */
  | "documents:create"
  /** Process document requests (move to processing status) */
  | "documents:process"
  /** Release documents (final step, requires clearance) */
  | "documents:release"
  // Admin
  | "users:manage"
  | "school_years:manage"
  | "sections:manage"
  | "fee_schedules:manage"
  | "assignments:manage"
  // System Settings
  | "system:manage";

const PERMISSIONS: Record<Role, Permission[]> = {
  super_admin: [
    "students:read", "students:create", "students:update", "students:delete",
    "registrations:read", "registrations:create", "registrations:review",
    "curriculums:read", "curriculums:create", "curriculums:edit", "curriculums:publish", "curriculums:archive", "curriculums:adopt", "subjects:manage",
    "enrollments:read",
    "enrollments:create",
    "enrollments:update",
    "enrollments:confirm",
    "enrollments:cancel",
    "enrollments:cancel_with_balance",
    "enrollments:override_enroll",
    "assessments:read", "assessments:create", "assessments:update", "assessments:reverse_transfer",
    "assessments:cancel", "assessments:cancel_with_balance",
    "payments:read", "payments:post", "payments:void", "payments:void_request", "payments:void_approve",
    "invoices:read", "invoices:send",
    "grades:read", "grades:encode", "grades:submit", "grades:review", "grades:approve", "grades:release", "grades:lock",
    "advisers:read", "advisers:manage",
    "booklets:manage",
    "discounts:read", "discounts:request", "discounts:review", "discounts:manage", "discounts:apply",
    "clearances:read", "clearances:create", "clearances:resolve",
    "archive:read", "archive:manage",
    "documents:read", "documents:create", "documents:process", "documents:release",
    "reports:view", "reports:finance", "reports:academic",
    "users:manage", "school_years:manage", "sections:manage", "fee_schedules:manage",
    "assignments:manage", "system:manage",
  ],
  admin: [
    "students:read", "students:create", "students:update", "students:delete",
    "registrations:read", "registrations:create", "registrations:review",
    "curriculums:read", "curriculums:create", "curriculums:edit", "curriculums:publish", "curriculums:archive", "curriculums:adopt", "subjects:manage",
    "enrollments:read",
    "enrollments:create",
    "enrollments:update",
    "enrollments:confirm",
    "enrollments:cancel",
    "enrollments:cancel_with_balance",
    "enrollments:override_enroll",
    "assessments:read", "assessments:create", "assessments:update", "assessments:reverse_transfer",
    "assessments:cancel", "assessments:cancel_with_balance",
    "payments:read", "payments:post", "payments:void", "payments:void_request", "payments:void_approve",
    "invoices:read", "invoices:send",
    "grades:read", "grades:encode", "grades:submit", "grades:review", "grades:approve", "grades:release", "grades:lock",
    "advisers:read", "advisers:manage",
    "booklets:manage",
    "discounts:read", "discounts:request", "discounts:review", "discounts:manage", "discounts:apply",
    "clearances:read", "clearances:create", "clearances:resolve",
    "archive:read", "archive:manage",
    "documents:read", "documents:create", "documents:process", "documents:release",
    "fee_schedules:manage",
    "school_years:manage",
    "sections:manage",
    "reports:view", "reports:finance", "reports:academic",
    "users:manage",
    "system:manage",
  ],
  registrar: [
    "students:read", "students:create", "students:update",
    "registrations:read", "registrations:create", "registrations:review",
    "curriculums:read",
    "enrollments:read", "enrollments:create", "enrollments:update", "enrollments:confirm", "enrollments:cancel",
    "assessments:read", "assessments:create",
    "payments:read", "payments:post", "payments:void", "payments:void_request",
    "discounts:read", "discounts:request",
    "clearances:read",
    "archive:read", "archive:manage",
    "documents:read", "documents:create", "documents:process",
    "grades:read",
    "advisers:read",
    "reports:view", "reports:academic",
    "sections:manage", "school_years:manage",
  ],
  finance_officer: [
    "students:read",
    "assessments:read", "assessments:create", "assessments:update", "assessments:cancel",
    "payments:read",
    "invoices:read", "invoices:send",
    "booklets:manage", "fee_schedules:manage",
    "discounts:read", "discounts:review", "discounts:manage", "discounts:apply",
    "clearances:read", "clearances:create", "clearances:resolve",
    "archive:read",
    "documents:read", "documents:release",
    "reports:view", "reports:finance",
  ],
  cashier: [
    "students:read",
    "assessments:read",
    "payments:read", "payments:post", "payments:void", "payments:void_request",
    "invoices:read",
    "archive:read",
    "documents:read",
    "reports:view", "reports:finance",
  ],
  teacher: [
    "students:read",
    "curriculums:read",
    "grades:read", "grades:encode", "grades:submit",
  ],
  student: [
    "assessments:read",
    "payments:read",
    "invoices:read",
    "grades:read",
  ],
  parent_guardian: [
    "assessments:read",
    "payments:read",
    "invoices:read",
    "grades:read",
  ],
};

/**
 * Report-page access allowlists.
 *
 * Centralized here so report pages and their `export` route handlers cannot
 * drift out of sync. Guards should call {@link canAccessFinanceReports} /
 * {@link canAccessPaymentReports} (or reference these arrays) rather than
 * defining their own inline lists.
 */
export const FINANCE_REPORT_ROLES: readonly Role[] = [
  "super_admin",
  "admin",
  "finance_officer",
];

export const PAYMENT_REPORT_ROLES: readonly Role[] = [
  "super_admin",
  "admin",
  "registrar",
  "cashier",
];

export function canAccessFinanceReports(role: Role): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? FINANCE_REPORT_ROLES.includes(normalizedRole) : false;
}

export function canAccessPaymentReports(role: Role): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? PAYMENT_REPORT_ROLES.includes(normalizedRole) : false;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;
  return PERMISSIONS[normalizedRole]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? PERMISSIONS[normalizedRole] ?? [] : [];
}

export function isStaffRole(role: Role): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? STAFF_ROLES.includes(normalizedRole) : false;
}

export function isPortalRole(role: Role): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? PORTAL_ROLES.includes(normalizedRole) : false;
}
