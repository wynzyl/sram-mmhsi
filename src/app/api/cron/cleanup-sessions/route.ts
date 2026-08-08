/**
 * Session Cleanup Cron Endpoint
 *
 * DELETE /api/cron/cleanup-sessions
 *
 * Removes expired sessions from the database.
 * Intended to be called by a cron job (e.g., Vercel Cron, external scheduler).
 *
 * Security: Protected by CRON_SECRET environment variable.
 * If CRON_SECRET is not set, the endpoint is disabled.
 *
 * SECURITY (A-5):
 * - Only DELETE method is allowed (no GET alias)
 * - Uses timing-safe comparison for secret validation
 *
 * Usage with cron:
 * - Vercel: Add to vercel.json crons configuration
 * - External: Call with Authorization: Bearer <CRON_SECRET>
 *
 * Recommended schedule: Every 6 hours (4 times/day)
 */

import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredSessions } from "@/lib/auth/session-cleanup";
import { timingSafeCompare } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/observability/logger";

export async function DELETE(req: NextRequest) {
  // Validate cron secret for security
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("[cron] Session cleanup endpoint called but CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  // Check authorization header
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") ?? "";

  // SECURITY (A-5): Use timing-safe comparison to prevent timing attacks
  if (!timingSafeCompare(providedSecret, cronSecret)) {
    logger.warn("[cron] Session cleanup called with invalid secret");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await cleanupExpiredSessions();

    logger.info("[cron] Session cleanup completed", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("[cron] Session cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}

// SECURITY (A-5): GET method removed - destructive operations should not be accessible via GET
// This prevents CSRF attacks and accidental triggering via browser navigation/prefetch
