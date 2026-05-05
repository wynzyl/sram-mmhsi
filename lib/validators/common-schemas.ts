import { z } from "zod";

/**
 * Reusable Zod schemas for common field types.
 * Use these instead of redefining validation rules in every validator.
 */

/**
 * Email field validator (optional, allows empty string).
 * Trims whitespace and validates email format.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   email: emailSchema,
 * });
 * ```
 */
export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address.")
  .optional()
  .or(z.literal(""));

/**
 * Required email field validator.
 * Trims whitespace and validates email format.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   email: emailRequiredSchema,
 * });
 * ```
 */
export const emailRequiredSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .email("Invalid email address.");

/**
 * Philippine mobile number validator (optional).
 * Accepts formats: 09171234567 or +639171234567
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   mobileNumber: phoneSchema,
 * });
 * ```
 */
export const phoneSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || /^(09|\+639)\d{9}$/.test(val), {
    message: "Mobile number must be a valid Philippine number (e.g., 09171234567).",
  });

/**
 * Required Philippine mobile number validator.
 * Accepts formats: 09171234567 or +639171234567
 */
export const phoneRequiredSchema = z
  .string()
  .trim()
  .min(1, "Contact number is required.")
  .refine((val) => /^(09|\+639)\d{9}$/.test(val), {
    message: "Mobile number must be a valid Philippine number (e.g., 09171234567).",
  });

/**
 * UUID field validator.
 * Validates UUID v4 format.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   studentId: uuidSchema,
 * });
 * ```
 */
export const uuidSchema = z.string().uuid("Invalid ID format.");

/**
 * Required name field validator.
 * Trims whitespace, requires minimum 1 character.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   firstName: nameSchema,
 *   lastName: nameSchema,
 * });
 * ```
 */
export const nameSchema = z.string().min(1, "Name is required.").trim();

/**
 * Optional text field validator.
 * Trims whitespace.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   middleName: optionalTextSchema,
 * });
 * ```
 */
export const optionalTextSchema = z.string().trim().optional();

/**
 * Positive numeric amount validator (for currency, fees, etc.).
 * Coerces string to number, validates positive value.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   amount: amountSchema,
 * });
 * ```
 */
export const amountSchema = z.coerce
  .number({ message: "Amount must be a number." })
  .positive("Amount must be greater than zero.");

/**
 * Optional positive numeric amount validator.
 * Allows undefined, but if provided must be positive.
 */
export const amountOptionalSchema = z.coerce
  .number({ message: "Amount must be a number." })
  .positive("Amount must be greater than zero.")
  .optional();

/**
 * Non-negative integer validator (for counts, quantities, etc.).
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   quantity: integerSchema,
 * });
 * ```
 */
export const integerSchema = z.coerce
  .number({ message: "Must be a number." })
  .int("Must be a whole number.")
  .nonnegative("Must be zero or greater.");

/**
 * Date string validator (converts to Date object).
 * Validates date format and ensures valid date.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   startDate: dateSchema,
 * });
 * ```
 */
export const dateSchema = z
  .string()
  .trim()
  .min(1, "Date is required.")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date." });

/**
 * Learner Reference Number (LRN) validator.
 * Validates 12-digit Philippine LRN format.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   lrn: lrnSchema,
 * });
 * ```
 */
export const lrnSchema = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || /^[0-9]{12}$/.test(val), {
    message: "LRN must be exactly 12 digits if provided.",
  });

/**
 * Blood type validator.
 * Validates against standard blood types: A+, A-, B+, B-, AB+, AB-, O+, O-
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   bloodType: bloodTypeSchema,
 * });
 * ```
 */
export const bloodTypeSchema = z
  .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], {
    message: "Invalid blood type.",
  })
  .optional();

/**
 * Gender enum validator.
 *
 * @example
 * ```typescript
 * const schema = z.object({
 *   gender: genderSchema,
 * });
 * ```
 */
export const genderSchema = z.enum(["male", "female", "other", "prefer_not_to_say"], {
  message: "Gender is required.",
});

/**
 * Optional gender validator with preprocessing for empty values.
 * Converts empty string, null, undefined to undefined.
 */
export const genderOptionalSchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  genderSchema
);

// ─── Base FormState Type ──────────────────────────────────────────────────────

/**
 * Base FormState type for all server action return types.
 * Standardizes error handling and success messaging across forms.
 *
 * Use this as the base and extend with additional fields as needed.
 *
 * @template TInput - The input type for the form (usually the Zod schema infer type)
 *
 * @example
 * ```typescript
 * // Simple FormState (no extra fields)
 * export type CreateStudentFormState = BaseFormState<CreateStudentInput>;
 *
 * // Extended FormState (with additional fields)
 * export type CreateStudentFormState = BaseFormState<CreateStudentInput> & {
 *   studentId?: string;
 *   fieldValues?: CreateStudentFormFieldSnapshot;
 * };
 * ```
 */
export type BaseFormState<TInput = Record<string, unknown>> = {
  /** Field-level and form-level errors. Use "_form" key for form-level errors. */
  errors?: Partial<Record<keyof TInput | "_form", string[]>>;
  /** Success or error message to display to user */
  message?: string;
  /** True if operation succeeded, false/undefined otherwise */
  success?: boolean;
};

/**
 * Helper type for form state with additional custom fields.
 * Merges BaseFormState with custom fields while preserving type safety.
 *
 * @template TInput - The input type for the form
 * @template TExtra - Additional fields beyond base FormState
 *
 * @example
 * ```typescript
 * export type CreateStudentFormState = FormStateWithExtras<
 *   CreateStudentInput,
 *   { studentId?: string; fieldValues?: CreateStudentFormFieldSnapshot }
 * >;
 * ```
 */
export type FormStateWithExtras<TInput, TExtra extends Record<string, unknown>> = BaseFormState<TInput> & TExtra;
