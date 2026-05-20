/**
 * Error monitoring interface and hooks.
 * Provides a pluggable adapter pattern for external monitoring services.
 */

import { type ErrorCode, type ErrorSeverity, shouldAlertError, getErrorSeverity } from "./error-codes";
import { isAppError } from "./types";
import { transformError } from "./transform";

// ─── Monitoring Adapter Interface ─────────────────────────────────────────────

/**
 * Error context for monitoring services.
 */
export type ErrorContext = {
  /** Error code */
  code: ErrorCode;
  /** Error severity */
  severity: ErrorSeverity;
  /** User ID if authenticated */
  userId?: string;
  /** User role */
  userRole?: string;
  /** Request path or action name */
  action?: string;
  /** Target entity type */
  entity?: string;
  /** Target entity ID */
  entityId?: string;
  /** Additional tags */
  tags?: Record<string, string>;
  /** Additional metadata */
  extra?: Record<string, unknown>;
};

/**
 * Adapter interface for external monitoring services.
 * Implement this interface to integrate with services like Sentry, Datadog, etc.
 */
export interface MonitoringAdapter {
  /**
   * Report an error to the monitoring service.
   *
   * @param error - The error to report
   * @param context - Additional context about the error
   */
  captureError(error: Error, context: ErrorContext): void;

  /**
   * Report a message/event to the monitoring service.
   *
   * @param message - Message to report
   * @param level - Severity level
   * @param context - Additional context
   */
  captureMessage(
    message: string,
    level: "info" | "warning" | "error",
    context?: Partial<ErrorContext>
  ): void;

  /**
   * Set user context for subsequent error reports.
   *
   * @param userId - User ID
   * @param userRole - User role
   */
  setUser(userId: string, userRole: string): void;

  /**
   * Clear user context.
   */
  clearUser(): void;
}

// ─── Console Adapter (Default) ────────────────────────────────────────────────

/**
 * Default console-based monitoring adapter.
 * Logs errors to console for development/debugging.
 */
class ConsoleMonitoringAdapter implements MonitoringAdapter {
  private currentUser: { id: string; role: string } | null = null;

  captureError(error: Error, context: ErrorContext): void {
    const prefix = `[${context.severity.toUpperCase()}]`;
    const userInfo = this.currentUser
      ? ` user=${this.currentUser.id} role=${this.currentUser.role}`
      : "";

    console.error(
      `${prefix} ${context.code}:${userInfo} action=${context.action ?? "unknown"}`,
      {
        message: error.message,
        entity: context.entity,
        entityId: context.entityId,
        extra: context.extra,
        stack: error.stack,
      }
    );
  }

  captureMessage(
    message: string,
    level: "info" | "warning" | "error",
    context?: Partial<ErrorContext>
  ): void {
    const logFn = level === "error" ? console.error : level === "warning" ? console.warn : console.info;
    logFn(`[${level.toUpperCase()}] ${message}`, context);
  }

  setUser(userId: string, userRole: string): void {
    this.currentUser = { id: userId, role: userRole };
  }

  clearUser(): void {
    this.currentUser = null;
  }
}

// ─── Global Monitoring Instance ───────────────────────────────────────────────

let monitoringAdapter: MonitoringAdapter = new ConsoleMonitoringAdapter();

/**
 * Set the global monitoring adapter.
 * Call this during app initialization to configure external monitoring.
 *
 * @param adapter - Monitoring adapter implementation
 *
 * @example
 * ```typescript
 * // In app initialization (e.g., instrumentation.ts):
 * import * as Sentry from "@sentry/nextjs";
 *
 * class SentryAdapter implements MonitoringAdapter {
 *   captureError(error, context) {
 *     Sentry.captureException(error, {
 *       tags: { code: context.code, severity: context.severity },
 *       extra: context.extra,
 *     });
 *   }
 *   // ... implement other methods
 * }
 *
 * setMonitoringAdapter(new SentryAdapter());
 * ```
 */
export function setMonitoringAdapter(adapter: MonitoringAdapter): void {
  monitoringAdapter = adapter;
}

/**
 * Get the current monitoring adapter.
 */
export function getMonitoringAdapter(): MonitoringAdapter {
  return monitoringAdapter;
}

// ─── Reporting Functions ──────────────────────────────────────────────────────

/**
 * Report an error to the monitoring service.
 * Automatically determines if alerting is needed based on severity.
 *
 * @param error - Error to report (any type, will be transformed to AppError)
 * @param context - Additional context
 *
 * @example
 * ```typescript
 * // In error boundary or catch block:
 * reportError(error, {
 *   action: "students:create",
 *   userId: session?.id,
 *   userRole: session?.role,
 * });
 * ```
 */
export function reportError(
  error: unknown,
  context?: {
    action?: string;
    entity?: string;
    entityId?: string;
    userId?: string;
    userRole?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  const appError = isAppError(error) ? error : transformError(error);
  const severity = getErrorSeverity(appError.code);

  // Only report high/critical errors to monitoring
  if (!shouldAlertError(appError.code)) {
    return;
  }

  const errorContext: ErrorContext = {
    code: appError.code,
    severity,
    userId: context?.userId,
    userRole: context?.userRole,
    action: context?.action,
    entity: context?.entity,
    entityId: context?.entityId,
    tags: context?.tags,
    extra: {
      ...context?.extra,
      fieldErrors: appError.fieldErrors,
      originalContext: appError.context,
    },
  };

  // AppError extends Error, so this cast is always safe
  monitoringAdapter.captureError(appError, errorContext);
}

/**
 * Report an informational message to monitoring.
 *
 * @param message - Message to report
 * @param context - Additional context
 */
export function reportInfo(
  message: string,
  context?: Partial<ErrorContext>
): void {
  monitoringAdapter.captureMessage(message, "info", context);
}

/**
 * Report a warning to monitoring.
 *
 * @param message - Warning message
 * @param context - Additional context
 */
export function reportWarning(
  message: string,
  context?: Partial<ErrorContext>
): void {
  monitoringAdapter.captureMessage(message, "warning", context);
}

/**
 * Set the current user for monitoring context.
 * Call when user logs in.
 *
 * @param userId - User ID
 * @param userRole - User role
 */
export function setMonitoringUser(userId: string, userRole: string): void {
  monitoringAdapter.setUser(userId, userRole);
}

/**
 * Clear the current user from monitoring context.
 * Call when user logs out.
 */
export function clearMonitoringUser(): void {
  monitoringAdapter.clearUser();
}
