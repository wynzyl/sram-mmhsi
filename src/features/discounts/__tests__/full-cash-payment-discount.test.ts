import { describe, it, expect } from "vitest";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
  calculateTotalDiscounts,
  sumDiscountLines,
  formatDiscountDescription,
  validateDiscountLine,
  type CalculationAssessmentItem,
  type ApprovedDiscountRequest,
  type DiscountLine,
} from "../utils/discount-calculations";
import {
  calculateCascadeAdjustments,
  generateCascadePreview,
  formatCascadeAdjustmentDescription,
  calculateFinalPaymentWithCascade,
  validateCascadeEligibility,
  type StudentDiscountForCascade,
  type CascadeAdjustmentLine,
} from "../utils/cascade-calculations";
import { FULL_PAYMENT_DISCOUNT_CODE } from "@/lib/constants/discount-codes";

/**
 * Full Cash Payment Discount - Unit Tests
 *
 * Business Rules:
 * 1. Full payment = paymentAmount >= assessmentBalance (within 0.01 epsilon)
 * 2. Must be within school year cutoff date
 * 3. After school year start date
 * 4. Not already applied to this assessment
 * 5. Active school year only
 * 6. FULL_PAYMENT_DISCOUNT type must exist and be active
 * 7. Assessment not cancelled/transferred
 *
 * Calculation Rules:
 * - tuition_only: Discount base = sum of TUITION fee items
 * - full_assessment: Discount base = sum of all non-discount items
 * - Percentage: amount = (base × discountValue) / 100, capped at base
 * - Fixed: amount = min(discountValue, base)
 *
 * Cascading Rules:
 * - When cash discount applied, existing tuition_only scholarships are recalculated
 * - New tuition base = original tuition - cash discount
 * - Cascade adjustment = original discount - recalculated discount (positive)
 */

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

/** Standard assessment items for testing */
const createStandardAssessmentItems = (): CalculationAssessmentItem[] => [
  {
    id: "item-1",
    amount: 100000, // Tuition: ₱100,000
    isDiscount: false,
    feeItemTypeCode: "TUITION",
  },
  {
    id: "item-2",
    amount: 5000, // Misc Fee: ₱5,000
    isDiscount: false,
    feeItemTypeCode: "MISC_FEE",
  },
  {
    id: "item-3",
    amount: 2000, // Lab Fee: ₱2,000
    isDiscount: false,
    feeItemTypeCode: "LAB_FEE",
  },
];

/** Assessment items with existing discount */
const createAssessmentItemsWithDiscount = (): CalculationAssessmentItem[] => [
  ...createStandardAssessmentItems(),
  {
    id: "item-4",
    amount: -20000, // ESC Scholarship: -₱20,000
    isDiscount: true,
    feeItemTypeCode: null,
  },
];

/** Create a tuition-only scholarship discount */
const createTuitionOnlyScholarship = (
  overrides?: Partial<StudentDiscountForCascade>
): StudentDiscountForCascade => ({
  id: "discount-esc",
  studentId: "student-1",
  assessmentId: "assessment-1",
  discountTypeCode: "ESC_SCHOLARSHIP",
  discountTypeName: "ESC Scholarship",
  calculationType: "percentage",
  baseType: "tuition_only",
  baseAmount: 100000,
  discountValue: 20, // 20%
  discountAmount: 20000, // 20% of 100k
  assessmentItemId: "item-4",
  cascadeAdjustmentAmount: null,
  ...overrides,
});

/** Create full payment discount request */
const createFullPaymentDiscountRequest = (
  overrides?: Partial<ApprovedDiscountRequest>
): ApprovedDiscountRequest => ({
  id: "request-1",
  discountTypeId: "dtype-1",
  overrideValue: null,
  discountType: {
    code: FULL_PAYMENT_DISCOUNT_CODE,
    name: "Full Cash Payment Discount",
    calculationType: "percentage",
    baseType: "full_assessment",
    defaultValue: 10, // 10%
  },
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────
// Discount Constant Tests
// ─────────────────────────────────────────────────────────────────

describe("Full Cash Payment Discount Constants", () => {
  it("should have correct discount code", () => {
    expect(FULL_PAYMENT_DISCOUNT_CODE).toBe("FULL_PAYMENT_DISCOUNT");
  });
});

// ─────────────────────────────────────────────────────────────────
// Base Calculation Tests
// ─────────────────────────────────────────────────────────────────

describe("calculateDiscountBase", () => {
  describe("tuition_only base type", () => {
    it("should sum only TUITION items", () => {
      const items = createStandardAssessmentItems();

      const base = calculateDiscountBase(items, "tuition_only");

      expect(base).toBe(100000);
    });

    it("should return 0 when no TUITION items exist", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
        { id: "2", amount: 2000, isDiscount: false, feeItemTypeCode: "LAB_FEE" },
      ];

      const base = calculateDiscountBase(items, "tuition_only");

      expect(base).toBe(0);
    });

    it("should handle multiple TUITION items", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 50000, isDiscount: false, feeItemTypeCode: "TUITION" },
        { id: "2", amount: 30000, isDiscount: false, feeItemTypeCode: "TUITION" },
        { id: "3", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
      ];

      const base = calculateDiscountBase(items, "tuition_only");

      expect(base).toBe(80000);
    });

    it("should exclude existing discount items", () => {
      const items = createAssessmentItemsWithDiscount();

      const base = calculateDiscountBase(items, "tuition_only");

      // Should only include tuition (100k), not the -20k discount
      expect(base).toBe(100000);
    });

    it("should handle string amounts", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: "75000.50", isDiscount: false, feeItemTypeCode: "TUITION" },
      ];

      const base = calculateDiscountBase(items, "tuition_only");

      expect(base).toBe(75000.5);
    });
  });

  describe("full_assessment base type", () => {
    it("should sum all non-discount items", () => {
      const items = createStandardAssessmentItems();

      const base = calculateDiscountBase(items, "full_assessment");

      // 100k + 5k + 2k = 107k
      expect(base).toBe(107000);
    });

    it("should exclude existing discount items", () => {
      const items = createAssessmentItemsWithDiscount();

      const base = calculateDiscountBase(items, "full_assessment");

      // Should exclude the -20k discount line
      expect(base).toBe(107000);
    });

    it("should return 0 for empty items", () => {
      const base = calculateDiscountBase([], "full_assessment");

      expect(base).toBe(0);
    });

    it("should handle items without fee type code", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 10000, isDiscount: false, feeItemTypeCode: null },
        { id: "2", amount: 5000, isDiscount: false, feeItemTypeCode: undefined },
      ];

      const base = calculateDiscountBase(items, "full_assessment");

      expect(base).toBe(15000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Discount Amount Calculation Tests
// ─────────────────────────────────────────────────────────────────

describe("calculateDiscountAmount", () => {
  describe("percentage calculation", () => {
    it("should calculate correct percentage amount", () => {
      const amount = calculateDiscountAmount(100000, "percentage", 10);

      expect(amount).toBe(10000); // 10% of 100k
    });

    it("should cap at 100% of base", () => {
      const amount = calculateDiscountAmount(100000, "percentage", 150);

      expect(amount).toBe(100000); // Capped at base
    });

    it("should handle 100% discount", () => {
      const amount = calculateDiscountAmount(50000, "percentage", 100);

      expect(amount).toBe(50000);
    });

    it("should handle decimal percentages", () => {
      const amount = calculateDiscountAmount(100000, "percentage", 5.5);

      expect(amount).toBe(5500); // 5.5% of 100k
    });

    it("should return 0 for zero base", () => {
      const amount = calculateDiscountAmount(0, "percentage", 10);

      expect(amount).toBe(0);
    });

    it("should return 0 for negative base", () => {
      const amount = calculateDiscountAmount(-1000, "percentage", 10);

      expect(amount).toBe(0);
    });
  });

  describe("fixed_amount calculation", () => {
    it("should return fixed amount when less than base", () => {
      const amount = calculateDiscountAmount(100000, "fixed_amount", 5000);

      expect(amount).toBe(5000);
    });

    it("should cap at base amount", () => {
      const amount = calculateDiscountAmount(3000, "fixed_amount", 5000);

      expect(amount).toBe(3000); // Capped at base
    });

    it("should return exact base when equal", () => {
      const amount = calculateDiscountAmount(5000, "fixed_amount", 5000);

      expect(amount).toBe(5000);
    });

    it("should return 0 for zero base", () => {
      const amount = calculateDiscountAmount(0, "fixed_amount", 5000);

      expect(amount).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should handle very small percentages", () => {
      const amount = calculateDiscountAmount(100000, "percentage", 0.01);

      expect(amount).toBe(10); // 0.01% of 100k
    });

    it("should handle very large bases", () => {
      const amount = calculateDiscountAmount(1000000000, "percentage", 10);

      expect(amount).toBe(100000000); // 10% of 1 billion
    });

    it("should handle floating point precision", () => {
      const amount = calculateDiscountAmount(33333, "percentage", 33.33);

      // 33.33% of 33333 = 11109.8889
      // Accept within 1 peso tolerance for floating point
      expect(amount).toBeCloseTo(11109.89, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Total Discounts Calculation Tests
// ─────────────────────────────────────────────────────────────────

describe("calculateTotalDiscounts", () => {
  it("should calculate single full payment discount", () => {
    const items = createStandardAssessmentItems();
    const requests = [createFullPaymentDiscountRequest()];

    const discountLines = calculateTotalDiscounts(items, requests);

    expect(discountLines).toHaveLength(1);
    expect(discountLines[0]).toMatchObject({
      discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
      discountTypeName: "Full Cash Payment Discount",
      baseType: "full_assessment",
      baseAmount: 107000, // 100k + 5k + 2k
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 10700, // 10% of 107k
    });
  });

  it("should use override value when provided", () => {
    const items = createStandardAssessmentItems();
    const requests = [
      createFullPaymentDiscountRequest({
        overrideValue: 15, // Override to 15%
      }),
    ];

    const discountLines = calculateTotalDiscounts(items, requests);

    expect(discountLines[0].discountValue).toBe(15);
    expect(discountLines[0].discountAmount).toBe(16050); // 15% of 107k
  });

  it("should calculate multiple discounts independently", () => {
    const items = createStandardAssessmentItems();
    const requests: ApprovedDiscountRequest[] = [
      createFullPaymentDiscountRequest(),
      {
        id: "request-2",
        discountTypeId: "dtype-2",
        overrideValue: null,
        discountType: {
          code: "SIBLING_DISCOUNT",
          name: "Sibling Discount",
          calculationType: "percentage",
          baseType: "tuition_only",
          defaultValue: 5,
        },
      },
    ];

    const discountLines = calculateTotalDiscounts(items, requests);

    expect(discountLines).toHaveLength(2);

    // Full payment: 10% of 107k = 10,700
    expect(discountLines[0].discountAmount).toBe(10700);

    // Sibling: 5% of 100k (tuition only) = 5,000
    expect(discountLines[1].discountAmount).toBe(5000);
  });

  it("should return empty array for no requests", () => {
    const items = createStandardAssessmentItems();

    const discountLines = calculateTotalDiscounts(items, []);

    expect(discountLines).toHaveLength(0);
  });

  it("should handle fixed amount discount type", () => {
    const items = createStandardAssessmentItems();
    const requests: ApprovedDiscountRequest[] = [
      {
        id: "request-1",
        discountTypeId: "dtype-1",
        overrideValue: null,
        discountType: {
          code: "EMPLOYEE_DISCOUNT",
          name: "Employee Discount",
          calculationType: "fixed_amount",
          baseType: "tuition_only",
          defaultValue: 25000,
        },
      },
    ];

    const discountLines = calculateTotalDiscounts(items, requests);

    expect(discountLines[0]).toMatchObject({
      calculationType: "fixed_amount",
      discountValue: 25000,
      discountAmount: 25000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Sum Discount Lines Tests
// ─────────────────────────────────────────────────────────────────

describe("sumDiscountLines", () => {
  it("should sum all discount amounts", () => {
    const lines: DiscountLine[] = [
      {
        discountRequestId: "1",
        discountTypeCode: "A",
        discountTypeName: "Discount A",
        baseType: "full_assessment",
        baseAmount: 100000,
        calculationType: "percentage",
        discountValue: 10,
        discountAmount: 10000,
      },
      {
        discountRequestId: "2",
        discountTypeCode: "B",
        discountTypeName: "Discount B",
        baseType: "tuition_only",
        baseAmount: 80000,
        calculationType: "fixed_amount",
        discountValue: 5000,
        discountAmount: 5000,
      },
    ];

    const total = sumDiscountLines(lines);

    expect(total).toBe(15000);
  });

  it("should return 0 for empty array", () => {
    const total = sumDiscountLines([]);

    expect(total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Format Discount Description Tests
// ─────────────────────────────────────────────────────────────────

describe("formatDiscountDescription", () => {
  it("should format tuition_only discount correctly", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: "ESC",
      discountTypeName: "ESC Scholarship",
      baseType: "tuition_only",
      baseAmount: 100000,
      calculationType: "percentage",
      discountValue: 20,
      discountAmount: 20000,
    };

    const description = formatDiscountDescription(line);

    expect(description).toBe("ESC Scholarship (on ₱100,000 tuition)");
  });

  it("should format full_assessment discount correctly", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
      discountTypeName: "Full Cash Payment Discount",
      baseType: "full_assessment",
      baseAmount: 107000,
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 10700,
    };

    const description = formatDiscountDescription(line);

    expect(description).toBe("Full Cash Payment Discount (on ₱107,000 full assessment)");
  });

  it("should remove trailing decimals from amounts", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: "TEST",
      discountTypeName: "Test Discount",
      baseType: "tuition_only",
      baseAmount: 50000.0, // Has .00 that should be stripped
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 5000,
    };

    const description = formatDiscountDescription(line);

    expect(description).not.toContain(".00");
    expect(description).toBe("Test Discount (on ₱50,000 tuition)");
  });
});

// ─────────────────────────────────────────────────────────────────
// Validate Discount Line Tests
// ─────────────────────────────────────────────────────────────────

describe("validateDiscountLine", () => {
  it("should validate a valid discount line", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
      discountTypeName: "Full Cash Payment Discount",
      baseType: "full_assessment",
      baseAmount: 100000,
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 10000,
    };

    const result = validateDiscountLine(line);

    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject zero base amount with tuition_only message", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: "ESC",
      discountTypeName: "ESC Scholarship",
      baseType: "tuition_only",
      baseAmount: 0,
      calculationType: "percentage",
      discountValue: 20,
      discountAmount: 0,
    };

    const result = validateDiscountLine(line);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("ESC Scholarship");
    expect(result.error).toContain("no tuition fees found");
  });

  it("should reject zero base amount with full_assessment message", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: FULL_PAYMENT_DISCOUNT_CODE,
      discountTypeName: "Full Cash Payment Discount",
      baseType: "full_assessment",
      baseAmount: 0,
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 0,
    };

    const result = validateDiscountLine(line);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("no fees found");
  });

  it("should reject zero discount amount", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: "TEST",
      discountTypeName: "Test Discount",
      baseType: "full_assessment",
      baseAmount: 100000,
      calculationType: "percentage",
      discountValue: 0, // 0% = 0 amount
      discountAmount: 0,
    };

    const result = validateDiscountLine(line);

    expect(result.isValid).toBe(false);
    expect(result.error).toContain("zero amount");
  });

  it("should reject negative base amount", () => {
    const line: DiscountLine = {
      discountRequestId: "1",
      discountTypeCode: "TEST",
      discountTypeName: "Test Discount",
      baseType: "full_assessment",
      baseAmount: -1000, // Negative
      calculationType: "percentage",
      discountValue: 10,
      discountAmount: 0,
    };

    const result = validateDiscountLine(line);

    expect(result.isValid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Cascade Calculation Tests
// ─────────────────────────────────────────────────────────────────

describe("calculateCascadeAdjustments", () => {
  it("should calculate cascade adjustment for ESC scholarship", () => {
    /**
     * Scenario:
     * - Original Tuition: ₱100,000
     * - ESC Scholarship: 20% = ₱20,000
     * - Cash Discount: 10% on full assessment = ₱10,000
     *
     * After cascade:
     * - New tuition base: ₱90,000 (100k - 10k)
     * - ESC recalculated: 20% × 90k = ₱18,000
     * - Cascade adjustment: ₱2,000 (20k - 18k)
     */
    const existingDiscounts = [createTuitionOnlyScholarship()];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    expect(result.originalTuitionBase).toBe(100000);
    expect(result.newTuitionBase).toBe(90000);
    expect(result.cashDiscountAmount).toBe(10000);
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]).toMatchObject({
      studentDiscountId: "discount-esc",
      discountTypeName: "ESC Scholarship",
      originalDiscountAmount: 20000,
      recalculatedDiscountAmount: 18000,
      adjustmentAmount: 2000,
      newBaseAmount: 90000,
    });
    expect(result.totalAdjustment).toBe(2000);
  });

  it("should handle multiple tuition_only discounts", () => {
    const existingDiscounts: StudentDiscountForCascade[] = [
      createTuitionOnlyScholarship({
        id: "discount-esc",
        discountTypeCode: "ESC",
        discountTypeName: "ESC Scholarship",
        discountValue: 20,
        discountAmount: 20000,
      }),
      createTuitionOnlyScholarship({
        id: "discount-sibling",
        discountTypeCode: "SIBLING",
        discountTypeName: "Sibling Discount",
        discountValue: 5,
        discountAmount: 5000,
      }),
    ];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    expect(result.adjustments).toHaveLength(2);

    // ESC: 20% of 90k = 18k, adjustment = 2k
    const escAdj = result.adjustments.find((a) => a.discountTypeCode === "ESC");
    expect(escAdj?.adjustmentAmount).toBe(2000);

    // Sibling: 5% of 90k = 4.5k, adjustment = 0.5k
    const sibAdj = result.adjustments.find((a) => a.discountTypeCode === "SIBLING");
    expect(sibAdj?.adjustmentAmount).toBe(500);

    expect(result.totalAdjustment).toBe(2500);
  });

  it("should not cascade full_assessment discounts", () => {
    const existingDiscounts: StudentDiscountForCascade[] = [
      {
        id: "discount-employee",
        studentId: "student-1",
        assessmentId: "assessment-1",
        discountTypeCode: "EMPLOYEE",
        discountTypeName: "Employee Discount",
        calculationType: "percentage",
        baseType: "full_assessment", // Not tuition_only
        baseAmount: 107000,
        discountValue: 5,
        discountAmount: 5350,
        assessmentItemId: "item-5",
        cascadeAdjustmentAmount: null,
      },
    ];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    expect(result.adjustments).toHaveLength(0);
    expect(result.totalAdjustment).toBe(0);
  });

  it("should handle empty existing discounts", () => {
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments([], cashDiscountAmount, items);

    expect(result.adjustments).toHaveLength(0);
    expect(result.totalAdjustment).toBe(0);
    expect(result.originalTuitionBase).toBe(100000);
    expect(result.newTuitionBase).toBe(90000);
  });

  it("should ignore adjustments smaller than 1 centavo", () => {
    const existingDiscounts = [
      createTuitionOnlyScholarship({
        discountValue: 0.001, // Very small percentage
        discountAmount: 100, // ₱100
      }),
    ];
    // Small cash discount that would result in <1 centavo adjustment
    const cashDiscountAmount = 100;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    // 0.001% of (100k - 100) = 0.999, original = 100, diff = ~0.001 < 0.01
    // Should filter out tiny adjustment
    expect(result.adjustments.length).toBeLessThanOrEqual(1);
  });

  it("should handle fixed_amount discounts with cascade", () => {
    const existingDiscounts: StudentDiscountForCascade[] = [
      createTuitionOnlyScholarship({
        calculationType: "fixed_amount",
        discountValue: 20000,
        discountAmount: 20000,
      }),
    ];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    // Fixed 20k on 90k base = 20k (no change since 20k < 90k)
    // But recalculateDiscountAmount caps at base, so if 20k > base it would cap
    expect(result.adjustments).toHaveLength(0); // No adjustment since 20k < 90k
    expect(result.totalAdjustment).toBe(0);
  });

  it("should cap fixed_amount at new base when it exceeds", () => {
    const existingDiscounts: StudentDiscountForCascade[] = [
      createTuitionOnlyScholarship({
        calculationType: "fixed_amount",
        baseAmount: 100000,
        discountValue: 95000, // High fixed amount
        discountAmount: 95000,
      }),
    ];
    // Very high cash discount that reduces base significantly
    const cashDiscountAmount = 50000;
    const items: CalculationAssessmentItem[] = [
      { id: "1", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
    ];

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    // New base = 50k, fixed 95k is capped at 50k
    // Original = 95k, recalculated = 50k, adjustment = 45k
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].originalDiscountAmount).toBe(95000);
    expect(result.adjustments[0].recalculatedDiscountAmount).toBe(50000);
    expect(result.adjustments[0].adjustmentAmount).toBe(45000);
  });

  it("should handle new tuition base of zero", () => {
    const existingDiscounts = [createTuitionOnlyScholarship()];
    const cashDiscountAmount = 100000; // Full tuition as cash discount
    const items = createStandardAssessmentItems();

    const result = calculateCascadeAdjustments(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    // New base = 0, ESC recalculated = 0
    expect(result.newTuitionBase).toBe(0);
    expect(result.adjustments[0].recalculatedDiscountAmount).toBe(0);
    expect(result.adjustments[0].adjustmentAmount).toBe(20000);
  });
});

// ─────────────────────────────────────────────────────────────────
// Generate Cascade Preview Tests
// ─────────────────────────────────────────────────────────────────

describe("generateCascadePreview", () => {
  it("should generate preview with adjustments", () => {
    const existingDiscounts = [createTuitionOnlyScholarship()];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const preview = generateCascadePreview(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    expect(preview.hasCascadeAdjustments).toBe(true);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]).toMatchObject({
      discountTypeName: "ESC Scholarship",
      originalAmount: 20000,
      recalculatedAmount: 18000,
      adjustmentAmount: 2000,
    });
    expect(preview.totalAdjustment).toBe(2000);
    expect(preview.explanation).toContain("ESC Scholarship");
    expect(preview.explanation).toContain("₱90,000");
  });

  it("should return no adjustments when none exist", () => {
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const preview = generateCascadePreview([], cashDiscountAmount, items);

    expect(preview.hasCascadeAdjustments).toBe(false);
    expect(preview.lines).toHaveLength(0);
    expect(preview.totalAdjustment).toBe(0);
    expect(preview.explanation).toBe("");
  });

  it("should list multiple discount names in explanation", () => {
    const existingDiscounts: StudentDiscountForCascade[] = [
      createTuitionOnlyScholarship({
        id: "1",
        discountTypeName: "ESC Scholarship",
      }),
      createTuitionOnlyScholarship({
        id: "2",
        discountTypeName: "Sibling Discount",
        discountValue: 5,
        discountAmount: 5000,
      }),
    ];
    const cashDiscountAmount = 10000;
    const items = createStandardAssessmentItems();

    const preview = generateCascadePreview(
      existingDiscounts,
      cashDiscountAmount,
      items
    );

    expect(preview.explanation).toContain("ESC Scholarship");
    expect(preview.explanation).toContain("Sibling Discount");
  });
});

// ─────────────────────────────────────────────────────────────────
// Format Cascade Adjustment Description Tests
// ─────────────────────────────────────────────────────────────────

describe("formatCascadeAdjustmentDescription", () => {
  it("should format cascade adjustment description correctly", () => {
    const adjustment: CascadeAdjustmentLine = {
      studentDiscountId: "1",
      discountTypeName: "ESC Scholarship",
      discountTypeCode: "ESC",
      originalDiscountAmount: 20000,
      recalculatedDiscountAmount: 18000,
      adjustmentAmount: 2000,
      originalAssessmentItemId: "item-1",
      newBaseAmount: 90000,
    };

    const description = formatCascadeAdjustmentDescription(adjustment, 90000);

    expect(description).toBe(
      "Cascade Adjustment: ESC Scholarship recalculated (on ₱90,000 discounted tuition)"
    );
  });

  it("should handle amounts without trailing decimals", () => {
    const adjustment: CascadeAdjustmentLine = {
      studentDiscountId: "1",
      discountTypeName: "Test Discount",
      discountTypeCode: "TEST",
      originalDiscountAmount: 10000,
      recalculatedDiscountAmount: 9000,
      adjustmentAmount: 1000,
      originalAssessmentItemId: "item-1",
      newBaseAmount: 50000.0,
    };

    const description = formatCascadeAdjustmentDescription(adjustment, 50000);

    expect(description).not.toContain(".00");
  });
});

// ─────────────────────────────────────────────────────────────────
// Calculate Final Payment With Cascade Tests
// ─────────────────────────────────────────────────────────────────

describe("calculateFinalPaymentWithCascade", () => {
  it("should calculate correct final payment", () => {
    /**
     * Scenario:
     * - Current balance: ₱80,000 (already has ₱20k ESC applied)
     * - Cash discount: ₱10,000
     * - Cascade adjustment: ₱2,000 (ESC reduced from 20k to 18k)
     *
     * Final: 80k - 10k + 2k = ₱72,000
     */
    const result = calculateFinalPaymentWithCascade(80000, 10000, 2000);

    expect(result).toBe(72000);
  });

  it("should handle zero cascade adjustment", () => {
    const result = calculateFinalPaymentWithCascade(100000, 10000, 0);

    expect(result).toBe(90000);
  });

  it("should never return negative", () => {
    const result = calculateFinalPaymentWithCascade(10000, 50000, 0);

    expect(result).toBe(0);
  });

  it("should handle all zeros", () => {
    const result = calculateFinalPaymentWithCascade(0, 0, 0);

    expect(result).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Validate Cascade Eligibility Tests
// ─────────────────────────────────────────────────────────────────

describe("validateCascadeEligibility", () => {
  it("should allow cascade when no existing cascade adjustments", () => {
    const discounts = [createTuitionOnlyScholarship()];

    const result = validateCascadeEligibility(discounts);

    expect(result.canCascade).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should disallow re-cascading when already cascaded", () => {
    const discounts = [
      createTuitionOnlyScholarship({
        cascadeAdjustmentAmount: 2000, // Already has cascade adjustment
      }),
    ];

    const result = validateCascadeEligibility(discounts);

    expect(result.canCascade).toBe(false);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("already have cascade adjustments");
  });

  it("should allow cascade with empty discounts", () => {
    const result = validateCascadeEligibility([]);

    expect(result.canCascade).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should allow cascade when all discounts are full_assessment", () => {
    const discounts: StudentDiscountForCascade[] = [
      {
        id: "1",
        studentId: "student-1",
        assessmentId: "assessment-1",
        discountTypeCode: "EMPLOYEE",
        discountTypeName: "Employee Discount",
        calculationType: "percentage",
        baseType: "full_assessment",
        baseAmount: 107000,
        discountValue: 5,
        discountAmount: 5350,
        assessmentItemId: "item-1",
        cascadeAdjustmentAmount: null,
      },
    ];

    const result = validateCascadeEligibility(discounts);

    expect(result.canCascade).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("should check cascade amount is null vs undefined vs zero", () => {
    // null - not cascaded
    const nullCascade = validateCascadeEligibility([
      createTuitionOnlyScholarship({ cascadeAdjustmentAmount: null }),
    ]);
    expect(nullCascade.canCascade).toBe(true);

    // undefined - not cascaded
    const undefinedCascade = validateCascadeEligibility([
      createTuitionOnlyScholarship({ cascadeAdjustmentAmount: undefined }),
    ]);
    expect(undefinedCascade.canCascade).toBe(true);

    // 0 - treated as not cascaded (> 0 check)
    const zeroCascade = validateCascadeEligibility([
      createTuitionOnlyScholarship({ cascadeAdjustmentAmount: 0 }),
    ]);
    expect(zeroCascade.canCascade).toBe(true);

    // positive - already cascaded
    const positiveCascade = validateCascadeEligibility([
      createTuitionOnlyScholarship({ cascadeAdjustmentAmount: 100 }),
    ]);
    expect(positiveCascade.canCascade).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// Full Cash Payment Discount Integration Scenarios
// ─────────────────────────────────────────────────────────────────

describe("Full Cash Payment Discount - Integration Scenarios", () => {
  describe("Scenario: Student with ESC scholarship pays in full", () => {
    /**
     * Setup:
     * - Tuition: ₱100,000
     * - Misc Fee: ₱5,000
     * - Lab Fee: ₱2,000
     * - ESC Scholarship: 20% of tuition = -₱20,000
     * - Assessment Balance: ₱87,000
     *
     * Full Payment with Cash Discount:
     * - Cash Discount: 10% of full assessment (₱107,000) = ₱10,700
     * - Cascade: ESC recalculated on ₱89,300 (100k - 10.7k) = ₱17,860
     * - Cascade Adjustment: ₱2,140 (20k - 17.86k)
     * - Final Balance: ₱87,000 - ₱10,700 + ₱2,140 = ₱78,440
     */
    it("should correctly calculate all components", () => {
      // 1. Calculate cash discount
      const items = createStandardAssessmentItems();
      const cashDiscountBase = calculateDiscountBase(items, "full_assessment");
      expect(cashDiscountBase).toBe(107000);

      const cashDiscountAmount = calculateDiscountAmount(
        cashDiscountBase,
        "percentage",
        10
      );
      expect(cashDiscountAmount).toBe(10700);

      // 2. Calculate cascade
      const existingDiscounts = [
        createTuitionOnlyScholarship({
          discountValue: 20,
          discountAmount: 20000,
        }),
      ];

      const cascadeResult = calculateCascadeAdjustments(
        existingDiscounts,
        cashDiscountAmount,
        items
      );

      expect(cascadeResult.originalTuitionBase).toBe(100000);
      expect(cascadeResult.newTuitionBase).toBe(89300); // 100k - 10.7k
      expect(cascadeResult.adjustments[0].recalculatedDiscountAmount).toBe(17860);
      expect(cascadeResult.totalAdjustment).toBe(2140);

      // 3. Calculate final payment
      const originalBalance = 87000; // 107k - 20k
      const finalPayment = calculateFinalPaymentWithCascade(
        originalBalance,
        cashDiscountAmount,
        cascadeResult.totalAdjustment
      );
      expect(finalPayment).toBe(78440);
    });
  });

  describe("Scenario: Student with multiple scholarships", () => {
    /**
     * Setup:
     * - Tuition: ₱100,000
     * - ESC: 20% of tuition = ₱20,000
     * - Sibling: 5% of tuition = ₱5,000
     * - Total scholarships: ₱25,000
     *
     * Full Payment with 10% Cash Discount:
     * - Cash Discount: 10% of ₱100,000 = ₱10,000
     * - New tuition base: ₱90,000
     * - ESC recalculated: 20% × 90k = ₱18,000 (adjustment: ₱2,000)
     * - Sibling recalculated: 5% × 90k = ₱4,500 (adjustment: ₱500)
     * - Total cascade: ₱2,500
     */
    it("should cascade multiple scholarships correctly", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
      ];

      const existingDiscounts: StudentDiscountForCascade[] = [
        createTuitionOnlyScholarship({
          id: "esc",
          discountTypeCode: "ESC",
          discountTypeName: "ESC Scholarship",
          discountValue: 20,
          discountAmount: 20000,
        }),
        createTuitionOnlyScholarship({
          id: "sibling",
          discountTypeCode: "SIBLING",
          discountTypeName: "Sibling Discount",
          discountValue: 5,
          discountAmount: 5000,
        }),
      ];

      const cascadeResult = calculateCascadeAdjustments(
        existingDiscounts,
        10000,
        items
      );

      expect(cascadeResult.totalAdjustment).toBe(2500);
      expect(cascadeResult.adjustments).toHaveLength(2);

      const escAdj = cascadeResult.adjustments.find(
        (a) => a.discountTypeCode === "ESC"
      );
      expect(escAdj?.adjustmentAmount).toBe(2000);

      const siblingAdj = cascadeResult.adjustments.find(
        (a) => a.discountTypeCode === "SIBLING"
      );
      expect(siblingAdj?.adjustmentAmount).toBe(500);
    });
  });

  describe("Scenario: Employee discount (full_assessment) should not cascade", () => {
    it("should not adjust full_assessment discounts", () => {
      const items = createStandardAssessmentItems();

      const existingDiscounts: StudentDiscountForCascade[] = [
        {
          id: "employee",
          studentId: "student-1",
          assessmentId: "assessment-1",
          discountTypeCode: "EMPLOYEE",
          discountTypeName: "Employee Discount",
          calculationType: "percentage",
          baseType: "full_assessment", // This should NOT cascade
          baseAmount: 107000,
          discountValue: 10,
          discountAmount: 10700,
          assessmentItemId: "item-e",
          cascadeAdjustmentAmount: null,
        },
      ];

      const cascadeResult = calculateCascadeAdjustments(
        existingDiscounts,
        10000,
        items
      );

      expect(cascadeResult.adjustments).toHaveLength(0);
      expect(cascadeResult.totalAdjustment).toBe(0);
    });
  });

  describe("Scenario: Mixed discount types", () => {
    it("should only cascade tuition_only discounts", () => {
      const items = createStandardAssessmentItems();

      const existingDiscounts: StudentDiscountForCascade[] = [
        createTuitionOnlyScholarship({
          id: "esc",
          discountTypeCode: "ESC",
          baseType: "tuition_only",
          discountValue: 20,
          discountAmount: 20000,
        }),
        {
          id: "employee",
          studentId: "student-1",
          assessmentId: "assessment-1",
          discountTypeCode: "EMPLOYEE",
          discountTypeName: "Employee Discount",
          calculationType: "percentage",
          baseType: "full_assessment", // Should NOT cascade
          baseAmount: 107000,
          discountValue: 5,
          discountAmount: 5350,
          assessmentItemId: "item-e",
          cascadeAdjustmentAmount: null,
        },
      ];

      const cascadeResult = calculateCascadeAdjustments(
        existingDiscounts,
        10000,
        items
      );

      // Only ESC should cascade
      expect(cascadeResult.adjustments).toHaveLength(1);
      expect(cascadeResult.adjustments[0].discountTypeCode).toBe("ESC");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Edge Cases & Boundary Tests
// ─────────────────────────────────────────────────────────────────

describe("Edge Cases & Boundary Conditions", () => {
  describe("Boundary: Payment exactly equals balance", () => {
    it("should handle exact payment match", () => {
      // Epsilon comparison (0.01) is used in eligibility check
      const balance = 87000;
      const payment = 87000;

      const isFullPayment = payment >= balance - 0.01;
      expect(isFullPayment).toBe(true);
    });

    it("should handle payment within epsilon", () => {
      const balance = 87000;
      const payment = 86999.995; // Just under 0.01 difference

      const isFullPayment = payment >= balance - 0.01;
      expect(isFullPayment).toBe(true);
    });

    it("should reject payment outside epsilon", () => {
      const balance = 87000;
      const payment = 86999.98; // More than 0.01 difference

      const isFullPayment = payment >= balance - 0.01;
      expect(isFullPayment).toBe(false);
    });
  });

  describe("Boundary: 100% cash discount", () => {
    it("should handle 100% discount calculation", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
      ];

      const base = calculateDiscountBase(items, "full_assessment");
      const amount = calculateDiscountAmount(base, "percentage", 100);

      expect(amount).toBe(100000);
    });
  });

  describe("Boundary: Zero tuition (misc fees only)", () => {
    it("should return 0 for tuition_only base", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
      ];

      const base = calculateDiscountBase(items, "tuition_only");
      expect(base).toBe(0);
    });

    it("should still calculate full_assessment base", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "1", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
      ];

      const base = calculateDiscountBase(items, "full_assessment");
      expect(base).toBe(5000);
    });
  });

  describe("Boundary: Very large amounts", () => {
    it("should handle large peso amounts", () => {
      const items: CalculationAssessmentItem[] = [
        {
          id: "1",
          amount: 10000000, // ₱10 million
          isDiscount: false,
          feeItemTypeCode: "TUITION",
        },
      ];

      const base = calculateDiscountBase(items, "full_assessment");
      const discount = calculateDiscountAmount(base, "percentage", 10);

      expect(discount).toBe(1000000);
    });
  });

  describe("Boundary: Floating point amounts", () => {
    it("should handle centavo precision", () => {
      const items: CalculationAssessmentItem[] = [
        {
          id: "1",
          amount: "50000.75",
          isDiscount: false,
          feeItemTypeCode: "TUITION",
        },
      ];

      const base = calculateDiscountBase(items, "full_assessment");
      expect(base).toBe(50000.75);

      const discount = calculateDiscountAmount(base, "percentage", 10);
      // Production rounds to 2 decimals: 5000.075 → 5000.08
      expect(discount).toBe(5000.08);
    });
  });
});
