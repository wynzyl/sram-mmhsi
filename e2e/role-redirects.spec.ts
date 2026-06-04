import { test, expect } from "@playwright/test";
import { e2eSuperAdmin, e2eStaffAdmin } from "./credentials";
import { login as loginHelper } from "./helpers";

test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await loginHelper(page, { username, password });
}

test.describe("Role routes and /admin guard", () => {
  test("super_admin lands on /admin and may open /admin/users", async ({ page }) => {
    await login(page, e2eSuperAdmin.username, e2eSuperAdmin.password);
    await page.waitForURL("**/admin/dashboard**");
    expect(page.url()).toContain("/admin/dashboard");

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test("admin lands on /admin/dashboard and may open staff routes", async ({ page }) => {
    // proxy.ts ROLE_LANDING sends `admin` to /admin/dashboard and the /admin
    // guard admits both super_admin and admin roles.
    await login(page, e2eStaffAdmin.username, e2eStaffAdmin.password);
    await page.waitForURL("**/admin/dashboard**");
    expect(page.url()).toContain("/admin/dashboard");

    await page.goto("/staff/registrations");
    await expect(page).toHaveURL(/\/staff\/registrations/, { timeout: 20_000 });
  });
});
