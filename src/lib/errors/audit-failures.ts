import "server-only";
/**
 * Audit logging for error events.
 * Extends the existing audit-logger with failure-specific functionality.
 */

import { logAudit, type AuditOptions } from "@/lib/utils/audit-logger";
import { logger } from "@/lib/observability/logger";
import {
  ERROR_CODES,
  type ErrorCode,
  shouldAuditError,
  getErrorSeverity,
} from "./error-codes";
import { type AppError, isAppError } from "./types";
import { transformError } from "./transform";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Session type for audit logging.
 */
type AuditSession = {
  id?: string;
  userId?: string;
  role: string;
};

/**
 * Parameters for logging a failure event.
 */
export type FailureAuditParams = {
  /** User session (can be null for unauthenticated errors) */
  session: AuditSession | null;
  /** Action that was attempted */
  action: string;
  /** Target entity type */
  targetEntity: string;
  /** Target entity ID (if known) */
  targetId?: string;
  /** Error that occurred */
  error: AppError | unknown;
  /** Additional context */
  context?: Record<string, unknown>;
};

// ─── Audit Functions ──────────────────────────────────────────────────────────

/**
 * Log a failure event to audit logs.
 * Automatically determines if auditing is needed based on error severity.
 *
 * @param params - Failure audit parameters
 * @param options - Audit options
 *
 * @example
 * ```typescript
 * catch (err) {
 *   await logFailure({
 *     session,
 *     action: "students:create",
 *     targetEntity: "students",
 *     error: err,
 *   });
 * }
 * ```
 */
export async function logFailure(
  params: FailureAuditParams,
  options: AuditOptions = {}
): Promise<void> {
  const appError = isAppError(params.error)
    ? params.error
    : transformError(params.error);

  // Check if this error should be audited based on severity
  if (!shouldAuditError(appError.code)) {
    // Still log to observability for debugging
    logger.debug("[error] Low severity error not audited", {
      code: appError.code,
      action: params.action,
    });
    return;
  }

  const actorId = params.session?.id ?? params.session?.userId ?? null;
  const actorRole = params.session?.role ?? "unauthenticated";

  await logAudit(
    {
      actor: actorId,
      actorRole,
      action: `${params.action}:failed`,
      targetEntity: params.targetEntity,
      targetId: params.targetId ?? "unknown",
      newState: {
        errorCode: appError.code,
        errorMessage: appError.message,
        severity: getErrorSeverity(appError.code),
        fieldErrors: appError.fieldErrors,
        ...params.context,
      },
    },
    options
  );
}

/**
 * Log a permission denied failure.
 *
 * @param session - User session
 * @param action - Action that was denied
 * @param targetEntity - Target entity type
 * @param targetId - Target entity ID
 * @param options - Audit options
 */
export async function logPermissionDenied(
  session: AuditSession,
  action: string,
  targetEntity: string,
  targetId?: string,
  options: AuditOptions = {}
): Promise<void> {
  await logAudit(
    {
      actor: session.id ?? session.userId ?? "unknown",
      actorRole: session.role,
      action: `${action}:permission_denied`,
      targetEntity,
      targetId: targetId ?? "unknown",
      newState: {
        errorCode: ERROR_CODES.AUTH_PERMISSION_DENIED,
        severity: "high",
        attemptedAction: action,
      },
    },
    options
  );
}

/**
 * Log a validation failure.
 *
 * @param session - User session (can be null)
 * @param action - Action that was attempted
 * @param targetEntity - Target entity type
 * @param fieldErrors - Validation field errors
 * @param options - Audit options
 */
export async function logValidationFailure(
  session: AuditSession | null,
  action: string,
  targetEntity: string,
  fieldErrors: Record<string, string[]>,
  options: AuditOptions = {}
): Promise<void> {
  // Validation failures are low severity, only audit if option set
  const actorId = session?.id ?? session?.userId ?? null;

  await logAudit(
    {
      actor: actorId,
      actorRole: session?.role ?? "unauthenticated",
      action: `${action}:validation_failed`,
      targetEntity,
      targetId: "unknown",
      newState: {
        errorCode: ERROR_CODES.VAL_SCHEMA_MISMATCH,
        severity: "low",
        fieldErrors,
      },
    },
    options
  );
}

/**
 * Log a database error.
 *
 * @param session - User session
 * @param action - Action that was attempted
 * @param targetEntity - Target entity type
 * @param error - Database error
 * @param options - Audit options
 */
export async function logDatabaseError(
  session: AuditSession,
  action: string,
  targetEntity: string,
  error: {
    code: ErrorCode;
    constraint?: string;
    message: string;
  },
  options: AuditOptions = {}
): Promise<void> {
  await logAudit(
    {
      actor: session.id ?? session.userId ?? "unknown",
      actorRole: session.role,
      action: `${action}:db_error`,
      targetEntity,
      targetId: "unknown",
      newState: {
        errorCode: error.code,
        severity: getErrorSeverity(error.code),
        constraint: error.constraint,
        message: error.message,
      },
    },
    options
  );
}

/**
 * Log a financial operation failure.
 * Always uses throwOnFail: true for critical financial operations.
 *
 * @param session - User session
 * @param action - Financial action that failed
 * @param targetEntity - Target entity (e.g., "payments", "assessments")
 * @param targetId - Target ID (e.g., payment ID)
 * @param error - Error that occurred
 * @param context - Additional context (amounts, OR numbers, etc.)
 */
export async function logFinancialFailure(
  session: AuditSession,
  action: string,
  targetEntity: string,
  targetId: string,
  error: AppError | unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const appError = isAppError(error) ? error : transformError(error);

  await logAudit(
    {
      actor: session.id ?? session.userId ?? "unknown",
      actorRole: session.role,
      action: `${action}:failed`,
      targetEntity,
      targetId,
      newState: {
        errorCode: appError.code,
        errorMessage: appError.message,
        severity: "critical",
        ...context,
      },
    },
    { throwOnFail: true }
  );
}
