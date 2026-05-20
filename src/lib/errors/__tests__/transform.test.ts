import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  transformError,
  errorToFormState,
  toFormState,
  formStateFromZodResult,
  permissionDeniedFormState,
  notFoundFormState,
  extractConstraintName,
  extractPgErrorCode,
} from "../transform";
import {
  AppError,
  ValidationError,
  DatabaseConstraintError,
} from "../types";
import { ERROR_CODES } from "../error-codes";

describe("extractConstraintName", () => {
  it("extracts constraint from direct error", () => {
    const error = {
      code: "23505",
      constraint: "users_email_unique",
    };
    expect(extractConstraintName(error)).toBe("users_email_unique");
  });

  it("extracts constraint from nested cause", () => {
    const error = {
      message: "Database error",
      cause: {
        code: "23505",
        constraint: "students_student_ref_unique",
      },
    };
    expect(extractConstraintName(error)).toBe("students_student_ref_unique");
  });

  it("returns undefined when no constraint found", () => {
    const error = new Error("Generic error");
    expect(extractConstraintName(error)).toBeUndefined();
  });

  it("handles circular references safely", () => {
    const error: { cause?: unknown } = { cause: null };
    error.cause = error;
    expect(extractConstraintName(error)).toBeUndefined();
  });
});

describe("extractPgErrorCode", () => {
  it("extracts pg error code from direct error", () => {
    const error = { code: "23505" };
    expect(extractPgErrorCode(error)).toBe("23505");
  });

  it("extracts pg error code from nested cause", () => {
    const error = {
      message: "DB error",
      cause: { code: "23503" },
    };
    expect(extractPgErrorCode(error)).toBe("23503");
  });

  it("returns undefined for non-pg errors", () => {
    const error = { code: "ERR_HTTP" };
    expect(extractPgErrorCode(error)).toBeUndefined();
  });
});

describe("transformError", () => {
  it("returns AppError unchanged", () => {
    const appError = new AppError(ERROR_CODES.STU_NOT_FOUND, "Student not found");
    const result = transformError(appError);
    expect(result).toBe(appError);
  });

  it("transforms ZodError to ValidationError", () => {
    const schema = z.object({
      email: z.string().email(),
      name: z.string().min(1),
    });

    const result = schema.safeParse({ email: "invalid", name: "" });
    if (result.success) throw new Error("Expected validation to fail");

    const transformed = transformError(result.error);

    expect(transformed).toBeInstanceOf(ValidationError);
    expect(transformed.code).toBe(ERROR_CODES.VAL_SCHEMA_MISMATCH);
    expect(transformed.fieldErrors).toBeDefined();
    expect(transformed.fieldErrors?.email).toBeDefined();
    expect(transformed.fieldErrors?.name).toBeDefined();
  });

  it("transforms PostgreSQL unique violation to DatabaseConstraintError", () => {
    const pgError = {
      code: "23505",
      constraint: "students_email_unique",
    };

    const transformed = transformError(pgError);

    expect(transformed).toBeInstanceOf(DatabaseConstraintError);
    expect(transformed.code).toBe(ERROR_CODES.STU_EMAIL_DUPLICATE);
    expect(transformed.fieldErrors?.email).toContain("Email already exists.");
  });

  it("transforms unknown PostgreSQL constraint to generic error", () => {
    const pgError = {
      code: "23505",
      constraint: "unknown_constraint",
    };

    const transformed = transformError(pgError);

    expect(transformed).toBeInstanceOf(DatabaseConstraintError);
    expect(transformed.code).toBe(ERROR_CODES.DB_UNIQUE_VIOLATION);
  });

  it("transforms PostgreSQL foreign key violation", () => {
    const pgError = { code: "23503" };
    const transformed = transformError(pgError);

    expect(transformed).toBeInstanceOf(DatabaseConstraintError);
    expect(transformed.code).toBe(ERROR_CODES.DB_FOREIGN_KEY_VIOLATION);
  });

  it("transforms generic Error to AppError", () => {
    const error = new Error("Something went wrong");
    const transformed = transformError(error);

    expect(transformed).toBeInstanceOf(AppError);
    expect(transformed.code).toBe(ERROR_CODES.SYS_INTERNAL_ERROR);
    expect(transformed.context?.originalMessage).toBe("Something went wrong");
  });

  it("transforms unknown value to AppError", () => {
    const transformed = transformError("string error");

    expect(transformed).toBeInstanceOf(AppError);
    expect(transformed.code).toBe(ERROR_CODES.SYS_INTERNAL_ERROR);
    expect(transformed.context?.rawError).toBe("string error");
  });

  it("uses custom default code", () => {
    const error = new Error("Custom error");
    const transformed = transformError(error, ERROR_CODES.PAY_NOT_FOUND);

    expect(transformed.code).toBe(ERROR_CODES.PAY_NOT_FOUND);
  });
});

describe("errorToFormState", () => {
  it("converts AppError with field errors", () => {
    const error = new AppError(ERROR_CODES.VAL_SCHEMA_MISMATCH, "Validation failed", {
      fieldErrors: { email: ["Invalid email"] },
    });

    const formState = errorToFormState(error);

    expect(formState.success).toBe(false);
    expect(formState.message).toBe("Validation failed");
    expect(formState.errors?.email).toContain("Invalid email");
  });

  it("puts message in _form when no field errors", () => {
    const error = new AppError(ERROR_CODES.SYS_INTERNAL_ERROR, "System error");

    const formState = errorToFormState(error);

    expect(formState.success).toBe(false);
    expect(formState.errors?._form).toContain("System error");
  });
});

describe("toFormState", () => {
  it("transforms and converts error in one step", () => {
    const pgError = {
      code: "23505",
      constraint: "users_username_unique",
    };

    const formState = toFormState(pgError);

    expect(formState.success).toBe(false);
    expect(formState.errors?.username).toContain("Username already exists.");
  });
});

describe("formStateFromZodResult", () => {
  it("returns null for successful parse", () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: "John" });

    expect(formStateFromZodResult(result)).toBeNull();
  });

  it("returns FormState for failed parse", () => {
    const schema = z.object({
      email: z.string().email("Invalid email format"),
    });
    const result = schema.safeParse({ email: "not-email" });

    const formState = formStateFromZodResult(result);

    expect(formState).not.toBeNull();
    expect(formState?.success).toBe(false);
    expect(formState?.errors?.email).toContain("Invalid email format");
  });
});

describe("permissionDeniedFormState", () => {
  it("creates permission denied form state", () => {
    const formState = permissionDeniedFormState("students:create");

    expect(formState.success).toBe(false);
    expect(formState.message).toBe("Permission denied: students:create");
    expect(formState.errors?._form).toBeDefined();
  });
});

describe("notFoundFormState", () => {
  it("creates not found form state", () => {
    const formState = notFoundFormState("Student");

    expect(formState.success).toBe(false);
    expect(formState.message).toBe("Student not found");
    expect(formState.errors?._form).toContain("Student not found.");
  });
});
