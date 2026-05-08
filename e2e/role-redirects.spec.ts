import { test, expect } from "@playwright/test";
import { e2eSuperAdmin, e2eStaffAdmin } from "./credentials";

test.describe.configure({ mode: "serial" });

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/Username or Email/i).fill(username);
  await page.getByLabel(/^Password$/i).fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();
}

test.describe("Role routes and /admin guard", () => {
  test("super_admin lands on /admin and may open /admin/users", async ({ page }) => {
    await login(page, e2eSuperAdmin.username, e2eSuperAdmin.password);
    await page.waitForURL("**/admin/dashboard**");
    expect(page.url()).toContain("/admin/dashboard");

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/users/);
  });

  test("admin lands on staff home; /admin/* redirects away from /admin", async ({ page }) => {
    // `/staff/dashboard` immediately redirects `admin` to `staffHomePathForRole` (registrar queue).
    await login(page, e2eStaffAdmin.username, e2eStaffAdmin.password);
    await page.waitForURL("**/staff/registrations**");
    expect(page.url()).toContain("/staff/registrations");

    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/staff\/registrations/, { timeout: 20_000 });

    await page.goto("/admin/students");
    await expect(page).toHaveURL(/\/staff\/registrations/, { timeout: 20_000 });
  });
});
