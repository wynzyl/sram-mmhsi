export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  REGISTRAR: "registrar",
  FINANCE_OFFICER: "finance_officer",
  CASHIER: "cashier",
  TEACHER: "teacher",
  COORDINATOR: "coordinator",
  PRINCIPAL: "principal",
  STUDENT: "student",
  PARENT_GUARDIAN: "parent_guardian",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

const ROLE_SET = new Set<Role>(Object.values(ROLES));
const ROLE_ALIASES: Record<string, Role> = {
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  superAdmin: ROLES.SUPER_ADMIN,
  ADMIN: ROLES.ADMIN,
  REGISTRAR: ROLES.REGISTRAR,
  FINANCE_OFFICER: ROLES.FINANCE_OFFICER,
  financeOfficer: ROLES.FINANCE_OFFICER,
  CASHIER: ROLES.CASHIER,
  TEACHER: ROLES.TEACHER,
  COORDINATOR: ROLES.COORDINATOR,
  PRINCIPAL: ROLES.PRINCIPAL,
  STUDENT: ROLES.STUDENT,
  PARENT_GUARDIAN: ROLES.PARENT_GUARDIAN,
  parentGuardian: ROLES.PARENT_GUARDIAN,
};

export function normalizeRole(role: string | Role | null | undefined): Role | null {
  if (!role) return null;
  if (ROLE_SET.has(role as Role)) return role as Role;
  const alias = ROLE_ALIASES[role];
  if (alias) return alias;
  const lowered = role.toLowerCase();
  if (ROLE_SET.has(lowered as Role)) return lowered as Role;
  return null;
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Administrator",
  admin: "Administrator",
  registrar: "Registrar",
  finance_officer: "Finance Officer",
  cashier: "Cashier",
  teacher: "Teacher",
  coordinator: "Coordinator",
  principal: "Principal",
  student: "Student",
  parent_guardian: "Parent / Guardian",
};

/**
 * Landing route for each role after login and for role-based redirects.
 * Single source of truth shared by the login action and the proxy route guard.
 */
export const ROLE_LANDING: Record<Role, string> = {
  super_admin: "/admin/dashboard",
  admin: "/admin/dashboard",
  registrar: "/staff/dashboard",
  finance_officer: "/staff/finance",
  cashier: "/staff/payments",
  teacher: "/staff/grades",
  coordinator: "/staff/grades",
  principal: "/staff/grades",
  student: "/portal/dashboard",
  parent_guardian: "/portal/dashboard",
};

/** Roles that access the internal staff operations panel */
export const STAFF_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.REGISTRAR,
  ROLES.FINANCE_OFFICER,
  ROLES.CASHIER,
  ROLES.TEACHER,
  ROLES.COORDINATOR,
  ROLES.PRINCIPAL,
];

/** Roles that access the external student/parent portal only */
export const PORTAL_ROLES: Role[] = [ROLES.STUDENT, ROLES.PARENT_GUARDIAN];
