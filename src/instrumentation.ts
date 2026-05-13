/**
 * Next.js Instrumentation Hook
 *
 * This file runs once when the Next.js server starts.
 * Used for:
 * - Environment variable validation (fail-fast on missing secrets)
 * - APM/monitoring initialization (Sentry, DataDog, etc.)
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server (not edge runtime)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate required environment variables at startup
    const { validateEnv } = await import("@/lib/utils/env");
    validateEnv();

    // Log startup info
    console.log(
      `[SRAMS] Server started in ${process.env.NODE_ENV ?? "development"} mode`
    );
  }
}
