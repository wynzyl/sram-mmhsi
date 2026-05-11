import "server-only";

/**
 * Extracts PostgreSQL unique constraint name from error.
 * Handles nested error causes and prevents infinite loops.
 *
 * @param err - Error object (typically from Drizzle ORM)
 * @returns Constraint name if found, undefined otherwise
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values({ email: "duplicate@example.com" });
 * } catch (err) {
 *   const constraint = extractUniqueConstraint(err);
 *   if (constraint === "students_email_unique") {
 *     return { errors: { email: ["Email already exists"] } };
 *   }
 * }
 * ```
 */
export function extractUniqueConstraint(err: unknown): string | undefined {
  let e: unknown = err;
  const seen = new Set<unknown>();

  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    const o = e as { code?: string; constraint?: string; cause?: unknown };

    // PostgreSQL unique violation error code
    if (o.code === "23505" && typeof o.constraint === "string") {
      return o.constraint;
    }

    e = o.cause;
  }

  return undefined;
}

/**
 * Checks if error is a PostgreSQL unique constraint violation,
 * optionally matching a specific constraint name.
 *
 * @param err - Error object
 * @param constraint - Optional constraint name to match
 * @returns True if error is unique constraint violation
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values({ studentRef: "STU-2024-00001" });
 * } catch (err) {
 *   if (isUniqueConstraintError(err, "students_student_ref_unique")) {
 *     return { errors: { studentRef: ["Reference number already exists"] } };
 *   }
 * }
 * ```
 */
export function isUniqueConstraintError(err: unknown, constraint?: string): boolean {
  const extracted = extractUniqueConstraint(err);
  if (!extracted) return false;
  if (!constraint) return true;
  return extracted === constraint;
}

/**
 * Converts database error to form error format.
 * Returns null if error is not a known DB constraint violation.
 *
 * @param err - Error object
 * @returns Form error object with field errors, or null
 *
 * @example
 * ```typescript
 * try {
 *   await db.insert(students).values(data);
 * } catch (err) {
 *   const formError = getFormErrorFromDbError(err);
 *   if (formError) return formError;
 *   throw err; // Unknown error, re-throw
 * }
 * ```
 */
export function getFormErrorFromDbError(err: unknown): { errors?: Record<string, string[]> } | null {
  const constraint = extractUniqueConstraint(err);
  if (!constraint) return null;

  // Map known constraints to field errors
  const constraintFieldMap: Record<string, { field: string; message: string }> = {
    students_student_ref_unique: {
      field: "studentRef",
      message: "Student reference number already exists",
    },
    students_email_unique: {
      field: "email",
      message: "Email already exists",
    },
    users_email_unique: {
      field: "email",
      message: "Email already exists",
    },
    users_username_unique: {
      field: "username",
      message: "Username already exists",
    },
    receipt_booklets_series_unique: {
      field: "series",
      message: "Booklet series already exists",
    },
    // Add more constraint mappings as needed
  };

  const mapping = constraintFieldMap[constraint];
  if (mapping) {
    return {
      errors: {
        [mapping.field]: [mapping.message],
      },
    };
  }

  // Unknown constraint, return generic error
  return {
    errors: {
      _form: [`Database constraint violation: ${constraint}`],
    },
  };
}

/**
 * Extracts human-readable error message from any error object.
 * Useful for logging and displaying errors to users.
 *
 * @param err - Error object
 * @returns Error message string
 *
 * @example
 * ```typescript
 * try {
 *   await someOperation();
 * } catch (err) {
 *   logger.error("Operation failed", { error: extractErrorMessage(err) });
 * }
 * ```
 */
export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "string") {
    return err;
  }
  return String(err);
}
