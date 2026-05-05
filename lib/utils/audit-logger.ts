import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import type { SessionUser, SessionPayload } from "@/lib/auth/session";
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
  /** User ID performing the action */
  actor: string;
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

/**
 * Centralized audit logging utility.
 * Writes audit trail records to the audit_logs table.
 * Catches and logs errors to prevent audit failures from breaking operations.
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
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actor: params.actor,
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
  } catch (err) {
    // Never let audit failure break business operations
    logger.error("[audit] Failed to write audit log", { error: String(err), params });
  }
}

/**
 * Logs a CREATE action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type (e.g., "students", "enrollments")
 * @param id - Created entity ID
 * @param data - Created entity data (partial snapshot)
 *
 * @example
 * ```typescript
 * await logCreateAction(session, "students", student.id, {
 *   studentRef: student.studentRef,
 *   lastName: student.lastName,
 * });
 * ```
 */
export async function logCreateAction(
  session: AuditSession,
  entity: string,
  id: string,
  data?: object
): Promise<void> {
  const actorId = session.id ?? session.userId ?? "unknown";
  await logAudit({
    actor: actorId,
    actorRole: session.role,
    action: `${entity}:create`,
    targetEntity: entity,
    targetId: id,
    newState: data,
  });
}

/**
 * Logs an UPDATE action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type
 * @param id - Updated entity ID
 * @param previous - Previous state snapshot
 * @param updated - New state snapshot
 *
 * @example
 * ```typescript
 * await logUpdateAction(session, "students", studentId, oldData, newData);
 * ```
 */
export async function logUpdateAction(
  session: AuditSession,
  entity: string,
  id: string,
  previous: object,
  updated: object
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
  });
}

/**
 * Logs a DELETE (soft-delete) action audit event.
 *
 * @param session - Current user session (SessionUser or SessionPayload)
 * @param entity - Entity type
 * @param id - Deleted entity ID
 * @param context - Optional deletion context/reason
 *
 * @example
 * ```typescript
 * await logDeleteAction(session, "students", studentId, "Duplicate record");
 * ```
 */
export async function logDeleteAction(
  session: AuditSession,
  entity: string,
  id: string,
  context?: string
): Promise<void> {
  const actorId = session.id ?? session.userId ?? "unknown";
  await logAudit({
    actor: actorId,
    actorRole: session.role,
    action: `${entity}:delete`,
    targetEntity: entity,
    targetId: id,
    context,
  });
}
