import "server-only";
/**
 * Server action helper functions.
 * Provides standardized wrappers for error handling, permission checks, and auditing.
 */

import { getCurrentSession, type SessionPayload } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction, logDeleteAction } from "@/lib/utils/audit-logger";
import { logFailure, logPermissionDenied, logFinancialFailure } from "./audit-failures";
import { reportError } from "./monitoring";
import { transformError, toFormState, permissionDeniedFormState } from "./transform";
import { ERROR_CODES, shouldAuditError } from "./error-codes";
import { type AppError, AuthError } from "./types";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import type { Role } from "@/lib/constants/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Session with role for action handlers.
 */
export type ActionSession = SessionPayload & {
  role: Role;
};

/**
 * Options for server action wrapper.
 */
export type ActionWrapperOptions = {
  /** Permission required to execute this action */
  permission?: Permission;
  /** Target entity type for auditing */
  entity: string;
  /** Action name for auditing (e.g., "create", "update") */
  actionName: string;
  /** If true, require throwOnFail for financial auditing */
  isFinancial?: boolean;
  /** If true, don't require authentication */
  allowUnauthenticated?: boolean;
};

/**
 * Result returned by wrapped action handler.
 */
export type ActionHandlerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

/**
 * Action handler function signature.
 */
export type ActionHandler<TInput, TOutput> = (
  input: TInput,
  session: ActionSession
) => Promise<TOutput>;

// ─── Core Action Wrapper ──────────────────────────────────────────────────────

/**
 * Wrap a server action with standard error handling, permission checks, and auditing.
 *
 * @param handler - The action handler function
 * @param options - Wrapper options (permission, entity, etc.)
 * @returns Wrapped handler that returns ActionHandlerResult
 *
 * @example
 * ```typescript
 * const createStudentHandler = wrapServerAction(
 *   async (input: CreateStudentInput, session) => {
 *     const [student] = await db.insert(students).values(input).returning();
 *     return { studentId: student.id };
 *   },
 *   {
 *     permission: "students:create",
 *     entity: "students",
 *     actionName: "create",
 *   }
 * );
 * ```
 */
export function wrapServerAction<TInput, TOutput>(
  handler: ActionHandler<TInput, TOutput>,
  options: ActionWrapperOptions
): (input: TInput) => Promise<ActionHandlerResult<TOutput>> {
  return async (input: TInput): Promise<ActionHandlerResult<TOutput>> => {
    // 1. Get session
    const session = await getCurrentSession();

    if (!session && !options.allowUnauthenticated) {
      const error = new AuthError(
        ERROR_CODES.AUTH_UNAUTHENTICATED,
        "Authentication required"
      );
      reportError(error, {
        action: `${options.entity}:${options.actionName}`,
        entity: options.entity,
      });
      return { ok: false, error };
    }

    const actionSession = session as ActionSession;

    // 2. Check permission
    if (options.permission && session) {
      if (!hasPermission(session.role as Role, options.permission)) {
        const error = new AuthError(
          ERROR_CODES.AUTH_PERMISSION_DENIED,
          `Permission denied: ${options.permission}`
        );

        await logPermissionDenied(
          { id: session.userId, role: session.role },
          `${options.entity}:${options.actionName}`,
          options.entity
        );

        reportError(error, {
          action: `${options.entity}:${options.actionName}`,
          entity: options.entity,
          userId: session.userId,
          userRole: session.role,
        });

        return { ok: false, error };
      }
    }

    // 3. Execute handler
    try {
      const result = await handler(input, actionSession);
      return { ok: true, data: result };
    } catch (err) {
      const appError = transformError(err);

      // 4. Audit failure
      if (shouldAuditError(appError.code)) {
        if (options.isFinancial) {
          await logFinancialFailure(
            { id: session?.userId, role: session?.role ?? "unknown" },
            `${options.entity}:${options.actionName}`,
            options.entity,
            "unknown",
            appError,
            { input }
          );
        } else {
          await logFailure({
            session: session
              ? { id: session.userId, role: session.role }
              : null,
            action: `${options.entity}:${options.actionName}`,
            targetEntity: options.entity,
            error: appError,
            context: { input },
          });
        }
      }

      // 5. Report to monitoring
      reportError(appError, {
        action: `${options.entity}:${options.actionName}`,
        entity: options.entity,
        userId: session?.userId,
        userRole: session?.role,
      });

      return { ok: false, error: appError };
    }
  };
}

// ─── FormState Action Helpers ─────────────────────────────────────────────────

/**
 * Options for form state action wrapper.
 */
export type FormActionOptions = Omit<ActionWrapperOptions, "allowUnauthenticated">;

/**
 * Create a server action that returns FormState.
 * Handles Zod validation, permission checks, error transformation, and auditing.
 *
 * @param permission - Permission required (from Permission type)
 * @param entity - Target entity for auditing
 * @param handler - Action handler receiving validated input and session
 * @returns Server action function compatible with useActionState
 *
 * @example
 * ```typescript
 * export const createStudent = createFormAction<CreateStudentInput, { studentId: string }>(
 *   "students:create",
 *   "students",
 *   async (input, session) => {
 *     const [student] = await db.insert(students).values(input).returning();
 *     await logCreateAction(
 *       { id: session.userId, role: session.role },
 *       "students",
 *       student.id,
 *       { studentRef: student.studentRef }
 *     );
 *     return { success: true, studentId: student.id };
 *   }
 * );
 * ```
 */
export function createFormAction<TInput, TExtra extends Record<string, unknown> = Record<string, never>>(
  permission: Permission,
  entity: string,
  handler: (
    input: TInput,
    session: ActionSession
  ) => Promise<BaseFormState<TInput> & TExtra>
): (
  prevState: BaseFormState<TInput> & Partial<TExtra>,
  formData: FormData | TInput
) => Promise<BaseFormState<TInput> & Partial<TExtra>> {
  return async (
    _prevState: BaseFormState<TInput> & Partial<TExtra>,
    formData: FormData | TInput
  ): Promise<BaseFormState<TInput> & Partial<TExtra>> => {
    // 1. Get session
    const session = await getCurrentSession();
    if (!session) {
      return {
        message: "Please log in to continue.",
        errors: { _form: ["Authentication required."] },
        success: false,
      } as BaseFormState<TInput> & Partial<TExtra>;
    }

    // 2. Check permission
    if (!hasPermission(session.role as Role, permission)) {
      await logPermissionDenied(
        { id: session.userId, role: session.role },
        `${entity}:${permission.split(":")[1] ?? "action"}`,
        entity
      );
      return permissionDeniedFormState<TInput>(permission) as BaseFormState<TInput> & Partial<TExtra>;
    }

    const actionSession = session as ActionSession;

    // 3. Execute handler (handler is responsible for Zod validation)
    try {
      const result = await handler(formData as TInput, actionSession);
      return result;
    } catch (err) {
      const appError = transformError(err);

      // 4. Audit failure
      if (shouldAuditError(appError.code)) {
        await logFailure({
          session: { id: session.userId, role: session.role },
          action: `${entity}:${permission.split(":")[1] ?? "action"}`,
          targetEntity: entity,
          error: appError,
        });
      }

      // 5. Report to monitoring
      reportError(appError, {
        action: `${entity}:${permission.split(":")[1] ?? "action"}`,
        entity,
        userId: session.userId,
        userRole: session.role,
      });

      return toFormState<TInput>(appError) as BaseFormState<TInput> & Partial<TExtra>;
    }
  };
}

/**
 * Create a financial server action that returns FormState.
 * Same as createFormAction but uses throwOnFail for critical auditing.
 *
 * @param permission - Permission required
 * @param entity - Target entity for auditing
 * @param handler - Action handler
 * @returns Server action function
 *
 * @example
 * ```typescript
 * export const postPayment = createFinancialAction<PostPaymentInput, { paymentId: string }>(
 *   "payments:post",
 *   "payments",
 *   async (input, session) => {
 *     // Payment posting logic with OR number consumption
 *     return { success: true, paymentId: payment.id };
 *   }
 * );
 * ```
 */
export function createFinancialAction<TInput, TExtra extends Record<string, unknown> = Record<string, never>>(
  permission: Permission,
  entity: string,
  handler: (
    input: TInput,
    session: ActionSession
  ) => Promise<BaseFormState<TInput> & TExtra>
): (
  prevState: BaseFormState<TInput> & Partial<TExtra>,
  formData: FormData | TInput
) => Promise<BaseFormState<TInput> & Partial<TExtra>> {
  return async (
    _prevState: BaseFormState<TInput> & Partial<TExtra>,
    formData: FormData | TInput
  ): Promise<BaseFormState<TInput> & Partial<TExtra>> => {
    // 1. Get session
    const session = await getCurrentSession();
    if (!session) {
      return {
        message: "Please log in to continue.",
        errors: { _form: ["Authentication required."] },
        success: false,
      } as BaseFormState<TInput> & Partial<TExtra>;
    }

    // 2. Check permission
    if (!hasPermission(session.role as Role, permission)) {
      await logPermissionDenied(
        { id: session.userId, role: session.role },
        `${entity}:${permission.split(":")[1] ?? "action"}`,
        entity,
        undefined,
        { throwOnFail: true }
      );
      return permissionDeniedFormState<TInput>(permission) as BaseFormState<TInput> & Partial<TExtra>;
    }

    const actionSession = session as ActionSession;

    // 3. Execute handler
    try {
      const result = await handler(formData as TInput, actionSession);
      return result;
    } catch (err) {
      const appError = transformError(err);

      // 4. Audit financial failure (always)
      await logFinancialFailure(
        { id: session.userId, role: session.role },
        `${entity}:${permission.split(":")[1] ?? "action"}`,
        entity,
        "unknown",
        appError
      );

      // 5. Report to monitoring
      reportError(appError, {
        action: `${entity}:${permission.split(":")[1] ?? "action"}`,
        entity,
        userId: session.userId,
        userRole: session.role,
        extra: { financial: true },
      });

      return toFormState<TInput>(appError) as BaseFormState<TInput> & Partial<TExtra>;
    }
  };
}

// ─── Audit Helper Re-exports ──────────────────────────────────────────────────

// Re-export audit helpers for convenience
export { logCreateAction, logUpdateAction, logDeleteAction };
