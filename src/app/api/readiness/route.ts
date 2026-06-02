/**
 * Readiness probe endpoint for container orchestration (Kubernetes/ECS).
 * Returns 200 only if the application can serve traffic (DB connected).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { logger } from "@/lib/observability/logger";

export async function GET() {
  try {
    // Simple query to verify database connectivity
    await db.execute(sql`SELECT 1`);

    return Response.json({
      status: "ready",
      database: "connected",
      timestamp: Date.now(),
    });
  } catch (error) {
    // SECURITY: this endpoint is unauthenticated. Never return the raw DB error
    // (it can leak driver/host/connection-string detail). Log it server-side only
    // and return a generic status to the caller.
    logger.error("[readiness] Database connectivity check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json(
      {
        status: "not_ready",
        database: "disconnected",
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
