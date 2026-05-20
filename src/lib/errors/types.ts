/**
 * Error types and classes for SRAMS application.
 * Provides structured error handling with error codes and metadata.
 */

import { type ErrorCode, type ErrorSeverity, getErrorSeverity } from "./error-codes";

// ─── Base Application Error ───────────────────────────────────────────────────

/**
 * Base error class for all application errors.
 * Extends native Error with structured metadata for logging and display.
 */
export class AppError extends Error {
  /** Standardized error code from ERROR_CODES */
  readonly code: ErrorCode;
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** HTTP status code (for API responses) */
  readonly statusCode: number;
  /** Field-specific errors for form validation */
  readonly fieldErrors?: Record<string, string[]>;
  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;
  /** Original error that caused this error */
  readonly originalError?: Error;
  /** Timestamp when error occurred */
  readonly timestamp: Date;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      fieldErrors?: Record<string, string[]>;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.severity = getErrorSeverity(code);
    this.statusCode = options?.statusCode ?? 500;
    this.fieldErrors = options?.fieldErrors;
    this.context = options?.context;
    this.originalError = options?.cause;
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Convert to plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      statusCode: this.statusCode,
      fieldErrors: this.fieldErrors,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

// ─── Specialized Error Classes ────────────────────────────────────────────────

/**
 * Database constraint error (unique violation, foreign key, etc.)
 */
export class DatabaseConstraintError extends AppError {
  /** PostgreSQL constraint name */
  readonly constraint?: string;
  /** PostgreSQL error code (e.g., "23505") */
  readonly pgCode?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      constraint?: string;
      pgCode?: string;
      fieldErrors?: Record<string, string[]>;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, {
      statusCode: 409,
      fieldErrors: options?.fieldErrors,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = "DatabaseConstraintError";
    this.constraint = options?.constraint;
    this.pgCode = options?.pgCode;

    Object.setPrototypeOf(this, DatabaseConstraintError.prototype);
  }
}

/**
 * Business rule violation error.
 */
export class BusinessRuleError extends AppError {
  /** Rule identifier for tracking */
  readonly rule?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      rule?: string;
      fieldErrors?: Record<string, string[]>;
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, {
      statusCode: 422,
      fieldErrors: options?.fieldErrors,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = "BusinessRuleError";
    this.rule = options?.rule;

    Object.setPrototypeOf(this, BusinessRuleError.prototype);
  }
}

/**
 * Authentication/authorization error.
 */
export class AuthError extends AppError {
  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(code, message, {
      statusCode: code === "AUTH_PERMISSION_DENIED" ? 403 : 401,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = "AuthError";

    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Validation error (schema/input validation failures).
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    fieldErrors: Record<string, string[]>,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super("VAL_SCHEMA_MISMATCH", message, {
      statusCode: 400,
      fieldErrors,
      context: options?.context,
      cause: options?.cause,
    });
    this.name = "ValidationError";

    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found error.
 */
export class NotFoundError extends AppError {
  /** Entity type that was not found */
  readonly entity: string;
  /** Entity identifier */
  readonly entityId?: string;

  constructor(
    code: ErrorCode,
    entity: string,
    entityId?: string,
    options?: {
      context?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    const message = entityId
      ? `${entity} with ID "${entityId}" not found`
      : `${entity} not found`;

    super(code, message, {
      statusCode: 404,
      context: { ...options?.context, entity, entityId },
      cause: options?.cause,
    });
    this.name = "NotFoundError";
    this.entity = entity;
    this.entityId = entityId;

    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

/**
 * Check if error is an AppError instance.
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is a DatabaseConstraintError instance.
 */
export function isDatabaseConstraintError(
  error: unknown
): error is DatabaseConstraintError {
  return error instanceof DatabaseConstraintError;
}

/**
 * Check if error is a BusinessRuleError instance.
 */
export function isBusinessRuleError(error: unknown): error is BusinessRuleError {
  return error instanceof BusinessRuleError;
}

/**
 * Check if error is an AuthError instance.
 */
export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

/**
 * Check if error is a ValidationError instance.
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is a NotFoundError instance.
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Check if error is a Zod validation error.
 */
export function isZodError(
  error: unknown
): error is { issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    error !== null &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown }).issues)
  );
}

/**
 * Check if error is a PostgreSQL error (from pg/drizzle).
 */
export function isPostgresError(
  error: unknown
): error is { code: string; constraint?: string; detail?: string } {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    (error as { code: string }).code.length === 5
  );
}

// ─── Error Factory Functions ──────────────────────────────────────────────────

/**
 * Create a permission denied error.
 */
export function permissionDenied(
  action: string,
  context?: Record<string, unknown>
): AuthError {
  return new AuthError("AUTH_PERMISSION_DENIED", `Permission denied: ${action}`, {
    context: { ...context, action },
  });
}

/**
 * Create an unauthenticated error.
 */
export function unauthenticated(message = "Authentication required"): AuthError {
  return new AuthError("AUTH_UNAUTHENTICATED", message);
}

/**
 * Create a not found error for a specific entity type.
 */
export function notFound(
  entity: string,
  entityId?: string,
  code?: ErrorCode
): NotFoundError {
  return new NotFoundError(code ?? "DB_RECORD_NOT_FOUND", entity, entityId);
}

/**
 * Create a validation error from field errors.
 */
export function validationFailed(
  fieldErrors: Record<string, string[]>,
  message = "Validation failed"
): ValidationError {
  return new ValidationError(message, fieldErrors);
}
