# SRAMS Form Validation Refactoring Report

**System:** School Registration and Accounts Monitoring System (SRAMS)
**Report Date:** 2026-05-29
**Report Type:** Code Refactoring Documentation
**Version:** 1.0

---

## Executive Summary

This refactoring extracted a reusable `parseFormData` utility to eliminate 60+ instances of duplicated form validation boilerplate across 18 action files. The utility provides type-safe FormData parsing with support for boolean fields, array fields, and JSON parsing.

**Key Metrics:**
- **Patterns Migrated:** ~62 occurrences
- **Files Modified:** 18 server action files
- **Net Lines Removed:** ~250+ lines
- **Build Status:** Passing
- **Tests:** 38/38 passing

---

## 1. Problem Statement

### 1.1 The Duplicated Pattern

Every server action that accepts FormData had this boilerplate:

```typescript
const parsed = SomeSchema.safeParse({
  field1: formData.get("field1"),
  field2: formData.get("field2"),
  booleanField: formData.get("booleanField") === "true",
  // ... more fields
});

if (!parsed.success) {
  return {
    errors: parsed.error.flatten().fieldErrors as SomeFormState["errors"],
  };
}

const { field1, field2, booleanField } = parsed.data;
```

### 1.2 Variations Found

| Pattern | Frequency | Description |
|---------|-----------|-------------|
| Standard with type cast | 75% | Returns `{ errors: ... as FormState["errors"] }` |
| Boolean coercion (`=== "true"`) | 8% | Hidden inputs with "true"/"false" |
| Boolean coercion (`=== "on"`) | 5% | HTML checkbox default value |
| Array extraction (`getAll`) | 3% | Multiple values with same name |
| JSON pre-parsing | 5% | Complex nested objects |
| Form-level errors | 4% | Also returns `formErrors[0]` |

### 1.3 Issues with Duplication

1. **Inconsistent error handling** - Some used type casts, others didn't
2. **Boilerplate accumulation** - 6-15 lines per action, 60+ actions
3. **Boolean handling fragmented** - `=== "true"` vs `=== "on"` vs both
4. **Maintenance burden** - Changes required touching many files

---

## 2. Solution: `parseFormData` Utility

### 2.1 New File

**Location:** `src/lib/utils/form-validation.ts`

```typescript
import type { z } from "zod";

export type ParseFormDataResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      errors: Partial<Record<string, string[]>>;
      formError?: string;
    };

export interface ParseFormDataOptions {
  booleanFields?: string[];
  arrayFields?: string[];
  jsonFields?: string[];
}

export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
  options: ParseFormDataOptions = {}
): ParseFormDataResult<z.infer<T>>;
```

### 2.2 Features

| Feature | Description |
|---------|-------------|
| **Auto field extraction** | Iterates FormData keys, extracts all values |
| **Boolean coercion** | Converts `"true"` and `"on"` to `true`, else `false` |
| **Array fields** | Uses `getAll()` for multi-value fields |
| **JSON parsing** | Parses JSON strings with graceful fallback |
| **Empty string handling** | Converts `""` to `undefined` for optional fields |
| **Type-safe result** | Discriminated union for compile-time safety |

### 2.3 Usage Examples

**Standard Pattern:**
```typescript
const result = parseFormData(CreateUserSchema, formData);
if (!result.success) {
  return { errors: result.errors };
}
const { firstName, email } = result.data;
```

**With Boolean Fields:**
```typescript
const result = parseFormData(FeeItemTypeSchema, formData, {
  booleanFields: ["isDiscount", "isRefundable", "isActive"],
});
```

**With Array Fields:**
```typescript
const result = parseFormData(BulkApproveSchema, formData, {
  arrayFields: ["discountRequestIds"],
});
```

---

## 3. Migration Summary

### 3.1 Phase 1: Pilot (Commit 1)

| File | Patterns | Notes |
|------|----------|-------|
| `auth.actions.ts` | 2 | Login, change password |
| `system-settings.actions.ts` | 1 | Refund cutoff setting |

### 3.2 Phase 2: Broader Migration (Commit 2)

| File | Patterns | Notes |
|------|----------|-------|
| `clearances.actions.ts` | 3 | Standard patterns |
| `school-years.actions.ts` | 4 | With booleanFields |
| `enrollment-confirmation.actions.ts` | 2 | Standard patterns |
| `invoices.actions.ts` | 1 | sendInvoiceAction only |
| `fee-schedules.actions.ts` | 3 | With booleanFields |
| `users.actions.ts` | 4 | With booleanFields |
| `fee-item-types.actions.ts` | 3 | With booleanFields |
| `void-requests.actions.ts` | 4 | Standard patterns |
| `payments.actions.ts` | 3 | Standard patterns |
| `subjects.actions.ts` | 5 | Standard patterns |
| `enrollment-cancellation.actions.ts` | 5 | New feature file |

### 3.3 Phase 3: Remaining Files (Commit 3)

| File | Patterns | Notes |
|------|----------|-------|
| `discounts.actions.ts` | 9 | booleanFields, arrayFields |
| `fee-templates.actions.ts` | 7 | Standard patterns |
| `booklets.actions.ts` | 3 | With booleanFields for checkboxes |
| `enrollments.actions.ts` | 1 | Skipped 2 with custom helper |
| `assessments.actions.ts` | 1 | Skipped 1 with JSON pre-processing |
| `grades.actions.ts` | 1 | Skipped 1 with JSON pre-processing |

---

## 4. Patterns Intentionally Skipped

Six patterns were not migrated due to complex pre-processing requirements:

### 4.1 Custom Field Transformation

**Files:** `enrollments.actions.ts` (2 patterns)

```typescript
// Uses parseIntakeDocumentStatus helper for each field
intakeForm138: parseIntakeDocumentStatus(formData.get("intakeForm138")),
intakeBirthCertificatePsa: parseIntakeDocumentStatus(formData.get("intakeBirthCertificatePsa")),
```

The custom `parseIntakeDocumentStatus` function converts form values to specific intake document status types.

### 4.2 JSON with Error Recovery

**Files:** `students.actions.ts` (2 patterns), `assessments.actions.ts` (1), `grades.actions.ts` (1)

```typescript
// Pre-parses JSON with custom error handling
const guardiansRaw = formData.get("guardians");
let guardiansParsed: unknown[] = [];
try {
  guardiansParsed = JSON.parse(guardiansRaw as string);
} catch {
  return {
    errors: { guardians: ["Guardian data is malformed."] },
    fieldValues: buildCreateStudentFormSnapshot(formData, []),  // Restores form state
  };
}
```

These patterns need:
- Custom error messages before Zod validation
- Form field value restoration on error
- Dual error handling (JSON parse + Zod validation)

---

## 5. Technical Implementation

### 5.1 Boolean Field Enhancement

Updated to handle both hidden inputs (`"true"`) and checkboxes (`"on"`):

```typescript
} else if (booleanFields.includes(key)) {
  // Convert "true"/"on" strings to boolean
  const val = formData.get(key);
  data[key] = val === "true" || val === "on";
}
```

### 5.2 Empty String Handling

```typescript
// Convert empty strings to undefined for optional fields
data[key] = value === "" ? undefined : value;
```

This allows Zod's `optional()` to properly handle empty form submissions.

### 5.3 JSON Field Fallback

```typescript
} else if (jsonFields.includes(key)) {
  const raw = formData.get(key);
  if (raw && typeof raw === "string") {
    try {
      data[key] = JSON.parse(raw);
    } catch {
      // Let Zod handle the validation error
      data[key] = raw;
    }
  } else {
    data[key] = null;
  }
}
```

On JSON parse failure, the raw string is passed to Zod for proper validation error generation.

---

## 6. Before/After Comparison

### 6.1 Before (15 lines)

```typescript
const parsed = CreateFeeItemTypeSchema.safeParse({
  code: formData.get("code"),
  name: formData.get("name"),
  description: formData.get("description") || undefined,
  isDiscount: formData.get("isDiscount") === "true",
  isRefundable: formData.get("isRefundable") === "true",
  displayOrder: formData.get("displayOrder"),
});

if (!parsed.success) {
  return {
    errors: parsed.error.flatten().fieldErrors as CreateFeeItemTypeFormState["errors"],
  };
}

const { code, name, description, isDiscount, isRefundable, displayOrder } = parsed.data;
```

### 6.2 After (7 lines)

```typescript
const result = parseFormData(CreateFeeItemTypeSchema, formData, {
  booleanFields: ["isDiscount", "isRefundable"],
});
if (!result.success) {
  return { errors: result.errors };
}

const parsed = result;
// Use parsed.data.code, parsed.data.name, etc.
```

**Reduction:** 8 lines per occurrence, cleaner separation of concerns.

---

## 7. Verification Results

### 7.1 Build Status

```
Compiled successfully
TypeScript type checking: No errors
Linting: No errors
```

### 7.2 Test Status

```
Test Files: 3 passed (3)
Tests: 38 passed (38)
Duration: 242ms
```

### 7.3 Type Safety Verification

The discriminated union return type ensures:

```typescript
const result = parseFormData(SomeSchema, formData);

// TypeScript knows result.data doesn't exist here
if (!result.success) {
  return { errors: result.errors };
}

// TypeScript knows result.data exists and is typed as z.infer<SomeSchema>
const { field1, field2 } = result.data;
```

---

## 8. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Server Actions                           │
│  (*.actions.ts files)                                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ parseFormData(schema, formData, options)
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 form-validation.ts                           │
│                                                             │
│  1. Extract all FormData keys                               │
│  2. Apply transformations:                                  │
│     - booleanFields: "true"/"on" → true                    │
│     - arrayFields: getAll()                                │
│     - jsonFields: JSON.parse()                             │
│     - others: get() with empty → undefined                 │
│  3. Call schema.safeParse(data)                            │
│  4. Return discriminated union result                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │   Zod Schema  │
                  │   Validation  │
                  └───────────────┘
```

---

## 9. Migration Guide

### 9.1 For New Actions

```typescript
import { parseFormData } from "@/lib/utils/form-validation";

export async function myAction(
  _prevState: MyFormState,
  formData: FormData
): Promise<MyFormState> {
  const session = await requireSession();
  // ... permission checks

  const result = parseFormData(MySchema, formData, {
    booleanFields: ["isActive"],  // if needed
    arrayFields: ["selectedIds"],  // if needed
  });

  if (!result.success) {
    return { errors: result.errors };
  }

  const { field1, field2 } = result.data;
  // ... business logic
}
```

### 9.2 For Existing Actions (Migration)

1. Add import: `import { parseFormData } from "@/lib/utils/form-validation";`
2. Replace `schema.safeParse({ ... })` with `parseFormData(schema, formData, options)`
3. Replace `parsed.error.flatten().fieldErrors` with `result.errors`
4. Optionally keep `const parsed = result;` for minimal diff

---

## 10. Future Considerations

### 10.1 Potential Enhancements

1. **Custom field transformers**: Allow per-field transformation functions
2. **Nested object support**: Handle dot-notation field names
3. **File upload handling**: Special handling for `File` objects
4. **Form state restoration**: Integrate `fieldValues` return for error recovery

### 10.2 Patterns to Consider Migrating

The 6 skipped patterns could be migrated with:
- A `transformers` option for custom per-field functions
- A `fieldValues` callback for error state restoration

This would add complexity and is not recommended unless the patterns proliferate.

---

## 11. Conclusion

This refactoring successfully:

1. **Eliminated 60+ instances** of duplicated validation boilerplate
2. **Standardized boolean handling** - Both `"true"` and `"on"` supported
3. **Reduced code by ~250 lines** - Absorbed into 133-line utility
4. **Improved type safety** - Discriminated union prevents runtime errors
5. **Preserved API surface** - No changes to server action signatures

The codebase is now more maintainable with a single source of truth for FormData parsing logic.

---

**Report Prepared By:** System Documentation
**Reviewed By:** [Pending Review]
**Classification:** Internal Use Only
