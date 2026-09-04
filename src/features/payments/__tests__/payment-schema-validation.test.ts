/**
 * Payment Schema Validation Tests
 *
 * Tests for PostPaymentSchema validation including:
 * - Amount validation (must be > 0)
 * - Payment method validation (enum values)
 * - Cash tendered validation (must be >= amount for cash)
 * - Reference number required for gcash/bank_transfer
 * - idempotencyKey UUID format validation
 * - Cash discount flag validation
 *
 * H5 Finding: High-priority test for payment schema validation
 */

import { describe, it, expect } from "vitest";
import { PostPaymentSchema, VoidPaymentSchema } from "../payments.schema";

describe("PostPaymentSchema Validation", () => {
  // Base valid payment data for auto-assign mode
  const validAutoPayment = {
    studentId: "550e8400-e29b-41d4-a716-446655440001",
    assessmentId: "550e8400-e29b-41d4-a716-446655440002",
    bookletId: "550e8400-e29b-41d4-a716-446655440003",
    amount: 5000,
    paymentMethod: "cash" as const,
    amountTendered: 5000,
    isManualEntry: false,
  };

  describe("Amount Validation", () => {
    it("should accept positive amount", () => {
      const result = PostPaymentSchema.safeParse(validAutoPayment);
      expect(result.success).toBe(true);
    });

    it("should accept minimum positive amount (0.01)", () => {
      const data = { ...validAutoPayment, amount: 0.01, amountTendered: 0.01 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept large amounts", () => {
      const data = { ...validAutoPayment, amount: 999999.99, amountTendered: 999999.99 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject zero amount", () => {
      const data = { ...validAutoPayment, amount: 0, amountTendered: 0 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.amount).toBeDefined();
        expect(errors.amount?.[0]).toContain("greater than 0");
      }
    });

    it("should reject negative amount", () => {
      const data = { ...validAutoPayment, amount: -100 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.amount).toBeDefined();
      }
    });

    it("should coerce string amount to number", () => {
      const data = { ...validAutoPayment, amount: "5000" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(5000);
      }
    });

    it("should reject non-numeric string amount", () => {
      const data = { ...validAutoPayment, amount: "abc" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("Payment Method Validation", () => {
    const paymentMethods = ["cash", "check", "bank_transfer", "gcash", "other"] as const;

    paymentMethods.forEach((method) => {
      it(`should accept payment method: ${method}`, () => {
        const data = {
          ...validAutoPayment,
          paymentMethod: method,
          // Remove cash-specific fields for non-cash methods
          amountTendered: method === "cash" ? 5000 : undefined,
          // Add reference number for methods that require it
          referenceNumber:
            method === "gcash" || method === "bank_transfer" ? "REF123456" : undefined,
        };
        const result = PostPaymentSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });

    it("should reject invalid payment method", () => {
      const data = { ...validAutoPayment, paymentMethod: "bitcoin" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.paymentMethod).toBeDefined();
      }
    });

    it("should reject empty payment method", () => {
      const data = { ...validAutoPayment, paymentMethod: "" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("Cash Tendered Validation", () => {
    it("should accept cash tendered equal to amount", () => {
      const data = { ...validAutoPayment, amount: 5000, amountTendered: 5000 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept cash tendered greater than amount (change due)", () => {
      const data = { ...validAutoPayment, amount: 5000, amountTendered: 6000 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject cash tendered less than amount", () => {
      const data = { ...validAutoPayment, amount: 5000, amountTendered: 4000 };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.amountTendered).toBeDefined();
        expect(errors.amountTendered?.[0]).toContain("equal to or greater than");
      }
    });

    it("should require cash tendered for cash payments", () => {
      const data = { ...validAutoPayment, paymentMethod: "cash", amountTendered: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.amountTendered).toBeDefined();
      }
    });

    it("should not require cash tendered for check payments", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "check",
        amountTendered: undefined,
        referenceNumber: "CHECK123",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should coerce string amountTendered to number", () => {
      const data = { ...validAutoPayment, amountTendered: "5000" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountTendered).toBe(5000);
      }
    });

    it("should handle empty string as undefined for amountTendered", () => {
      const data = { ...validAutoPayment, paymentMethod: "check", amountTendered: "" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amountTendered).toBeUndefined();
      }
    });
  });

  describe("Reference Number Validation", () => {
    it("should require reference number for gcash", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "gcash",
        amountTendered: undefined,
        referenceNumber: undefined,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.referenceNumber).toBeDefined();
        expect(errors.referenceNumber?.[0]).toContain("GCash and bank transfer");
      }
    });

    it("should require reference number for bank_transfer", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "bank_transfer",
        amountTendered: undefined,
        referenceNumber: undefined,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.referenceNumber).toBeDefined();
      }
    });

    it("should accept gcash with reference number", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "gcash",
        amountTendered: undefined,
        referenceNumber: "GCASH123456789",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept bank_transfer with reference number", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "bank_transfer",
        amountTendered: undefined,
        referenceNumber: "BPI-2024-001234",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should not require reference number for cash", () => {
      const data = { ...validAutoPayment, referenceNumber: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should not require reference number for check", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "check",
        amountTendered: undefined,
        referenceNumber: undefined,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should trim reference number whitespace", () => {
      const data = {
        ...validAutoPayment,
        paymentMethod: "gcash",
        amountTendered: undefined,
        referenceNumber: "  REF123456  ",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.referenceNumber).toBe("REF123456");
      }
    });

    it("should handle empty string as undefined for reference number", () => {
      const data = { ...validAutoPayment, referenceNumber: "" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.referenceNumber).toBeUndefined();
      }
    });
  });

  describe("idempotencyKey Validation", () => {
    it("should accept valid UUID idempotencyKey", () => {
      const data = {
        ...validAutoPayment,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept missing idempotencyKey (optional)", () => {
      const data = { ...validAutoPayment, idempotencyKey: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idempotencyKey).toBeUndefined();
      }
    });

    it("should reject invalid UUID format", () => {
      const data = {
        ...validAutoPayment,
        idempotencyKey: "not-a-valid-uuid",
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should handle empty string as undefined", () => {
      const data = { ...validAutoPayment, idempotencyKey: "" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idempotencyKey).toBeUndefined();
      }
    });

    it("should handle null as undefined", () => {
      const data = { ...validAutoPayment, idempotencyKey: null };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idempotencyKey).toBeUndefined();
      }
    });
  });

  describe("Cash Discount Flag Validation", () => {
    it("should accept applyCashDiscount as true", () => {
      const data = { ...validAutoPayment, applyCashDiscount: true };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(true);
      }
    });

    it("should accept applyCashDiscount as false", () => {
      const data = { ...validAutoPayment, applyCashDiscount: false };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(false);
      }
    });

    it("should default to false when not provided", () => {
      const data = { ...validAutoPayment, applyCashDiscount: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(false);
      }
    });

    it("should coerce string 'true' to boolean true", () => {
      const data = { ...validAutoPayment, applyCashDiscount: "true" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(true);
      }
    });

    it("should coerce string 'false' to boolean false", () => {
      const data = { ...validAutoPayment, applyCashDiscount: "false" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(false);
      }
    });
  });

  describe("Student and Assessment ID Validation", () => {
    it("should require valid UUID for studentId", () => {
      const data = { ...validAutoPayment, studentId: "invalid-uuid" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.studentId).toBeDefined();
      }
    });

    it("should require valid UUID for assessmentId", () => {
      const data = { ...validAutoPayment, assessmentId: "invalid-uuid" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.assessmentId).toBeDefined();
      }
    });

    it("should require studentId", () => {
      const { studentId, ...dataWithoutStudent } = validAutoPayment;
      const result = PostPaymentSchema.safeParse(dataWithoutStudent);
      expect(result.success).toBe(false);
    });

    it("should require assessmentId", () => {
      const { assessmentId, ...dataWithoutAssessment } = validAutoPayment;
      const result = PostPaymentSchema.safeParse(dataWithoutAssessment);
      expect(result.success).toBe(false);
    });
  });

  describe("Booklet ID Validation (Auto-assign Mode)", () => {
    it("should require bookletId in auto-assign mode", () => {
      const data = { ...validAutoPayment, isManualEntry: false, bookletId: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.bookletId).toBeDefined();
        expect(errors.bookletId?.[0]).toContain("Booklet selection is required");
      }
    });

    it("should require valid UUID for bookletId", () => {
      const data = { ...validAutoPayment, bookletId: "invalid-uuid" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should handle empty string bookletId as undefined", () => {
      const data = { ...validAutoPayment, bookletId: "" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.bookletId).toBeDefined();
      }
    });
  });

  describe("Remarks Validation", () => {
    it("should accept remarks string", () => {
      const data = { ...validAutoPayment, remarks: "Partial payment for tuition" };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remarks).toBe("Partial payment for tuition");
      }
    });

    it("should trim remarks whitespace", () => {
      const data = { ...validAutoPayment, remarks: "  Partial payment  " };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remarks).toBe("Partial payment");
      }
    });

    it("should accept undefined remarks", () => {
      const data = { ...validAutoPayment, remarks: undefined };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });

  describe("Combined Validation Scenarios", () => {
    it("should validate complete cash payment", () => {
      const data = {
        studentId: "550e8400-e29b-41d4-a716-446655440001",
        assessmentId: "550e8400-e29b-41d4-a716-446655440002",
        bookletId: "550e8400-e29b-41d4-a716-446655440003",
        amount: 15000,
        paymentMethod: "cash",
        amountTendered: 20000,
        remarks: "Full payment for enrollment",
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440004",
        isManualEntry: false,
        applyCashDiscount: true,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should validate complete gcash payment", () => {
      const data = {
        studentId: "550e8400-e29b-41d4-a716-446655440001",
        assessmentId: "550e8400-e29b-41d4-a716-446655440002",
        bookletId: "550e8400-e29b-41d4-a716-446655440003",
        amount: 5000,
        paymentMethod: "gcash",
        referenceNumber: "GCASH-123456789",
        isManualEntry: false,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject cash payment with missing tendered amount", () => {
      const data = {
        studentId: "550e8400-e29b-41d4-a716-446655440001",
        assessmentId: "550e8400-e29b-41d4-a716-446655440002",
        bookletId: "550e8400-e29b-41d4-a716-446655440003",
        amount: 5000,
        paymentMethod: "cash",
        // Missing amountTendered
        isManualEntry: false,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject gcash payment with missing reference number", () => {
      const data = {
        studentId: "550e8400-e29b-41d4-a716-446655440001",
        assessmentId: "550e8400-e29b-41d4-a716-446655440002",
        bookletId: "550e8400-e29b-41d4-a716-446655440003",
        amount: 5000,
        paymentMethod: "gcash",
        // Missing referenceNumber
        isManualEntry: false,
      };
      const result = PostPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });
});

describe("VoidPaymentSchema Validation", () => {
  describe("paymentId Validation", () => {
    it("should accept valid UUID paymentId", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "Duplicate payment entry",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID paymentId", () => {
      const data = {
        paymentId: "invalid-uuid",
        voidReason: "Duplicate payment entry",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should require paymentId", () => {
      const data = {
        voidReason: "Duplicate payment entry",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe("voidReason Validation", () => {
    it("should accept valid void reason", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "Duplicate payment entry",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should reject void reason less than 3 characters", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "ab",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.voidReason).toBeDefined();
        expect(errors.voidReason?.[0]).toContain("reason for voiding");
      }
    });

    it("should accept exactly 3 character void reason", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "abc",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should trim void reason whitespace", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "  Duplicate payment  ",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.voidReason).toBe("Duplicate payment");
      }
    });

    it("should reject empty void reason", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only void reason (after trim)", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason: "   ",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it("should accept long void reason", () => {
      const data = {
        paymentId: "550e8400-e29b-41d4-a716-446655440001",
        voidReason:
          "This payment was made in error. The student already paid through bank transfer earlier today. " +
          "The cashier did not see the prior payment in the system due to a sync delay. " +
          "We are voiding this duplicate cash payment to correct the ledger.",
      };
      const result = VoidPaymentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });
  });
});
