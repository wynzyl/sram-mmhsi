/**
 * ActionResult Type
 *
 * Standardized return type for server actions with type-safe discriminated union.
 * The `ok` property serves as a discriminant for narrowing success vs error cases.
 *
 * @example Server Action
 * ```typescript
 * "use server";
 * import type { ActionResult } from "@/lib/types/action-result";
 *
 * export async function createStudentAction(
 *   formData: FormData
 * ): Promise<ActionResult<{ studentId: string }>> {
 *   // ... validation and business logic
 *
 *   if (error) {
 *     return {
 *       ok: false,
 *       error: {
 *         code: "VALIDATION_ERROR",
 *         message: "Invalid input",
 *         fieldErrors: { firstName: ["Required"] },
 *       },
 *     };
 *   }
 *
 *   return { ok: true, data: { studentId: student.id } };
 * }
 * ```
 *
 * @example Client Usage
 * ```typescript
 * const result = await createStudentAction(formData);
 *
 * if (result.ok) {
 *   // TypeScript knows result.data exists
 *   console.log(result.data.studentId);
 * } else {
 *   // TypeScript knows result.error exists
 *   console.error(result.error.message);
 * }
 * ```
 */

// ─── Core Types ────────────────────────────────────────────────────────────────

/**
 * Success result with typed data payload.
 */
export type ActionSuccess<T> = {
  ok: true;
  data: T;
};

/**
 * Error result with structured error information.
 */
export type ActionError = {
  ok: false;
  error: {
    /** Machine-readable error code for programmatic handling */
    code: string;
    /** Human-readable error message for display */
    message: string;
    /** Field-level validation errors (field name -> error messages) */
    fieldErrors?: Record<string, string[]>;
  };
};

/**
 * Discriminated union for server action results.
 * Use `result.ok` to narrow the type safely.
 *
 * @template T - The type of data returned on success
 */
export type ActionResult<T> = ActionSuccess<T> | ActionError;

// ─── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Create a success result.
 *
 * @example
 * ```typescript
 * return success({ studentId: student.id });
 * ```
 */
export function success<T>(data: T): ActionSuccess<T> {
  return { ok: true, data };
}

/**
 * Create an error result.
 *
 * @example
 * ```typescript
 * return error("NOT_FOUND", "Student not found");
 * return error("VALIDATION_ERROR", "Invalid input", { email: ["Invalid format"] });
 * ```
 */
export function error(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionError {
  return {
    ok: false,
    error: { code, message, fieldErrors },
  };
}

// ─── Common Error Codes ────────────────────────────────────────────────────────

/**
 * Standard error codes for consistent error handling across the application.
 * Use these as the `code` parameter in error results.
 */
export const ERROR_CODES = {
  /** User is not authenticated */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** User lacks permission for this action */
  FORBIDDEN: "FORBIDDEN",
  /** Resource not found */
  NOT_FOUND: "NOT_FOUND",
  /** Input validation failed */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** Business rule violation */
  BUSINESS_RULE_ERROR: "BUSINESS_RULE_ERROR",
  /** Conflict with existing data (e.g., duplicate) */
  CONFLICT: "CONFLICT",
  /** Internal server error */
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** Operation was cancelled or preempted */
  CANCELLED: "CANCELLED",
  /** Concurrent modification detected */
  CONCURRENT_MODIFICATION: "CONCURRENT_MODIFICATION",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─── Type Guards ───────────────────────────────────────────────────────────────

/**
 * Type guard to check if result is a success.
 *
 * @example
 * ```typescript
 * if (isSuccess(result)) {
 *   // result.data is now typed
 * }
 * ```
 */
export function isSuccess<T>(result: ActionResult<T>): result is ActionSuccess<T> {
  return result.ok === true;
}

/**
 * Type guard to check if result is an error.
 *
 * @example
 * ```typescript
 * if (isError(result)) {
 *   // result.error is now available
 * }
 * ```
 */
export function isError<T>(result: ActionResult<T>): result is ActionError {
  return result.ok === false;
}
