/**
 * E2E login defaults align with `scripts/seed.ts` (super admin) and
 * `e2e/ensure-test-users.ts` (synthetic staff admin).
 */
export const e2eSuperAdmin = {
  username: process.env.E2E_SUPER_ADMIN_USERNAME ?? "admin",
  password: process.env.E2E_SUPER_ADMIN_PASSWORD ?? "Admin@2026!",
} as const;

export const e2eStaffAdmin = {
  username: process.env.E2E_ADMIN_USERNAME ?? "e2e_admin",
  password: process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin@2026!",
} as const;
