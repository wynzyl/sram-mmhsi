export const ROLES = {
  ADMIN: "admin",
  REGISTRAR: "registrar",
  FINANCE_OFFICER: "finance_officer",
  CASHIER: "cashier",
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT_GUARDIAN: "parent_guardian",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
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
  ROLES.ADMIN,
  ROLES.REGISTRAR,
  ROLES.FINANCE_OFFICER,
  ROLES.CASHIER,
  ROLES.TEACHER,
];

/** Roles that access the external student/parent portal only */
export const PORTAL_ROLES: Role[] = [ROLES.STUDENT, ROLES.PARENT_GUARDIAN];
