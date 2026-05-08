import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const e2ePort = process.env.E2E_PORT ?? "3005";
const defaultBaseUrl = `http://127.0.0.1:${e2ePort}`;
const skipWebServer = !!process.env.E2E_SKIP_WEBSERVER;
const baseURL =
  process.env.E2E_BASE_URL ?? (skipWebServer ? "http://127.0.0.1:3000" : defaultBaseUrl);

const webServer = skipWebServer
  ? undefined
  : {
      /** Production server on a free port — avoids Next.js “single dev server per project dir” lock. */
      command: `npm run build && npx next start -H 127.0.0.1 -p ${e2ePort}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 300_000,
    };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  globalSetup: path.join(__dirname, "e2e/global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(webServer ? { webServer } : {}),
});
