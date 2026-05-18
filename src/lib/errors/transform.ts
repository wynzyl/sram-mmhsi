/**
 * Central error transformation pipeline.
 * Converts any error type to AppError and FormState format.
 */

import { ZodError } from "zod";
import { ERROR_CODES, type ErrorCode } from "./error-codes";
import {
  AppError,
  DatabaseConstraintError,
  ValidationError,
  isAppError,
  isZodError,
} from "./types";
import {
  getUserMessage,
  getFieldErrorFromConstraint,
  mapPgErrorCode,
} from "./messages";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Error Transformation ─────────────────────────────────────────────────────

/**
 * Extract PostgreSQL constraint name from error chain.
 * Handles nested error causes from Drizzle ORM.
 */
export function extractConstraintName(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const obj = current as {
      code?: string;
      constraint?: string;
      cause?: unknown;
    };

    if (obj.code === "23505" && typeof obj.constraint === "string") {
      return obj.constraint;
    }

    current = obj.cause;
  }

  return undefined;
}

/**
 * Extract PostgreSQL error code from error chain.
 */
export function extractPgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  const seen = new Set<unknown>();

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const obj = current as { code?: string; cause?: unknown };

    if (typeof obj.code === "string" && obj.code.length === 5) {
      return obj.code;
    }

    current = obj.cause;
  }

  return undefined;
}

/**
 * Transform any error into a standardized AppError.
 * Handles: Zod errors, PostgreSQL errors, AppErrors, and generic errors.
 *
 * @param error - Any error object
 * @param defaultCode - Default error code if type cannot be determined
 * @returns AppError instance
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values(data);
 * } catch (err) {
 *   const appError = transformError(err);
 *   // appError.code, appError.message, appError.fieldErrors available
 * }
 * ```
 */
export function transformError(
  error: unknown,
  defaultCode: ErrorCode = ERROR_CODES.SYS_INTERNAL_ERROR
): AppError {
  // Already an AppError - return as-is
  if (isAppError(error)) {
    return error;
  }

  // Zod validation error
  if (error instanceof ZodError || isZodError(error)) {
    const zodError = error as ZodError;
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of zodError.issues) {
      const path = issue.path.join(".") || "_form";
      if (!fieldErrors[path]) {
        fieldErrors[path] = [];
      }
      fieldErrors[path].push(issue.message);
    }

    return new ValidationError("Validation failed", fieldErrors, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  // PostgreSQL error (from Drizzle/pg)
  const pgCode = extractPgErrorCode(error);
  if (pgCode) {
    const constraintName = extractConstraintName(error);
    const mappedCode = mapPgErrorCode(pgCode);

    // Check for specific constraint mapping
    if (constraintName) {
      const fieldMapping = getFieldErrorFromConstraint(constraintName);
      if (fieldMapping) {
        return new DatabaseConstraintError(
          fieldMapping.code,
          fieldMapping.message,
          {
            constraint: constraintName,
            pgCode,
            fieldErrors: { [fieldMapping.field]: [fieldMapping.message] },
            cause: error instanceof Error ? error : undefined,
          }
        );
      }
    }

    // Generic database error
    return new DatabaseConstraintError(
      mappedCode,
      getUserMessage(mappedCode),
      {
        constraint: constraintName,
        pgCode,
        cause: error instanceof Error ? error : undefined,
      }
    );
  }

  // Generic Error
  if (error instanceof Error) {
    return new AppError(defaultCode, getUserMessage(defaultCode), {
      context: { originalMessage: error.message },
      cause: error,
    });
  }

  // Unknown error type
  return new AppError(defaultCode, getUserMessage(defaultCode), {
    context: { rawError: String(error) },
  });
}

// ─── FormState Conversion ─────────────────────────────────────────────────────

/**
 * Convert AppError to BaseFormState format for form display.
 *
 * @param error - AppError instance
 * @returns FormState object compatible with useActionState
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values(data);
 *   return { success: true };
 * } catch (err) {
 *   return errorToFormState(transformError(err));
 * }
 * ```
 */
export function errorToFormState<T = Record<string, unknown>>(
  error: AppError
): BaseFormState<T> {
  const state: BaseFormState<T> = {
    message: error.message,
    success: false,
  };

  if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
    state.errors = error.fieldErrors as BaseFormState<T>["errors"];
  } else {
    // Put message in _form errors if no field-specific errors
    state.errors = {
      _form: [error.message],
    } as BaseFormState<T>["errors"];
  }

  return state;
}

/**
 * Convert any error to FormState format.
 * Combines transformError + errorToFormState.
 *
 * @param error - Any error object
 * @param defaultCode - Default error code
 * @returns FormState object
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values(data);
 *   return { success: true };
 * } catch (err) {
 *   return toFormState(err);
 * }
 * ```
 */
export function toFormState<T = Record<string, unknown>>(
  error: unknown,
  defaultCode?: ErrorCode
): BaseFormState<T> {
  const appError = transformError(error, defaultCode);
  return errorToFormState<T>(appError);
}

// ─── Validation Helpers ───────────────────────────────────────────────────────

/**
 * Create FormState from Zod safe parse result.
 * Returns null if parsing succeeded, FormState if failed.
 *
 * @param result - Zod safeParse result
 * @returns FormState or null
 *
 * @example
 * ```typescript
 * const result = schema.safeParse(data);
 * const validationError = formStateFromZodResult(result);
 * if (validationError) return validationError;
 *
 * // result.data is now typed and validated
 * ```
 */
export function formStateFromZodResult<T, U = Record<string, unknown>>(
  result: { success: false; error: ZodError<T> } | { success: true; data: T }
): BaseFormState<U> | null {
  if (result.success) {
    return null;
  }

  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".") || "_form";
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return {
    errors: fieldErrors as BaseFormState<U>["errors"],
    success: false,
  };
}

/**
 * Create a permission denied FormState.
 *
 * @param action - Action that was denied
 * @returns FormState with permission error
 */
export function permissionDeniedFormState<T = Record<string, unknown>>(
  action: string
): BaseFormState<T> {
  return {
    message: `Permission denied: ${action}`,
    errors: { _form: [`You do not have permission to ${action}.`] } as BaseFormState<T>["errors"],
    success: false,
  };
}

/**
 * Create a not found FormState.
 *
 * @param entity - Entity type that was not found
 * @returns FormState with not found error
 */
export function notFoundFormState<T = Record<string, unknown>>(
  entity: string
): BaseFormState<T> {
  return {
    message: `${entity} not found`,
    errors: { _form: [`${entity} not found.`] } as BaseFormState<T>["errors"],
    success: false,
  };
}
