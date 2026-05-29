import type { z } from "zod";

/**
 * Result type for parseFormData - discriminated union for type safety.
 *
 * @template T - The inferred type from the Zod schema
 */
export type ParseFormDataResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errors: Partial<Record<string, string[]>>;
      formError?: string;
    };

/**
 * Configuration for field extraction from FormData.
 */
export interface ParseFormDataOptions {
  /** Fields that should be converted from "true"/"false" strings to boolean */
  booleanFields?: string[];
  /** Fields that should use getAll() for array values */
  arrayFields?: string[];
  /** Fields that contain JSON strings and need parsing */
  jsonFields?: string[];
}

/**
 * Parse and validate FormData against a Zod schema.
 *
 * Extracts fields from FormData, applies transformations (boolean coercion,
 * array extraction, JSON parsing), validates with the provided schema, and
 * returns a discriminated union result for type-safe handling.
 *
 * @param schema - Zod schema to validate against
 * @param formData - FormData object from form submission
 * @param options - Optional configuration for field transformations
 * @returns Discriminated union: `{ success: true, data }` or `{ success: false, errors, formError? }`
 *
 * @example Standard usage
 * ```typescript
 * const result = parseFormData(CreateUserSchema, formData);
 * if (!result.success) {
 *   return { errors: result.errors };
 * }
 * const { firstName, email } = result.data;
 * ```
 *
 * @example With boolean fields
 * ```typescript
 * const result = parseFormData(
 *   CreateFeeItemTypeSchema,
 *   formData,
 *   { booleanFields: ["isDiscount", "isRefundable"] }
 * );
 * ```
 *
 * @example With array fields
 * ```typescript
 * const result = parseFormData(
 *   BulkApproveSchema,
 *   formData,
 *   { arrayFields: ["discountRequestIds"] }
 * );
 * ```
 *
 * @example With JSON fields
 * ```typescript
 * const result = parseFormData(
 *   AssessmentSchema,
 *   formData,
 *   { jsonFields: ["items"] }
 * );
 * ```
 */
export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
  options: ParseFormDataOptions = {}
): ParseFormDataResult<z.infer<T>> {
  const { booleanFields = [], arrayFields = [], jsonFields = [] } = options;

  // Build object from FormData
  const data: Record<string, unknown> = {};

  // Get all unique keys from FormData
  const keys = new Set<string>();
  formData.forEach((_, key) => keys.add(key));

  for (const key of keys) {
    if (arrayFields.includes(key)) {
      // Use getAll for array fields
      data[key] = formData.getAll(key);
    } else if (booleanFields.includes(key)) {
      // Convert "true"/"false" strings to boolean
      data[key] = formData.get(key) === "true";
    } else if (jsonFields.includes(key)) {
      // Parse JSON fields
      const raw = formData.get(key);
      if (raw && typeof raw === "string") {
        try {
          data[key] = JSON.parse(raw);
        } catch {
          // Let Zod handle the validation error for invalid JSON
          data[key] = raw;
        }
      } else {
        data[key] = null;
      }
    } else {
      // Standard string extraction
      const value = formData.get(key);
      // Convert empty strings to undefined for optional fields
      // (Zod's optional() will then properly handle them)
      data[key] = value === "" ? undefined : value;
    }
  }

  // Validate with Zod
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      success: false,
      errors: flat.fieldErrors as Partial<Record<string, string[]>>,
      formError: flat.formErrors[0],
    };
  }

  return { success: true, data: parsed.data };
}
