/**
 * E2E login credentials for the synthetic accounts provisioned by
 * `e2e/ensure-test-users.ts`. All are env-overridable so CI or a specific
 * environment can point at real accounts instead.
 */
export const e2eSuperAdmin = {
  username: process.env.E2E_SUPER_ADMIN_USERNAME ?? "e2e_super",
  password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "E2eSuper@2026!",
} as const;

export const e2eStaffAdmin = {
  username: process.env.E2E_ADMIN_USERNAME ?? "e2e_admin",
  password: process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin@2026!",
} as const;

export const e2eRegistrar = {
  username: process.env.E2E_REGISTRAR_USERNAME ?? "e2e_registrar",
  password: process.env.E2E_REGISTRAR_PASSWORD ?? "E2eRegistrar@2026!",
} as const;

export const e2eFinance = {
  username: process.env.E2E_FINANCE_USERNAME ?? "e2e_finance",
  password: process.env.E2E_FINANCE_PASSWORD ?? "E2eFinance@2026!",
} as const;
