/**
 * Audit Log Retention Cron Endpoint
 *
 * DELETE /api/cron/cleanup-audit-logs
 *
 * Purges audit_logs rows older than AUDIT_LOG_RETENTION_DAYS (365).
 * This endpoint is what actually enforces the retention policy declared in
 * src/lib/utils/audit-logger.ts — without it, `cleanupExpiredAuditLogs()` is
 * documented but never invoked and audit records accumulate indefinitely.
 *
 * Security: Protected by CRON_SECRET environment variable.
 * If CRON_SECRET is not set, the endpoint is disabled.
 * - Only DELETE method is allowed (no GET alias)
 * - Uses timing-safe comparison for secret validation
 *
 * Usage: Call with Authorization: Bearer <CRON_SECRET>
 * Recommended schedule: Daily (retention granularity is days, not hours).
 */

import { NextRequest, NextResponse } from "next/server";
import { cleanupExpiredAuditLogs } from "@/lib/utils/audit-logger";
import { timingSafeCompare } from "@/lib/utils/cron-auth";
import { logger } from "@/lib/observability/logger";

export async function DELETE(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.warn("[cron] Audit log cleanup endpoint called but CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Cron endpoint not configured" },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") ?? "";

  if (!timingSafeCompare(providedSecret, cronSecret)) {
    logger.warn("[cron] Audit log cleanup called with invalid secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await cleanupExpiredAuditLogs();

    logger.info("[cron] Audit log cleanup completed", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("[cron] Audit log cleanup failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
  }
}

// Destructive operation — no GET alias, to prevent CSRF and accidental
// triggering via browser navigation or prefetch.
