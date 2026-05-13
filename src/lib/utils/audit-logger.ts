import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { logger } from "@/lib/observability/logger";

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
  /** IP address of the request */
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
      ipAddress: params.ipAddress,
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
