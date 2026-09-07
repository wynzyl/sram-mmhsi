/**
 * Page Load Performance Tests
 *
 * Measures load times for dynamic pages in the application.
 * Run with: npm run test:e2e -- e2e/page-performance.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";
import { login, logout } from "./helpers";
import { e2eStaffAdmin, e2eRegistrar, e2eFinance } from "./credentials";

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  fast: 1000,      // < 1s is fast
  acceptable: 3000, // < 3s is acceptable
  slow: 5000,      // < 5s is slow, > 5s is critical
};

type PerformanceResult = {
  page: string;
  loadTime: number;
  status: "fast" | "acceptable" | "slow" | "critical";
  domContentLoaded: number;
  firstPaint?: number;
};

const results: PerformanceResult[] = [];

function getStatus(loadTime: number): PerformanceResult["status"] {
  if (loadTime < THRESHOLDS.fast) return "fast";
  if (loadTime < THRESHOLDS.acceptable) return "acceptable";
  if (loadTime < THRESHOLDS.slow) return "slow";
  return "critical";
}

async function measurePageLoad(page: Page, url: string, pageName: string): Promise<PerformanceResult> {
  const startTime = Date.now();

  // Navigate and wait for network to be idle
  await page.goto(url, { waitUntil: "networkidle" });

  const loadTime = Date.now() - startTime;

  // Get performance metrics from the browser
  const perfMetrics = await page.evaluate(() => {
    const timing = performance.timing;
    const paintEntries = performance.getEntriesByType("paint");
    const firstPaint = paintEntries.find(e => e.name === "first-paint");

    return {
      domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
      firstPaint: firstPaint?.startTime,
    };
  });

  const result: PerformanceResult = {
    page: pageName,
    loadTime,
    status: getStatus(loadTime),
    domContentLoaded: perfMetrics.domContentLoaded,
    firstPaint: perfMetrics.firstPaint,
  };

  results.push(result);
  return result;
}

test.describe("Page Load Performance", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    // Clear results for fresh run
    results.length = 0;
  });

  test.afterAll(async () => {
    // Print performance report
    console.log("\n");
    console.log("═".repeat(80));
    console.log("PAGE LOAD PERFORMANCE REPORT");
    console.log("═".repeat(80));
    console.log("");

    // Sort by load time (slowest first)
    const sorted = [...results].sort((a, b) => b.loadTime - a.loadTime);

    for (const r of sorted) {
      const statusIcon = {
        fast: "🟢",
        acceptable: "🟡",
        slow: "🟠",
        critical: "🔴",
      }[r.status];

      console.log(`${statusIcon} ${r.page}`);
      console.log(`   Load Time: ${r.loadTime}ms | DOM Ready: ${r.domContentLoaded}ms | First Paint: ${r.firstPaint?.toFixed(0) ?? "N/A"}ms`);
      console.log("");
    }

    // Summary
    const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / results.length;
    const fastCount = results.filter(r => r.status === "fast").length;
    const acceptableCount = results.filter(r => r.status === "acceptable").length;
    const slowCount = results.filter(r => r.status === "slow").length;
    const criticalCount = results.filter(r => r.status === "critical").length;

    console.log("─".repeat(80));
    console.log("SUMMARY");
    console.log("─".repeat(80));
    console.log(`Total Pages Tested: ${results.length}`);
    console.log(`Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
    console.log(`🟢 Fast (<1s): ${fastCount}`);
    console.log(`🟡 Acceptable (<3s): ${acceptableCount}`);
    console.log(`🟠 Slow (<5s): ${slowCount}`);
    console.log(`🔴 Critical (>5s): ${criticalCount}`);
    console.log("═".repeat(80));
  });

  test("login page (public)", async ({ page }) => {
    const result = await measurePageLoad(page, "/login", "/login");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("staff dashboard", async ({ page }) => {
    await login(page, e2eStaffAdmin);
    const result = await measurePageLoad(page, "/staff/dashboard", "/staff/dashboard");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("students list", async ({ page }) => {
    await login(page, e2eRegistrar);
    const result = await measurePageLoad(page, "/staff/students", "/staff/students");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("enrollments list", async ({ page }) => {
    await login(page, e2eRegistrar);
    const result = await measurePageLoad(page, "/staff/enrollments", "/staff/enrollments");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("assessments list", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/assessments", "/staff/assessments");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("payments list", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/payments", "/staff/payments");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("receipt booklets", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/finance/booklets", "/staff/finance/booklets");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("sections list", async ({ page }) => {
    await login(page, e2eRegistrar);
    const result = await measurePageLoad(page, "/staff/academics/sections", "/staff/academics/sections");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("curriculums list", async ({ page }) => {
    await login(page, e2eRegistrar);
    const result = await measurePageLoad(page, "/staff/academics/curriculums", "/staff/academics/curriculums");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("archive list", async ({ page }) => {
    await login(page, e2eRegistrar);
    const result = await measurePageLoad(page, "/staff/archive", "/staff/archive");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("admin users list", async ({ page }) => {
    await login(page, e2eStaffAdmin);
    const result = await measurePageLoad(page, "/admin/users", "/admin/users");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("admin dashboard", async ({ page }) => {
    await login(page, e2eStaffAdmin);
    const result = await measurePageLoad(page, "/admin/dashboard", "/admin/dashboard");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("reports - payment collection", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/reports/payment-collection", "/staff/reports/payment-collection");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("fee templates", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/finance/fee-templates", "/staff/finance/fee-templates");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });

  test("invoices list", async ({ page }) => {
    await login(page, e2eFinance);
    const result = await measurePageLoad(page, "/staff/invoices", "/staff/invoices");
    expect(result.loadTime).toBeLessThan(THRESHOLDS.slow);
  });
});
