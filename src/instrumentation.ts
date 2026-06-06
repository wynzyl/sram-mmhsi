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

    // Warm the shared postgres pool (fire-and-forget — never block startup).
    // The pool lives on globalThis (src/lib/db/index.ts), so the connections
    // opened here are the SAME ones every route/action bundle uses — without
    // this, the first transaction after a (re)start pays the TCP connect.
    void (async () => {
      try {
        const [{ db }, { sql }] = await Promise.all([
          import("@/lib/db"),
          import("drizzle-orm"),
        ]);
        await Promise.all(
          Array.from({ length: 3 }, () => db.execute(sql`SELECT 1`))
        );
        console.log("[SRAMS] DB pool warmed (3 connections)");
      } catch (error) {
        // Warmup is best-effort; readiness probe surfaces real DB outages.
        console.warn(
          `[SRAMS] DB pool warmup failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    })();
  }
}
