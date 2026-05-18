/**
 * Session Cleanup Utility
 *
 * Removes expired sessions from the database.
 * Can be triggered via:
 * 1. Cron job (API endpoint: /api/cron/cleanup-sessions)
 * 2. Manual script (scripts/cleanup-sessions.ts)
 *
 * Per SRAMS Engineering spec: sessions table should be cleaned regularly
 * to prevent unbounded growth.
 */

import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { lt } from "drizzle-orm";
import { logger } from "@/lib/observability/logger";

export type CleanupResult = {
  deleted: number;
  timestamp: string;
};

/**
 * Delete all sessions that have expired.
 * Uses the `expiresAt` column to determine expiration.
 *
 * @returns Number of sessions deleted
 */
export async function cleanupExpiredSessions(): Promise<CleanupResult> {
  const now = new Date();

  try {
    const result = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now))
      .returning({ id: sessions.id });

    const deleted = result.length;

    if (deleted > 0) {
      logger.info("[session-cleanup] Expired sessions cleaned up", {
        deleted,
        timestamp: now.toISOString(),
      });
    }

    return {
      deleted,
      timestamp: now.toISOString(),
    };
  } catch (error) {
    logger.error("[session-cleanup] Failed to cleanup sessions", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get count of expired sessions (for monitoring/reporting).
 */
export async function countExpiredSessions(): Promise<number> {
  const now = new Date();

  const result = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(lt(sessions.expiresAt, now));

  return result.length;
}
