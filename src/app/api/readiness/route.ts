/**
 * Readiness probe endpoint for container orchestration (Kubernetes/ECS).
 * Returns 200 only if the application can serve traffic (DB connected).
 */
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

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
    return Response.json(
      {
        status: "not_ready",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
