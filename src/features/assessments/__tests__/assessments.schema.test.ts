import { describe, it, expect } from "vitest";
import {
  CreateAssessmentFromEnrollmentSchema,
  CancelAssessmentSchema,
  AddSpecialFeeSchema,
  RemoveSpecialFeeSchema,
  computeAssessmentTotals,
} from "../assessments.schema";

/**
 * Assessment Schema Unit Tests
 *
 * Tests for:
 * 1. computeAssessmentTotals utility function
 * 2. CreateAssessmentFromEnrollmentSchema validation
 * 3. CancelAssessmentSchema validation
 * 4. AddSpecialFeeSchema validation
 * 5. RemoveSpecialFeeSchema validation
 */

// ─────────────────────────────────────────────────────────────────
// computeAssessmentTotals Tests
// ─────────────────────────────────────────────────────────────────

describe("computeAssessmentTotals", () => {
  describe("basic calculations", () => {
    it("should sum positive amounts for non-discount items", () => {
      const items = [
        { amount: 50000, isDiscount: false },
        { amount: 5000, isDiscount: false },
        { amount: 2000, isDiscount: false },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(57000);
    });

    it("should subtract discount amounts from total", () => {
      const items = [
        { amount: 100000, isDiscount: false }, // Tuition
        { amount: 5000, isDiscount: false }, // Misc
        { amount: 20000, isDiscount: true }, // Scholarship discount
      ];

      const total = computeAssessmentTotals(items);

      // 100k + 5k - 20k = 85k
      expect(total).toBe(85000);
    });

    it("should handle multiple discounts", () => {
      const items = [
        { amount: 100000, isDiscount: false },
        { amount: 10000, isDiscount: true }, // 10% discount
        { amount: 5000, isDiscount: true }, // Additional discount
      ];

      const total = computeAssessmentTotals(items);

      // 100k - 10k - 5k = 85k
      expect(total).toBe(85000);
    });

    it("should return 0 for empty items array", () => {
      const items: { amount: number; isDiscount: boolean }[] = [];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(0);
    });

    it("should handle single item", () => {
      const items = [{ amount: 75000, isDiscount: false }];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(75000);
    });

    it("should handle single discount item", () => {
      const items = [{ amount: 5000, isDiscount: true }];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(-5000);
    });
  });

  describe("edge cases", () => {
    it("should handle zero amounts", () => {
      const items = [
        { amount: 100000, isDiscount: false },
        { amount: 0, isDiscount: false },
        { amount: 0, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(100000);
    });

    it("should handle discounts equal to charges (zero balance)", () => {
      const items = [
        { amount: 50000, isDiscount: false },
        { amount: 50000, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(0);
    });

    it("should handle discounts exceeding charges (negative balance)", () => {
      const items = [
        { amount: 30000, isDiscount: false },
        { amount: 50000, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(-20000);
    });

    it("should handle floating point amounts correctly", () => {
      const items = [
        { amount: 100000.5, isDiscount: false },
        { amount: 5000.25, isDiscount: false },
        { amount: 10000.75, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      // 100000.50 + 5000.25 - 10000.75 = 95000.00
      expect(total).toBe(95000);
    });

    it("should handle very small amounts (centavos)", () => {
      const items = [
        { amount: 0.01, isDiscount: false },
        { amount: 0.01, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(0);
    });

    it("should handle very large amounts", () => {
      const items = [
        { amount: 1000000, isDiscount: false },
        { amount: 500000, isDiscount: false },
        { amount: 250000, isDiscount: true },
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(1250000);
    });
  });

  describe("realistic assessment scenarios", () => {
    it("should calculate Casa level assessment correctly", () => {
      // Typical Casa (Kindergarten) assessment
      const items = [
        { amount: 45000, isDiscount: false }, // Tuition
        { amount: 5000, isDiscount: false }, // Misc Fee
        { amount: 3000, isDiscount: false }, // Books
        { amount: 2000, isDiscount: false }, // Uniform
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(55000);
    });

    it("should calculate SHS assessment with scholarship correctly", () => {
      // Senior High School with ESC scholarship
      const items = [
        { amount: 85000, isDiscount: false }, // Tuition
        { amount: 8000, isDiscount: false }, // Misc Fee
        { amount: 5000, isDiscount: false }, // Lab Fee
        { amount: 17000, isDiscount: true }, // ESC Scholarship (20%)
      ];

      const total = computeAssessmentTotals(items);

      // 85k + 8k + 5k - 17k = 81k
      expect(total).toBe(81000);
    });

    it("should calculate assessment with balance forward correctly", () => {
      // Current year fees + balance from prior year
      const items = [
        { amount: 15000, isDiscount: false }, // Balance Forward from SY 2024-2025
        { amount: 50000, isDiscount: false }, // Tuition
        { amount: 5000, isDiscount: false }, // Misc Fee
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(70000);
    });

    it("should calculate assessment with multiple discounts correctly", () => {
      // Assessment with multiple discount types
      const items = [
        { amount: 100000, isDiscount: false }, // Tuition
        { amount: 10000, isDiscount: false }, // Misc Fee
        { amount: 20000, isDiscount: true }, // ESC Scholarship
        { amount: 11000, isDiscount: true }, // Full Payment Discount (10%)
      ];

      const total = computeAssessmentTotals(items);

      // 100k + 10k - 20k - 11k = 79k
      expect(total).toBe(79000);
    });

    it("should calculate SPED assessment correctly", () => {
      // Special Education student with SPED fee
      const items = [
        { amount: 50000, isDiscount: false }, // Tuition
        { amount: 5000, isDiscount: false }, // Misc Fee
        { amount: 15000, isDiscount: false }, // SPED Fee
      ];

      const total = computeAssessmentTotals(items);

      expect(total).toBe(70000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// CreateAssessmentFromEnrollmentSchema Tests
// ─────────────────────────────────────────────────────────────────

describe("CreateAssessmentFromEnrollmentSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validItemUuid = "660e8400-e29b-41d4-a716-446655440001";

  describe("valid inputs", () => {
    it("should accept valid enrollment with items", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enrollmentId).toBe(validUuid);
        expect(result.data.items).toHaveLength(1);
      }
    });

    it("should accept valid enrollment with multiple items", () => {
      const input = {
        enrollmentId: validUuid,
        items: [
          { feeTemplateItemId: validItemUuid, amount: 50000 },
          {
            feeTemplateItemId: "770e8400-e29b-41d4-a716-446655440002",
            amount: 5000,
          },
        ],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
      }
    });

    it("should accept valid enrollment with optional remarks", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
        remarks: "Standard assessment for SY 2025-2026",
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remarks).toBe("Standard assessment for SY 2025-2026");
      }
    });

    it("should accept valid enrollment with optional SPED fee amount", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
        spedFeeAmount: 15000,
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.spedFeeAmount).toBe(15000);
      }
    });

    it("should coerce string amounts to numbers", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: "50000" }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items[0].amount).toBe(50000);
      }
    });

    it("should trim remarks whitespace", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
        remarks: "  Test remarks  ",
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remarks).toBe("Test remarks");
      }
    });

    it("should accept zero amount items", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 0 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("invalid enrollmentId", () => {
    it("should reject missing enrollmentId", () => {
      const input = {
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid UUID format", () => {
      const input = {
        enrollmentId: "not-a-uuid",
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject empty enrollmentId", () => {
      const input = {
        enrollmentId: "",
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("invalid items", () => {
    it("should reject empty items array", () => {
      const input = {
        enrollmentId: validUuid,
        items: [],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.items).toBeDefined();
      }
    });

    it("should reject negative amounts", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: -5000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject duplicate feeTemplateItemId", () => {
      const input = {
        enrollmentId: validUuid,
        items: [
          { feeTemplateItemId: validItemUuid, amount: 50000 },
          { feeTemplateItemId: validItemUuid, amount: 30000 }, // Same ID
        ],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const issues = result.error.issues;
        expect(issues.some((i) => i.message.includes("once"))).toBe(true);
      }
    });

    it("should reject invalid feeTemplateItemId UUID", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: "invalid-uuid", amount: 50000 }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject NaN amounts", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: NaN }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject Infinity amounts", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: Infinity }],
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("invalid spedFeeAmount", () => {
    it("should reject zero SPED fee amount", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
        spedFeeAmount: 0,
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject negative SPED fee amount", () => {
      const input = {
        enrollmentId: validUuid,
        items: [{ feeTemplateItemId: validItemUuid, amount: 50000 }],
        spedFeeAmount: -5000,
      };

      const result = CreateAssessmentFromEnrollmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// CancelAssessmentSchema Tests
// ─────────────────────────────────────────────────────────────────

describe("CancelAssessmentSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  describe("valid inputs", () => {
    it("should accept valid assessmentId and remarks", () => {
      const input = {
        assessmentId: validUuid,
        remarks: "Student requested enrollment cancellation",
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessmentId).toBe(validUuid);
        expect(result.data.remarks).toBe("Student requested enrollment cancellation");
      }
    });

    it("should trim remarks whitespace", () => {
      const input = {
        assessmentId: validUuid,
        remarks: "  Cancellation reason  ",
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remarks).toBe("Cancellation reason");
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject missing remarks (required)", () => {
      const input = {
        assessmentId: validUuid,
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject empty remarks", () => {
      const input = {
        assessmentId: validUuid,
        remarks: "",
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only remarks", () => {
      const input = {
        assessmentId: validUuid,
        remarks: "   ",
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject remarks exceeding 500 characters", () => {
      const input = {
        assessmentId: validUuid,
        remarks: "x".repeat(501),
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid assessmentId", () => {
      const input = {
        assessmentId: "invalid-uuid",
        remarks: "Valid reason",
      };

      const result = CancelAssessmentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// AddSpecialFeeSchema Tests
// ─────────────────────────────────────────────────────────────────

describe("AddSpecialFeeSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  describe("valid inputs", () => {
    it("should accept valid assessmentId and amount", () => {
      const input = {
        assessmentId: validUuid,
        amount: 15000,
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(15000);
      }
    });

    it("should accept optional reason", () => {
      const input = {
        assessmentId: validUuid,
        amount: 15000,
        reason: "Student requires speech therapy services",
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reason).toBe("Student requires speech therapy services");
      }
    });

    it("should coerce string amounts", () => {
      const input = {
        assessmentId: validUuid,
        amount: "15000",
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(15000);
      }
    });

    it("should accept decimal amounts", () => {
      const input = {
        assessmentId: validUuid,
        amount: 15000.5,
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(15000.5);
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject zero amount", () => {
      const input = {
        assessmentId: validUuid,
        amount: 0,
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject negative amount", () => {
      const input = {
        assessmentId: validUuid,
        amount: -5000,
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject reason exceeding 500 characters", () => {
      const input = {
        assessmentId: validUuid,
        amount: 15000,
        reason: "x".repeat(501),
      };

      const result = AddSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// RemoveSpecialFeeSchema Tests
// ─────────────────────────────────────────────────────────────────

describe("RemoveSpecialFeeSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  describe("valid inputs", () => {
    it("should accept valid assessmentItemId and reason", () => {
      const input = {
        assessmentItemId: validUuid,
        reason: "Student no longer requires special education services",
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.assessmentItemId).toBe(validUuid);
        expect(result.data.reason).toBe(
          "Student no longer requires special education services"
        );
      }
    });

    it("should trim reason whitespace", () => {
      const input = {
        assessmentItemId: validUuid,
        reason: "  Removal reason  ",
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reason).toBe("Removal reason");
      }
    });
  });

  describe("invalid inputs", () => {
    it("should reject missing reason (required)", () => {
      const input = {
        assessmentItemId: validUuid,
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject empty reason", () => {
      const input = {
        assessmentItemId: validUuid,
        reason: "",
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject whitespace-only reason", () => {
      const input = {
        assessmentItemId: validUuid,
        reason: "   ",
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject reason exceeding 500 characters", () => {
      const input = {
        assessmentItemId: validUuid,
        reason: "x".repeat(501),
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid assessmentItemId", () => {
      const input = {
        assessmentItemId: "not-a-uuid",
        reason: "Valid reason",
      };

      const result = RemoveSpecialFeeSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});
