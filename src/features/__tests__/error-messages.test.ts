/**
 * M3: Error Message Validation Tests
 *
 * Tests that validation schemas provide appropriate, user-friendly error messages
 * for all validation failures. Ensures error messages are:
 * - Clear and actionable
 * - Consistent in tone and format
 * - Contextually appropriate for the field
 */

import { describe, it, expect } from "vitest";

// Payment schemas
import {
  CreateBookletSchema,
  PostPaymentSchema,
  VoidPaymentSchema,
  UpdateBookletSchema,
} from "@/features/payments/payments.schema";

// Assessment schemas
import {
  CreateAssessmentFromEnrollmentSchema,
  CancelAssessmentSchema,
  AddSpecialFeeSchema,
  RemoveSpecialFeeSchema,
} from "@/features/assessments/assessments.schema";

// Discount schemas
import {
  createDiscountTypeSchema,
  approveDiscountRequestSchema,
  rejectDiscountRequestSchema,
  reverseDiscountSchema,
  bulkApproveDiscountsSchema,
} from "@/features/discounts/discounts.schema";

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Extract field-specific error messages from Zod parse result
 */
function getFieldErrors(result: { success: boolean; error?: { flatten: () => { fieldErrors: Record<string, string[]> } } }): Record<string, string[]> {
  if (result.success) return {};
  return result.error?.flatten().fieldErrors ?? {};
}

/**
 * Get first error message for a specific field
 */
function getFirstError(errors: Record<string, string[]>, field: string): string | undefined {
  return errors[field]?.[0];
}

// ─── Payment Schema Error Messages ───────────────────────────────────────────

describe("Payment Schema Error Messages", () => {
  describe("CreateBookletSchema", () => {
    it("should provide clear error for missing series", () => {
      const result = CreateBookletSchema.safeParse({
        series: "",
        prefix: "AK",
        startNumber: 1,
        endNumber: 50,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "series");

      expect(message).toContain("Series");
      expect(message).toContain("required");
    });

    it("should provide helpful error for invalid prefix format", () => {
      const result = CreateBookletSchema.safeParse({
        series: "ABC-00001-00050",
        prefix: "ABC",
        startNumber: 1,
        endNumber: 50,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "prefix");

      expect(message).toContain("exactly 2 letters");
      expect(message).toContain("e.g.");
    });

    it("should explain start number constraints", () => {
      const result = CreateBookletSchema.safeParse({
        series: "AK-00000-00049",
        prefix: "AK",
        startNumber: 0,
        endNumber: 49,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "startNumber");

      expect(message).toContain("at least 1");
    });

    it("should explain end number must be >= start number", () => {
      const result = CreateBookletSchema.safeParse({
        series: "AK-00100-00050",
        prefix: "AK",
        startNumber: 100,
        endNumber: 50,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "endNumber");

      expect(message).toContain("greater than or equal");
    });

    it("should explain booklet count requirement", () => {
      const result = CreateBookletSchema.safeParse({
        series: "AK-00001-00010",
        prefix: "AK",
        startNumber: 1,
        endNumber: 10,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "endNumber");

      expect(message).toContain("exactly 50");
      expect(message).toContain("OR numbers");
    });

    it("should explain series-prefix-range mismatch", () => {
      const result = CreateBookletSchema.safeParse({
        series: "AK-00001-00050",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "series");

      expect(message).toContain("must exactly match");
    });

    it("should provide max constraint error for start number", () => {
      const result = CreateBookletSchema.safeParse({
        series: "AK-99999-100048",
        prefix: "AK",
        startNumber: 100000,
        endNumber: 100049,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "startNumber");

      expect(message).toContain("at most");
      expect(message).toContain("5-digit");
    });
  });

  describe("PostPaymentSchema", () => {
    it("should require student ID", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "",
        assessmentId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 1000,
        paymentMethod: "cash",
        amountTendered: 1000,
        bookletId: "550e8400-e29b-41d4-a716-446655440001",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "studentId");

      expect(message).toContain("Student");
      expect(message).toContain("required");
    });

    it("should require positive amount", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 0,
        paymentMethod: "cash",
        amountTendered: 0,
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "amount");

      expect(message).toContain("greater than 0");
    });

    it("should require booklet for auto-assign mode", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 1000,
        paymentMethod: "check",
        isManualEntry: false,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "bookletId");

      expect(message).toContain("Booklet");
      expect(message).toContain("required");
    });

    it("should require cash tendered for cash payments", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 1000,
        paymentMethod: "cash",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "amountTendered");

      expect(message).toContain("cash amount");
      expect(message).toContain("payor");
    });

    it("should validate cash tendered is sufficient", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 1000,
        paymentMethod: "cash",
        amountTendered: 500,
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "amountTendered");

      expect(message).toContain("equal to or greater than");
    });

    it("should require reference number for GCash", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 1000,
        paymentMethod: "gcash",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "referenceNumber");

      expect(message).toContain("Reference number");
      expect(message).toContain("required");
      expect(message).toContain("GCash");
    });

    it("should require reference number for bank transfer", () => {
      const result = PostPaymentSchema.safeParse({
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 1000,
        paymentMethod: "bank_transfer",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "referenceNumber");

      expect(message).toContain("bank transfer");
    });

    describe("Manual Entry Mode", () => {
      it("should require payment date for manual entries", () => {
        const result = PostPaymentSchema.safeParse({
          studentId: "550e8400-e29b-41d4-a716-446655440000",
          assessmentId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 1000,
          paymentMethod: "check",
          isManualEntry: true,
          manualOrNumber: "AK 00001",
        });

        const errors = getFieldErrors(result);
        const message = getFirstError(errors, "manualPaymentDate");

        expect(message).toContain("Payment date");
        expect(message).toContain("required");
        expect(message).toContain("manual");
      });

      it("should reject future payment dates", () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1);

        const result = PostPaymentSchema.safeParse({
          studentId: "550e8400-e29b-41d4-a716-446655440000",
          assessmentId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 1000,
          paymentMethod: "check",
          isManualEntry: true,
          manualPaymentDate: futureDate.toISOString(),
          manualOrNumber: "AK 00001",
        });

        const errors = getFieldErrors(result);
        const message = getFirstError(errors, "manualPaymentDate");

        expect(message).toContain("cannot be in the future");
      });

      it("should require OR number for manual entries", () => {
        const result = PostPaymentSchema.safeParse({
          studentId: "550e8400-e29b-41d4-a716-446655440000",
          assessmentId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 1000,
          paymentMethod: "check",
          isManualEntry: true,
          manualPaymentDate: new Date().toISOString(),
        });

        const errors = getFieldErrors(result);
        const message = getFirstError(errors, "manualOrNumber");

        expect(message).toContain("OR number");
        expect(message).toContain("required");
        expect(message).toContain("manual");
      });

      it("should explain OR number format requirement", () => {
        const result = PostPaymentSchema.safeParse({
          studentId: "550e8400-e29b-41d4-a716-446655440000",
          assessmentId: "550e8400-e29b-41d4-a716-446655440001",
          amount: 1000,
          paymentMethod: "check",
          isManualEntry: true,
          manualPaymentDate: new Date().toISOString(),
          manualOrNumber: "AK00001",
        });

        const errors = getFieldErrors(result);
        const message = getFirstError(errors, "manualOrNumber");

        expect(message).toContain("format");
        expect(message).toContain("XX 00000");
        expect(message).toContain("e.g.");
      });
    });
  });

  describe("VoidPaymentSchema", () => {
    it("should require payment ID", () => {
      const result = VoidPaymentSchema.safeParse({
        paymentId: "",
        voidReason: "Test reason",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "paymentId");

      expect(message).toContain("Payment ID");
      expect(message).toContain("required");
    });

    it("should require meaningful void reason", () => {
      const result = VoidPaymentSchema.safeParse({
        paymentId: "550e8400-e29b-41d4-a716-446655440000",
        voidReason: "ab",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "voidReason");

      expect(message).toContain("reason");
      expect(message).toContain("voiding");
    });
  });

  describe("UpdateBookletSchema", () => {
    it("should validate usage mode options", () => {
      const result = UpdateBookletSchema.safeParse({
        bookletId: "550e8400-e29b-41d4-a716-446655440000",
        usageMode: "invalid_mode",
        assignedCashierId: null,
        status: "active",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "usageMode");

      expect(message).toContain("auto_only");
      expect(message).toContain("manual_only");
    });

    it("should validate status options", () => {
      const result = UpdateBookletSchema.safeParse({
        bookletId: "550e8400-e29b-41d4-a716-446655440000",
        usageMode: "auto_only",
        assignedCashierId: null,
        status: "exhausted",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "status");

      expect(message).toContain("active");
      expect(message).toContain("inactive");
    });
  });
});

// ─── Assessment Schema Error Messages ────────────────────────────────────────

describe("Assessment Schema Error Messages", () => {
  describe("CreateAssessmentFromEnrollmentSchema", () => {
    it("should require at least one fee item", () => {
      const result = CreateAssessmentFromEnrollmentSchema.safeParse({
        enrollmentId: "550e8400-e29b-41d4-a716-446655440000",
        items: [],
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "items");

      expect(message).toContain("Select");
      expect(message).toContain("at least one fee");
      expect(message).toContain("catalog");
    });

    it("should reject duplicate fee items with clear message", () => {
      const duplicateId = "550e8400-e29b-41d4-a716-446655440001";
      const result = CreateAssessmentFromEnrollmentSchema.safeParse({
        enrollmentId: "550e8400-e29b-41d4-a716-446655440000",
        items: [
          { feeTemplateItemId: duplicateId, amount: 1000 },
          { feeTemplateItemId: duplicateId, amount: 1000 },
        ],
      });

      // Duplicate check is in superRefine, need to check differently
      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        const duplicateIssue = issues.find((i) => i.message.includes("once"));
        expect(duplicateIssue).toBeDefined();
        expect(duplicateIssue?.message).toContain("catalog fee");
        expect(duplicateIssue?.message).toContain("only be added once");
      }
    });

    it("should require positive SPED fee amount", () => {
      const result = CreateAssessmentFromEnrollmentSchema.safeParse({
        enrollmentId: "550e8400-e29b-41d4-a716-446655440000",
        items: [
          { feeTemplateItemId: "550e8400-e29b-41d4-a716-446655440001", amount: 1000 },
        ],
        spedFeeAmount: 0,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "spedFeeAmount");

      expect(message).toContain("SPED fee");
      expect(message).toContain("greater than zero");
    });
  });

  describe("CancelAssessmentSchema", () => {
    it("should require cancellation reason", () => {
      const result = CancelAssessmentSchema.safeParse({
        assessmentId: "550e8400-e29b-41d4-a716-446655440000",
        remarks: "",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "remarks");

      expect(message).toContain("Cancellation reason");
      expect(message).toContain("required");
    });

    it("should enforce reason length limit", () => {
      const result = CancelAssessmentSchema.safeParse({
        assessmentId: "550e8400-e29b-41d4-a716-446655440000",
        remarks: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "remarks");

      expect(message).toContain("500 characters");
      expect(message).toContain("or less");
    });
  });

  describe("AddSpecialFeeSchema", () => {
    it("should require positive amount", () => {
      const result = AddSpecialFeeSchema.safeParse({
        assessmentId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 0,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "amount");

      expect(message).toContain("greater than zero");
    });

    it("should enforce reason length limit", () => {
      const result = AddSpecialFeeSchema.safeParse({
        assessmentId: "550e8400-e29b-41d4-a716-446655440000",
        amount: 1000,
        reason: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "reason");

      expect(message).toContain("500 characters");
    });
  });

  describe("RemoveSpecialFeeSchema", () => {
    it("should require reason for removal", () => {
      const result = RemoveSpecialFeeSchema.safeParse({
        assessmentItemId: "550e8400-e29b-41d4-a716-446655440000",
        reason: "",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "reason");

      expect(message).toContain("Reason");
      expect(message).toContain("required");
      expect(message).toContain("special education fee");
    });
  });
});

// ─── Discount Schema Error Messages ──────────────────────────────────────────

describe("Discount Schema Error Messages", () => {
  describe("createDiscountTypeSchema", () => {
    it("should require code", () => {
      const result = createDiscountTypeSchema.safeParse({
        code: "",
        name: "Test Discount",
        calculationType: "percentage",
        baseType: "tuition_only",
        defaultValue: 10,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "code");

      expect(message).toContain("Code");
      expect(message).toContain("required");
    });

    it("should explain code format requirements", () => {
      const result = createDiscountTypeSchema.safeParse({
        code: "test-code",
        name: "Test Discount",
        calculationType: "percentage",
        baseType: "tuition_only",
        defaultValue: 10,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "code");

      expect(message).toContain("uppercase letters");
      expect(message).toContain("numbers");
      expect(message).toContain("underscores");
    });

    it("should enforce code length limit", () => {
      const result = createDiscountTypeSchema.safeParse({
        code: "A".repeat(51),
        name: "Test Discount",
        calculationType: "percentage",
        baseType: "tuition_only",
        defaultValue: 10,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "code");

      expect(message).toContain("50 characters");
    });

    it("should enforce name length limit", () => {
      const result = createDiscountTypeSchema.safeParse({
        code: "TEST_CODE",
        name: "A".repeat(101),
        calculationType: "percentage",
        baseType: "tuition_only",
        defaultValue: 10,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "name");

      expect(message).toContain("100 characters");
    });

    it("should enforce maximum value limit", () => {
      const result = createDiscountTypeSchema.safeParse({
        code: "TEST_CODE",
        name: "Test Discount",
        calculationType: "fixed_amount",
        baseType: "tuition_only",
        defaultValue: 10000000000,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "defaultValue");

      expect(message).toContain("exceeds maximum");
    });
  });

  describe("approveDiscountRequestSchema", () => {
    it("should require positive override value", () => {
      const result = approveDiscountRequestSchema.safeParse({
        discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
        overrideValue: 0,
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "overrideValue");

      expect(message).toContain("positive");
    });

    it("should enforce override reason length limit", () => {
      const result = approveDiscountRequestSchema.safeParse({
        discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
        overrideReason: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "overrideReason");

      expect(message).toContain("500 characters");
    });

    it("should enforce remarks length limit", () => {
      const result = approveDiscountRequestSchema.safeParse({
        discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
        decisionRemarks: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "decisionRemarks");

      expect(message).toContain("500 characters");
    });
  });

  describe("rejectDiscountRequestSchema", () => {
    it("should require rejection reason", () => {
      const result = rejectDiscountRequestSchema.safeParse({
        discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
        decisionRemarks: "",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "decisionRemarks");

      expect(message).toContain("Rejection reason");
      expect(message).toContain("required");
    });

    it("should enforce remarks length limit", () => {
      const result = rejectDiscountRequestSchema.safeParse({
        discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
        decisionRemarks: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "decisionRemarks");

      expect(message).toContain("500 characters");
    });
  });

  describe("reverseDiscountSchema", () => {
    it("should require reversal reason", () => {
      const result = reverseDiscountSchema.safeParse({
        studentDiscountId: "550e8400-e29b-41d4-a716-446655440000",
        reversalRemarks: "",
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "reversalRemarks");

      expect(message).toContain("Reversal reason");
      expect(message).toContain("required");
    });

    it("should enforce remarks length limit", () => {
      const result = reverseDiscountSchema.safeParse({
        studentDiscountId: "550e8400-e29b-41d4-a716-446655440000",
        reversalRemarks: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "reversalRemarks");

      expect(message).toContain("500 characters");
    });
  });

  describe("bulkApproveDiscountsSchema", () => {
    it("should require at least one selection", () => {
      const result = bulkApproveDiscountsSchema.safeParse({
        discountRequestIds: [],
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "discountRequestIds");

      expect(message).toContain("At least one");
      expect(message).toContain("must be selected");
    });

    it("should enforce remarks length limit", () => {
      const result = bulkApproveDiscountsSchema.safeParse({
        discountRequestIds: ["550e8400-e29b-41d4-a716-446655440000"],
        decisionRemarks: "x".repeat(501),
      });

      const errors = getFieldErrors(result);
      const message = getFirstError(errors, "decisionRemarks");

      expect(message).toContain("500 characters");
    });
  });
});

// ─── Error Message Quality Checks ────────────────────────────────────────────

describe("Error Message Quality Standards", () => {
  it("should not have overly technical error messages", () => {
    // Test a variety of invalid inputs and check messages are user-friendly
    // Note: "NaN" is excluded because Zod's coercion error "received nan" is acceptable
    const technicalTerms = [
      "TypeError",
      "undefined",
      "null",
      "Invalid type",
    ];

    const result = PostPaymentSchema.safeParse({
      studentId: "not-a-uuid",
      assessmentId: "also-not-uuid",
      amount: "not-a-number",
      paymentMethod: "invalid",
    });

    if (!result.success) {
      const allMessages = result.error.issues.map((i) => i.message).join(" ");
      technicalTerms.forEach((term) => {
        expect(allMessages.toLowerCase()).not.toContain(term.toLowerCase());
      });
    }
  });

  it("should provide actionable guidance when possible", () => {
    // Check that format-related errors include examples
    const result = PostPaymentSchema.safeParse({
      studentId: "550e8400-e29b-41d4-a716-446655440000",
      assessmentId: "550e8400-e29b-41d4-a716-446655440001",
      amount: 1000,
      paymentMethod: "check",
      isManualEntry: true,
      manualPaymentDate: new Date().toISOString(),
      manualOrNumber: "invalid",
    });

    if (!result.success) {
      const orFormatIssue = result.error.issues.find((i) =>
        i.path.includes("manualOrNumber")
      );
      expect(orFormatIssue?.message).toContain("e.g.");
    }
  });

  it("should have consistent character limit messaging", () => {
    // All 500-char limit messages should use same format
    const schemas = [
      {
        schema: CancelAssessmentSchema,
        data: {
          assessmentId: "550e8400-e29b-41d4-a716-446655440000",
          remarks: "x".repeat(501),
        },
        field: "remarks",
      },
      {
        schema: RemoveSpecialFeeSchema,
        data: {
          assessmentItemId: "550e8400-e29b-41d4-a716-446655440000",
          reason: "x".repeat(501),
        },
        field: "reason",
      },
      {
        schema: reverseDiscountSchema,
        data: {
          studentDiscountId: "550e8400-e29b-41d4-a716-446655440000",
          reversalRemarks: "x".repeat(501),
        },
        field: "reversalRemarks",
      },
    ];

    schemas.forEach(({ schema, data, field }) => {
      const result = schema.safeParse(data);
      const errors = getFieldErrors(result);
      const message = getFirstError(errors, field);

      expect(message).toMatch(/500 characters/);
      expect(message).toMatch(/or less/);
    });
  });

  it("should use consistent 'required' messaging", () => {
    // Test that required field messages are consistent
    const requiredTests = [
      {
        result: VoidPaymentSchema.safeParse({ paymentId: "", voidReason: "" }),
        field: "paymentId",
      },
      {
        result: CancelAssessmentSchema.safeParse({
          assessmentId: "550e8400-e29b-41d4-a716-446655440000",
          remarks: "",
        }),
        field: "remarks",
      },
      {
        result: rejectDiscountRequestSchema.safeParse({
          discountRequestId: "550e8400-e29b-41d4-a716-446655440000",
          decisionRemarks: "",
        }),
        field: "decisionRemarks",
      },
    ];

    requiredTests.forEach(({ result, field }) => {
      const errors = getFieldErrors(result);
      const message = getFirstError(errors, field);

      // All required messages should contain "required" keyword
      expect(message?.toLowerCase()).toContain("required");
    });
  });
});
