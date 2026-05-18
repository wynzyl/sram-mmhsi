/**
 * SRAMS Error Handling Module
 *
 * Provides production-grade error handling with:
 * - Standardized error codes and severity levels
 * - User-friendly error messages
 * - Database constraint mapping
 * - Automatic error transformation
 * - Audit logging for failures
 * - Monitoring hooks for external services
 * - Server action helpers with built-in error handling
 *
 * @example
 * ```typescript
 * // In a server action:
 * import { transformError, toFormState, logFailure, reportError } from "@/lib/errors";
 *
 * try {
 *   await db.insert(students).values(data);
 *   return { success: true };
 * } catch (err) {
 *   const appError = transformError(err);
 *
 *   // Audit the failure
 *   await logFailure({
 *     session: { id: session.userId, role: session.role },
 *     action: "students:create",
 *     targetEntity: "students",
 *     error: appError,
 *   });
 *
 *   // Report to monitoring (if critical)
 *   reportError(appError, { action: "students:create" });
 *
 *   // Return FormState for UI
 *   return toFormState(appError);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Using createFormAction helper:
 * import { createFormAction, logCreateAction } from "@/lib/errors";
 *
 * export const createStudent = createFormAction<CreateStudentInput, { studentId: string }>(
 *   "students:create",
 *   "students",
 *   async (input, session) => {
 *     const result = schema.safeParse(input);
 *     if (!result.success) {
 *       return { errors: result.error.flatten().fieldErrors };
 *     }
 *
 *     const [student] = await db.insert(students).values(result.data).returning();
 *
 *     await logCreateAction(
 *       { id: session.userId, role: session.role },
 *       "students",
 *       student.id,
 *       { studentRef: student.studentRef }
 *     );
 *
 *     return { success: true, studentId: student.id };
 *   }
 * );
 * ```
 */

// ─── Error Codes ──────────────────────────────────────────────────────────────
export {
  ERROR_CODES,
  type ErrorCode,
  type ErrorSeverity,
  ERROR_SEVERITY,
  shouldAuditError,
  shouldAlertError,
  getErrorSeverity,
} from "./error-codes";

// ─── Error Types ──────────────────────────────────────────────────────────────
export {
  AppError,
  DatabaseConstraintError,
  BusinessRuleError,
  AuthError,
  ValidationError,
  NotFoundError,
  // Type guards
  isAppError,
  isDatabaseConstraintError,
  isBusinessRuleError,
  isAuthError,
  isValidationError,
  isNotFoundError,
  isZodError,
  isPostgresError,
  // Factory functions
  permissionDenied,
  unauthenticated,
  notFound,
  validationFailed,
} from "./types";

// ─── Error Messages ───────────────────────────────────────────────────────────
export {
  ERROR_MESSAGES,
  CONSTRAINT_FIELD_MAP,
  getUserMessage,
  getFieldErrorFromConstraint,
  mapPgErrorCode,
} from "./messages";

// ─── Error Transformation ─────────────────────────────────────────────────────
export {
  transformError,
  errorToFormState,
  toFormState,
  formStateFromZodResult,
  permissionDeniedFormState,
  notFoundFormState,
  extractConstraintName,
  extractPgErrorCode,
} from "./transform";

// ─── Audit Failures ───────────────────────────────────────────────────────────
export {
  logFailure,
  logPermissionDenied,
  logValidationFailure,
  logDatabaseError,
  logFinancialFailure,
  type FailureAuditParams,
} from "./audit-failures";

// ─── Monitoring ───────────────────────────────────────────────────────────────
export {
  type MonitoringAdapter,
  type ErrorContext,
  setMonitoringAdapter,
  getMonitoringAdapter,
  reportError,
  reportInfo,
  reportWarning,
  setMonitoringUser,
  clearMonitoringUser,
} from "./monitoring";

// ─── Action Helpers ───────────────────────────────────────────────────────────
export {
  wrapServerAction,
  createFormAction,
  createFinancialAction,
  logCreateAction,
  logUpdateAction,
  logDeleteAction,
  type ActionSession,
  type ActionWrapperOptions,
  type ActionHandlerResult,
  type ActionHandler,
  type FormActionOptions,
} from "./action-helpers";

// ─── Client-Side Reporting ────────────────────────────────────────────────────
// Note: Only import these in client components
export {
  reportClientError,
  setGlobalErrorHandler,
} from "./client-reporting";
