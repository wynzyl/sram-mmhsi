import { Role, STAFF_ROLES, PORTAL_ROLES } from "@/lib/constants/roles";

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
  // Enrollments
  | "enrollments:read"
  | "enrollments:create"
  | "enrollments:cancel"
  // Assessments
  | "assessments:read"
  | "assessments:create"
  | "assessments:update"
  // Payments
  | "payments:read"
  | "payments:post"
  | "payments:void"
  // Invoices
  | "invoices:read"
  | "invoices:send"
  // Grades
  | "grades:read"
  | "grades:encode"
  | "grades:submit"
  | "grades:lock"
  // Receipts
  | "booklets:manage"
  // Reports
  | "reports:finance"
  | "reports:academic"
  // Admin
  | "users:manage"
  | "school_years:manage"
  | "sections:manage"
  | "fee_schedules:manage"
  | "assignments:manage";

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "students:read", "students:create", "students:update", "students:delete",
    "registrations:read", "registrations:create", "registrations:review",
    "enrollments:read", "enrollments:create", "enrollments:cancel",
    "assessments:read", "assessments:create", "assessments:update",
    "payments:read", "payments:post", "payments:void",
    "invoices:read", "invoices:send",
    "grades:read", "grades:encode", "grades:submit", "grades:lock",
    "booklets:manage",
    "reports:finance", "reports:academic",
    "users:manage", "school_years:manage", "sections:manage", "fee_schedules:manage",
    "assignments:manage",
  ],
  registrar: [
    "students:read", "students:create", "students:update",
    "registrations:read", "registrations:create", "registrations:review",
    "enrollments:read", "enrollments:create", "enrollments:cancel",
    "assessments:read", "assessments:create",
    "grades:read",
    "reports:academic",
    "sections:manage", "school_years:manage",
  ],
  finance_officer: [
    "students:read",
    "assessments:read", "assessments:create", "assessments:update",
    "payments:read",
    "invoices:read", "invoices:send",
    "booklets:manage", "fee_schedules:manage",
    "reports:finance",
  ],
  cashier: [
    "students:read",
    "assessments:read",
    "payments:read", "payments:post", "payments:void",
    "invoices:read",
    "reports:finance",
  ],
  teacher: [
    "students:read",
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

export function hasPermission(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return PERMISSIONS[role] ?? [];
}

export function isStaffRole(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

export function isPortalRole(role: Role): boolean {
  return PORTAL_ROLES.includes(role);
}
