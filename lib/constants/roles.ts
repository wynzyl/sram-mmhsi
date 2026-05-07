export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  REGISTRAR: "registrar",
  FINANCE_OFFICER: "finance_officer",
  CASHIER: "cashier",
  TEACHER: "teacher",
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
  CASHIER: ROLES.CASHIER,
  TEACHER: ROLES.TEACHER,
  STUDENT: ROLES.STUDENT,
  PARENT_GUARDIAN: ROLES.PARENT_GUARDIAN,
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
  student: "Student",
  parent_guardian: "Parent / Guardian",
};

/** Roles that access the internal staff operations panel */
export const STAFF_ROLES: Role[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.REGISTRAR,
  ROLES.FINANCE_OFFICER,
  ROLES.CASHIER,
  ROLES.TEACHER,
];

/** Roles that access the external student/parent portal only */
export const PORTAL_ROLES: Role[] = [ROLES.STUDENT, ROLES.PARENT_GUARDIAN];
