import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { logger } from "@/lib/observability/logger";
import { lte } from "drizzle-orm";

/**
 * Internal retention policy: audit records should be purged after 365 days so
 * exported/correlation data doesn't become a permanent PII-bearing store.
 * A scheduled cleanup job or database TTL can enforce this boundary.
 */
export const AUDIT_LOG_RETENTION_DAYS = 365;

/**
 * Audit logging stores a fixed-size SHA-256 digest of the client IP, not the raw
 * IP string. The existing `audit_logs.ip_address` column remains nullable for
 * compatibility, but callers should treat it as a privacy-safe fingerprint only.
 */
export function anonymizeIpAddressForAuditLog(ipAddress?: string | null): string | null {
  if (!ipAddress) return null;

  const normalized = ipAddress.trim();
  if (!normalized || normalized === "unknown" || normalized === "null") {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Type representing a user session for audit logging.
 * Accepts both SessionUser (from getCurrentUser) and SessionPayload (from requireSession).
 */
type AuditSession = {
  id?: string;
  userId?: string;
  role: string;
};

/**
 * Parameters for logging an audit event.
 */
export type AuditParams = {
  /** User ID performing the action (nullable for system/unknown actor events) */
  actor?: string | null;
  /** User role at time of action */
  actorRole: string;
  /** Action performed (e.g., "students:create", "payments:post") */
  action: string;
  /** Target entity type (e.g., "students", "payments") */
  targetEntity: string;
  /** Target entity ID */
  targetId: string;
  /** Previous state (object will be JSON stringified) */
  previousState?: object;
  /** New state (object will be JSON stringified) */
  newState?: object;
  /** Additional context */
  context?: string;
  /** Correlation ID for tracing related operations */
  correlationId?: string;
  /** Client IP from request context; stored as a SHA-256 digest in `audit_logs.ip_address`. */
  ipAddress?: string;
};

export type AuditOptions = {
  /** When true, rethrow write failures so callers can fail-closed. */
  throwOnFail?: boolean;
};

export type AuditResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Centralized audit logging utility.
 * Writes audit trail records to the audit_logs table.
 * Logs failures and returns explicit success/failure.
 * Callers can opt into fail-closed behavior via `{ throwOnFail: true }`.
 *
 * @param params - Audit event parameters
 *
 * @example
 * ```typescript
 * await logAudit({
 *   actor: session.id,
 *   actorRole: session.role,
 *   action: "students:create",
 *   targetEntity: "students",
 *   targetId: student.id,
 *   newState: { studentRef: student.studentRef, name: student.lastName },
 * });
 * ```
 */
export async function logAudit(
  params: AuditParams,
  options: AuditOptions = {}
): Promise<AuditResult> {
  try {
    await db.insert(auditLogs).values({
      actor: params.actor ?? null,
      actorRole: params.actorRole,
      action: params.action,
      targetEntity: params.targetEntity,
      targetId: params.targetId,
      previousState: params.previousState ? JSON.stringify(params.previousState) : undefined,
      newState: params.newState ? JSON.stringify(params.newState) : undefined,
      context: params.context,
      correlationId: params.correlationId ?? crypto.randomUUID(),
      ipAddress: anonymizeIpAddressForAuditLog(params.ipAddress),
    });
    return { success: true };
  } catch (err) {
    const errorMessage = String(err);
    logger.error("[audit] Failed to write audit log", { error: errorMessage, params });
    if (options.throwOnFail) {
      throw err;
    }
    return { success: false, error: errorMessage };
  }
}

/**
 * Batch audit logging - inserts multiple audit entries in a single query.
 * Useful for operations that affect multiple entities (e.g., balance forward).
 *
 * @param paramsArray - Array of audit event parameters
 * @param options - Audit options (e.g., throwOnFail for financial operations)
 * @returns Batch result with count of logged entries
 */
export async function logAuditBatch(
  paramsArray: AuditParams[],
  options: AuditOptions = {}
): Promise<{ success: boolean; count: number; error?: string }> {
  if (paramsArray.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const correlationId = crypto.randomUUID();
    const values = paramsArray.map((params) => ({
      actor: params.actor ?? null,
      actorRole: params.actorRole,
      action: params.action,
      targetEntity: params.targetEntity,
      targetId: params.targetId,
      previousState: params.previousState ? JSON.stringify(params.previousState) : undefined,
      newState: params.newState ? JSON.stringify(params.newState) : undefined,
      context: params.context,
      correlationId: params.correlationId ?? correlationId,
      ipAddress: anonymizeIpAddressForAuditLog(params.ipAddress),
    }));

    await db.insert(auditLogs).values(values);
    return { success: true, count: paramsArray.length };
  } catch (err) {
    const errorMessage = String(err);
    logger.error("[audit] Failed to write batch audit logs", {
      error: errorMessage,
      count: paramsArray.length,
    });
    if (options.throwOnFail) {
      throw err;
    }
    return { success: false, count: 0, error: errorMessage };
  }
}

/**
 * Retention boundary for audit records. This is a server-only cleanup helper that
 * can be invoked from a cron route or scheduler and is documented in assistance
 * material as the operational mechanism enforcing the stated 365-day policy.
 */
export async function cleanupExpiredAuditLogs(): Promise<{ deletedCount: number }> {
  const cutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .delete(auditLogs)
    .where(lte(auditLogs.createdAt, cutoff))
    .returning({ id: auditLogs.id });

  const deletedCount = rows.length;

  if (deletedCount > 0) {
    logger.info("[audit] Purged expired audit-log rows", {
      deletedCount,
      retentionDays: AUDIT_LOG_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
    });
  }

  return { deletedCount };
}

/**
 * Logs a CREATE action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type (e.g., "students", "enrollments")
 * @param id - Created entity ID
 * @param data - Created entity data (partial snapshot)
 * @param options - Audit options (e.g., throwOnFail for financial operations)
 *
 * @example
 * ```typescript
 * await logCreateAction(session, "students", student.id, {
 *   studentRef: student.studentRef,
 *   lastName: student.lastName,
 * }, { throwOnFail: true }); // For critical operations
 * ```
 */
export async function logCreateAction(
  session: AuditSession,
  entity: string,
  id: string,
  data?: object,
  options: AuditOptions = {}
): Promise<void> {
  const actorId = session.id ?? session.userId ?? "unknown";
  await logAudit({
    actor: actorId,
    actorRole: session.role,
    action: `${entity}:create`,
    targetEntity: entity,
    targetId: id,
    newState: data,
  }, options);
}

/**
 * Logs an UPDATE action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type
 * @param id - Updated entity ID
 * @param previous - Previous state snapshot
 * @param updated - New state snapshot
 * @param options - Audit options (e.g., throwOnFail for financial operations)
 *
 * @example
 * ```typescript
 * await logUpdateAction(session, "students", studentId, oldData, newData, { throwOnFail: true });
 * ```
 */
export async function logUpdateAction(
  session: AuditSession,
  entity: string,
  id: string,
  previous: object,
  updated: object,
  options: AuditOptions = {}
): Promise<void> {
  const actorId = session.id ?? session.userId ?? "unknown";
  await logAudit({
    actor: actorId,
    actorRole: session.role,
    action: `${entity}:update`,
    targetEntity: entity,
    targetId: id,
    previousState: previous,
    newState: updated,
  }, options);
}

/**
 * Logs a DELETE (soft-delete) action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type
 * @param id - Deleted entity ID
 * @param context - Optional deletion context/reason
 * @param options - Audit options (e.g., throwOnFail for financial operations)
 *
 * @example
 * ```typescript
 * await logDeleteAction(session, "students", studentId, "Duplicate record", { throwOnFail: true });
 * ```
 */
export async function logDeleteAction(
  session: AuditSession,
  entity: string,
  id: string,
  context?: string,
  options: AuditOptions = {}
): Promise<void> {
  const actorId = session.id ?? session.userId ?? "unknown";
  await logAudit({
    actor: actorId,
    actorRole: session.role,
    action: `${entity}:delete`,
    targetEntity: entity,
    targetId: id,
    context,
  }, options);
}
