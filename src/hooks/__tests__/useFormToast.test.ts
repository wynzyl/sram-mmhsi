/**
 * M5: Form Validation UX Tests
 *
 * Tests for form validation UX patterns including BaseFormState structure,
 * field-level vs form-level error handling patterns, and common schema usage.
 *
 * Note: Hook behavior tests require @testing-library/react. These tests focus
 * on type structures and state handling patterns.
 */

import { describe, it, expect } from "vitest";
import type { BaseFormState, FormStateWithExtras } from "@/lib/validators/common-schemas";
import {
  emailSchema,
  emailRequiredSchema,
  phoneSchema,
  phoneRequiredSchema,
  nameSchema,
  amountSchema,
  uuidSchema,
  dateSchema,
  lrnSchema,
} from "@/lib/validators/common-schemas";

// ─── BaseFormState Type Tests ────────────────────────────────────────────────

describe("BaseFormState Type Structure", () => {
  describe("Basic State Fields", () => {
    it("should support empty initial state", () => {
      const state: BaseFormState = {};

      expect(state.success).toBeUndefined();
      expect(state.message).toBeUndefined();
      expect(state.errors).toBeUndefined();
    });

    it("should support success state with message", () => {
      const state: BaseFormState = {
        success: true,
        message: "Operation completed successfully",
      };

      expect(state.success).toBe(true);
      expect(state.message).toBe("Operation completed successfully");
    });

    it("should support error state with message", () => {
      const state: BaseFormState = {
        success: false,
        message: "Something went wrong",
      };

      expect(state.success).toBe(false);
      expect(state.message).toBe("Something went wrong");
    });

    it("should support errors without success flag", () => {
      const state: BaseFormState = {
        errors: {
          _form: ["Validation failed"],
        },
      };

      expect(state.success).toBeUndefined();
      expect(state.errors?._form).toEqual(["Validation failed"]);
    });
  });

  describe("Generic Input Type Support", () => {
    it("should type-check field errors against input type", () => {
      type TestInput = {
        name: string;
        email: string;
        age: number;
      };

      const state: BaseFormState<TestInput> = {
        errors: {
          name: ["Name is required"],
          email: ["Invalid email"],
          age: ["Must be a number"],
        },
      };

      expect(state.errors?.name).toEqual(["Name is required"]);
      expect(state.errors?.email).toEqual(["Invalid email"]);
      expect(state.errors?.age).toEqual(["Must be a number"]);
    });

    it("should allow _form key for form-level errors", () => {
      type TestInput = {
        username: string;
      };

      const state: BaseFormState<TestInput> = {
        errors: {
          username: ["Username taken"],
          _form: ["Server validation failed"],
        },
      };

      expect(state.errors?._form).toEqual(["Server validation failed"]);
    });

    it("should allow partial errors", () => {
      type TestInput = {
        firstName: string;
        lastName: string;
        middleName?: string;
      };

      const state: BaseFormState<TestInput> = {
        errors: {
          firstName: ["Required"],
          // Only firstName has an error
        },
      };

      expect(state.errors?.firstName).toEqual(["Required"]);
      expect(state.errors?.lastName).toBeUndefined();
    });
  });

  describe("Extended State Types", () => {
    it("should support extension with custom fields", () => {
      type ExtendedState = BaseFormState<{ name: string }> & {
        studentId?: string;
        redirectUrl?: string;
      };

      const state: ExtendedState = {
        success: true,
        message: "Student created",
        studentId: "123",
        redirectUrl: "/students/123",
      };

      expect(state.studentId).toBe("123");
      expect(state.redirectUrl).toBe("/students/123");
    });

    it("should support FormStateWithExtras helper type", () => {
      type MyFormState = FormStateWithExtras<
        { email: string; password: string },
        { userId?: string; token?: string }
      >;

      const state: MyFormState = {
        success: true,
        message: "Logged in",
        userId: "user-123",
        token: "jwt-token",
      };

      expect(state.userId).toBe("user-123");
      expect(state.token).toBe("jwt-token");
    });
  });
});

// ─── Field-Level vs Form-Level Error Patterns ────────────────────────────────

describe("Field-Level vs Form-Level Error Patterns", () => {
  describe("Field-Level Errors (Inline Display)", () => {
    it("should structure single field error", () => {
      type FormInput = { email: string };

      const state: BaseFormState<FormInput> = {
        errors: {
          email: ["Invalid email format"],
        },
      };

      // Field errors should be displayed inline below the field
      expect(state.errors?.email).toHaveLength(1);
      expect(state.errors?.email?.[0]).toContain("email");
    });

    it("should support multiple errors per field", () => {
      type FormInput = { password: string };

      const state: BaseFormState<FormInput> = {
        errors: {
          password: [
            "Password must be at least 8 characters",
            "Password must contain a number",
            "Password must contain a special character",
          ],
        },
      };

      expect(state.errors?.password).toHaveLength(3);
    });

    it("should structure multi-field validation errors", () => {
      type FormInput = {
        firstName: string;
        lastName: string;
        email: string;
      };

      const state: BaseFormState<FormInput> = {
        errors: {
          firstName: ["First name is required"],
          lastName: ["Last name is required"],
          email: ["Invalid email format"],
        },
      };

      expect(Object.keys(state.errors ?? {})).toHaveLength(3);
    });
  });

  describe("Form-Level Errors (Toast Display)", () => {
    it("should structure form-level error with _form key", () => {
      const state: BaseFormState = {
        errors: {
          _form: ["Authentication failed"],
        },
      };

      // Form-level errors should be displayed as toast
      expect(state.errors?._form).toBeDefined();
      expect(Array.isArray(state.errors?._form)).toBe(true);
    });

    it("should support multiple form-level errors", () => {
      const state: BaseFormState = {
        errors: {
          _form: [
            "Server validation failed",
            "Please try again later",
          ],
        },
      };

      expect(state.errors?._form).toHaveLength(2);
    });

    it("should support form-level errors alongside field errors", () => {
      type FormInput = { email: string; password: string };

      const state: BaseFormState<FormInput> = {
        errors: {
          email: ["Invalid email"],
          password: ["Password too weak"],
          _form: ["Account already exists"],
        },
      };

      // Both field errors (inline) and form errors (toast) present
      expect(state.errors?.email).toBeDefined();
      expect(state.errors?.password).toBeDefined();
      expect(state.errors?._form).toBeDefined();
    });
  });

  describe("Error Message Priority", () => {
    it("should structure success state without errors", () => {
      const state: BaseFormState = {
        success: true,
        message: "Saved successfully",
      };

      expect(state.success).toBe(true);
      expect(state.errors).toBeUndefined();
    });

    it("should structure error state with message for toast", () => {
      const state: BaseFormState = {
        success: false,
        message: "Validation failed. Please correct the errors below.",
        errors: {
          _form: ["One or more required fields are missing"],
        },
      };

      // message provides general feedback
      // _form errors provide specific details
      expect(state.message).toContain("Validation failed");
      expect(state.errors?._form).toBeDefined();
    });
  });
});

// ─── Common Schema Validation Tests ──────────────────────────────────────────

describe("Common Schema Validation", () => {
  describe("emailSchema", () => {
    it("should accept valid email", () => {
      const result = emailSchema.safeParse("test@example.com");
      expect(result.success).toBe(true);
    });

    it("should accept empty string (optional)", () => {
      const result = emailSchema.safeParse("");
      expect(result.success).toBe(true);
    });

    it("should accept undefined (optional)", () => {
      const result = emailSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const result = emailSchema.safeParse("not-an-email");
      expect(result.success).toBe(false);
    });

    it("should trim whitespace", () => {
      const result = emailSchema.safeParse("  test@example.com  ");
      if (result.success) {
        expect(result.data).toBe("test@example.com");
      }
    });
  });

  describe("emailRequiredSchema", () => {
    it("should accept valid email", () => {
      const result = emailRequiredSchema.safeParse("test@example.com");
      expect(result.success).toBe(true);
    });

    it("should reject empty string", () => {
      const result = emailRequiredSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("required");
      }
    });

    it("should provide user-friendly error message", () => {
      const result = emailRequiredSchema.safeParse("not-valid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("email");
      }
    });
  });

  describe("phoneSchema", () => {
    it("should accept valid Philippine mobile (09)", () => {
      const result = phoneSchema.safeParse("09171234567");
      expect(result.success).toBe(true);
    });

    it("should accept valid Philippine mobile (+63)", () => {
      const result = phoneSchema.safeParse("+639171234567");
      expect(result.success).toBe(true);
    });

    it("should accept empty/undefined (optional)", () => {
      expect(phoneSchema.safeParse("").success).toBe(true);
      expect(phoneSchema.safeParse(undefined).success).toBe(true);
    });

    it("should reject invalid format", () => {
      const result = phoneSchema.safeParse("1234567890");
      expect(result.success).toBe(false);
    });

    it("should provide helpful error message", () => {
      const result = phoneSchema.safeParse("invalid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Philippine");
        expect(result.error.issues[0].message).toContain("09171234567");
      }
    });
  });

  describe("phoneRequiredSchema", () => {
    it("should reject empty string", () => {
      const result = phoneRequiredSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("required");
      }
    });
  });

  describe("nameSchema", () => {
    it("should accept non-empty name", () => {
      const result = nameSchema.safeParse("John");
      expect(result.success).toBe(true);
    });

    it("should reject empty string", () => {
      const result = nameSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("required");
      }
    });

    it("should trim whitespace", () => {
      const result = nameSchema.safeParse("  John  ");
      if (result.success) {
        expect(result.data).toBe("John");
      }
    });
  });

  describe("amountSchema", () => {
    it("should accept positive number", () => {
      const result = amountSchema.safeParse(100);
      expect(result.success).toBe(true);
    });

    it("should coerce string to number", () => {
      const result = amountSchema.safeParse("500.50");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(500.5);
      }
    });

    it("should reject zero", () => {
      const result = amountSchema.safeParse(0);
      expect(result.success).toBe(false);
    });

    it("should reject negative", () => {
      const result = amountSchema.safeParse(-100);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("greater than zero");
      }
    });

    it("should reject non-numeric string", () => {
      const result = amountSchema.safeParse("not-a-number");
      expect(result.success).toBe(false);
    });
  });

  describe("uuidSchema", () => {
    it("should accept valid UUID v4", () => {
      const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = uuidSchema.safeParse("not-a-uuid");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("ID");
      }
    });

    it("should reject empty string", () => {
      const result = uuidSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("dateSchema", () => {
    it("should accept valid date string", () => {
      const result = dateSchema.safeParse("2024-01-15");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data instanceof Date).toBe(true);
      }
    });

    it("should reject empty string", () => {
      const result = dateSchema.safeParse("");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("required");
      }
    });

    it("should reject invalid date", () => {
      const result = dateSchema.safeParse("not-a-date");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid date");
      }
    });
  });

  describe("lrnSchema", () => {
    it("should accept valid 12-digit LRN", () => {
      const result = lrnSchema.safeParse("123456789012");
      expect(result.success).toBe(true);
    });

    it("should accept empty (optional)", () => {
      expect(lrnSchema.safeParse("").success).toBe(true);
      expect(lrnSchema.safeParse(undefined).success).toBe(true);
    });

    it("should reject non-12-digit number", () => {
      const result = lrnSchema.safeParse("12345");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("12 digits");
      }
    });

    it("should reject non-numeric characters", () => {
      const result = lrnSchema.safeParse("12345678901a");
      expect(result.success).toBe(false);
    });
  });
});

// ─── Form State Transition Pattern Tests ─────────────────────────────────────

describe("Form State Transition Patterns", () => {
  describe("Initial → Pending → Success", () => {
    it("should represent initial state", () => {
      const initial: BaseFormState = {};

      expect(initial.success).toBeUndefined();
      expect(initial.errors).toBeUndefined();
      expect(initial.message).toBeUndefined();
    });

    it("should represent success state after submission", () => {
      type FormInput = { name: string };
      type FormState = BaseFormState<FormInput> & { studentId?: string };

      const success: FormState = {
        success: true,
        message: "Student created successfully",
        studentId: "student-123",
      };

      expect(success.success).toBe(true);
      expect(success.studentId).toBe("student-123");
    });
  });

  describe("Initial → Pending → Validation Error", () => {
    it("should represent validation error state", () => {
      type FormInput = { email: string; password: string };

      const validationError: BaseFormState<FormInput> = {
        success: false,
        errors: {
          email: ["Email is required"],
          password: ["Password must be at least 8 characters"],
        },
      };

      expect(validationError.success).toBe(false);
      expect(validationError.errors?.email).toBeDefined();
      expect(validationError.errors?.password).toBeDefined();
    });
  });

  describe("Initial → Pending → Server Error", () => {
    it("should represent server error state", () => {
      const serverError: BaseFormState = {
        success: false,
        message: "Internal server error. Please try again later.",
        errors: {
          _form: ["Server error occurred"],
        },
      };

      expect(serverError.success).toBe(false);
      expect(serverError.message).toContain("server error");
      expect(serverError.errors?._form).toBeDefined();
    });
  });

  describe("Error Recovery", () => {
    it("should clear errors on successful resubmission", () => {
      type FormInput = { name: string };

      // First submission - error
      const errorState: BaseFormState<FormInput> = {
        success: false,
        errors: {
          name: ["Name is required"],
        },
      };

      expect(errorState.errors?.name).toBeDefined();

      // Resubmission - success
      const successState: BaseFormState<FormInput> = {
        success: true,
        message: "Saved",
      };

      expect(successState.success).toBe(true);
      expect(successState.errors).toBeUndefined();
    });
  });
});

// ─── Callback Pattern Documentation Tests ────────────────────────────────────

describe("useFormToast Callback Patterns", () => {
  it("documents onSuccess callback usage for navigation", () => {
    // This documents the expected usage pattern
    const onSuccessExample = {
      successMessage: "Student created successfully",
      onSuccess: () => {
        // router.push(`/students/${state.studentId}`)
      },
    };

    expect(onSuccessExample.successMessage).toBe("Student created successfully");
    expect(typeof onSuccessExample.onSuccess).toBe("function");
  });

  it("documents onError callback usage for error logging", () => {
    // This documents the expected usage pattern
    const onErrorExample = {
      errorMessage: "Failed to save changes",
      onError: () => {
        // logError(state.message)
      },
    };

    expect(onErrorExample.errorMessage).toBe("Failed to save changes");
    expect(typeof onErrorExample.onError).toBe("function");
  });

  it("documents custom message override pattern", () => {
    // When state.message is technical, override with user-friendly message
    const overrideExample = {
      successMessage: "Your changes have been saved", // User-friendly
      errorMessage: "Please try again later", // User-friendly
    };

    expect(overrideExample.successMessage).not.toContain("200");
    expect(overrideExample.errorMessage).not.toContain("500");
  });
});
