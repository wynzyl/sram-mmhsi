/**
 * Integration Tests: Full Cash Payment Discount + Assessment + Payments
 *
 * Tests the complete integration flow between:
 * - Assessment balance calculations
 * - Payment posting with discount application
 * - Cascade adjustments for tuition scholarships
 * - Balance updates and billing status transitions
 *
 * These tests verify the business logic integration WITHOUT database access,
 * using the actual calculation functions with realistic fixture data.
 */

import { describe, expect, it } from "vitest";
import {
  calculateDiscountBase,
  calculateDiscountAmount,
  calculateTotalDiscounts,
  sumDiscountLines,
  type CalculationAssessmentItem,
  type ApprovedDiscountRequest,
  type DiscountLine,
} from "@/features/discounts/utils/discount-calculations";
import {
  calculateCascadeAdjustments,
  generateCascadePreview,
  calculateFinalPaymentWithCascade,
  validateCascadeEligibility,
  type StudentDiscountForCascade,
} from "@/features/discounts/utils/cascade-calculations";
import { PostPaymentSchema } from "../payments.schema";
import type {
  CashDiscountEligibility,
  CascadeAdjustmentPreview,
} from "../payments.types";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures: Realistic SRAMS Assessment Data
// ─────────────────────────────────────────────────────────────────────────────

/** Standard K-12 assessment with tuition and fees */
const createStandardAssessment = (): {
  items: CalculationAssessmentItem[];
  totals: { tuition: number; otherFees: number; total: number };
} => {
  const items: CalculationAssessmentItem[] = [
    { id: "item-tuition", amount: 50000, isDiscount: false, feeItemTypeCode: "TUITION" },
    { id: "item-misc", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
    { id: "item-lab", amount: 3000, isDiscount: false, feeItemTypeCode: "LAB_FEE" },
    { id: "item-books", amount: 2000, isDiscount: false, feeItemTypeCode: "BOOKS" },
  ];
  return {
    items,
    totals: { tuition: 50000, otherFees: 10000, total: 60000 },
  };
};

/** SHS assessment with higher tuition */
const createSHSAssessment = (): {
  items: CalculationAssessmentItem[];
  totals: { tuition: number; otherFees: number; total: number };
} => {
  const items: CalculationAssessmentItem[] = [
    { id: "item-tuition", amount: 80000, isDiscount: false, feeItemTypeCode: "TUITION" },
    { id: "item-misc", amount: 8000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
    { id: "item-lab", amount: 5000, isDiscount: false, feeItemTypeCode: "LAB_FEE" },
    { id: "item-books", amount: 4000, isDiscount: false, feeItemTypeCode: "BOOKS" },
    { id: "item-tech", amount: 3000, isDiscount: false, feeItemTypeCode: "TECH_FEE" },
  ];
  return {
    items,
    totals: { tuition: 80000, otherFees: 20000, total: 100000 },
  };
};

/** Assessment with existing ESC scholarship (20% tuition) */
const createAssessmentWithESCScholarship = (): {
  items: CalculationAssessmentItem[];
  discounts: StudentDiscountForCascade[];
  totals: {
    tuition: number;
    otherFees: number;
    escDiscount: number;
    netTotal: number;
  };
} => {
  const items: CalculationAssessmentItem[] = [
    { id: "item-tuition", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
    { id: "item-misc", amount: 7000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
    // Existing ESC discount applied
    { id: "item-esc", amount: -20000, isDiscount: true, feeItemTypeCode: null },
  ];

  const discounts: StudentDiscountForCascade[] = [
    {
      id: "discount-esc",
      studentId: "student-1",
      assessmentId: "assessment-1",
      discountTypeCode: "ESC_SCHOLARSHIP",
      discountTypeName: "ESC Scholarship",
      calculationType: "percentage",
      baseType: "tuition_only",
      baseAmount: 100000,
      discountValue: 20,
      discountAmount: 20000,
      assessmentItemId: "item-esc",
    },
  ];

  return {
    items,
    discounts,
    totals: {
      tuition: 100000,
      otherFees: 7000,
      escDiscount: 20000,
      netTotal: 87000, // 100k + 7k - 20k
    },
  };
};

/** Assessment with multiple tuition discounts */
const createAssessmentWithMultipleDiscounts = (): {
  items: CalculationAssessmentItem[];
  discounts: StudentDiscountForCascade[];
  totals: {
    tuition: number;
    otherFees: number;
    totalDiscounts: number;
    netTotal: number;
  };
} => {
  const items: CalculationAssessmentItem[] = [
    { id: "item-tuition", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
    { id: "item-misc", amount: 7000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
    // ESC: 20% of tuition = 20k
    { id: "item-esc", amount: -20000, isDiscount: true, feeItemTypeCode: null },
    // Sibling: 10% of tuition = 10k
    { id: "item-sibling", amount: -10000, isDiscount: true, feeItemTypeCode: null },
  ];

  const discounts: StudentDiscountForCascade[] = [
    {
      id: "discount-esc",
      studentId: "student-1",
      assessmentId: "assessment-1",
      discountTypeCode: "ESC_SCHOLARSHIP",
      discountTypeName: "ESC Scholarship",
      calculationType: "percentage",
      baseType: "tuition_only",
      baseAmount: 100000,
      discountValue: 20,
      discountAmount: 20000,
      assessmentItemId: "item-esc",
    },
    {
      id: "discount-sibling",
      studentId: "student-1",
      assessmentId: "assessment-1",
      discountTypeCode: "SIBLING_DISCOUNT",
      discountTypeName: "Sibling Discount",
      calculationType: "percentage",
      baseType: "tuition_only",
      baseAmount: 100000,
      discountValue: 10,
      discountAmount: 10000,
      assessmentItemId: "item-sibling",
    },
  ];

  return {
    items,
    discounts,
    totals: {
      tuition: 100000,
      otherFees: 7000,
      totalDiscounts: 30000,
      netTotal: 77000, // 100k + 7k - 30k
    },
  };
};

/** Full payment cash discount configuration */
const createCashDiscountConfig = (): ApprovedDiscountRequest => ({
  id: "request-cash",
  discountTypeId: "type-cash",
  overrideValue: null,
  discountType: {
    code: "FULL_PAYMENT_DISCOUNT",
    name: "Full Payment Cash Discount",
    calculationType: "percentage",
    baseType: "tuition_only",
    defaultValue: 10, // 10% discount
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Test: Assessment Creation & Discount Application
// ─────────────────────────────────────────────────────────────────────────────

describe("Assessment + Discount Integration", () => {
  describe("Assessment Base Calculations", () => {
    it("calculates tuition_only base correctly for standard assessment", () => {
      const { items, totals } = createStandardAssessment();

      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      const fullBase = calculateDiscountBase(items, "full_assessment");

      expect(tuitionBase).toBe(totals.tuition);
      expect(fullBase).toBe(totals.total);
    });

    it("calculates tuition_only base correctly for SHS assessment", () => {
      const { items, totals } = createSHSAssessment();

      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      const fullBase = calculateDiscountBase(items, "full_assessment");

      expect(tuitionBase).toBe(totals.tuition);
      expect(fullBase).toBe(totals.total);
    });

    it("excludes existing discounts from base calculation", () => {
      const { items, totals } = createAssessmentWithESCScholarship();

      // Tuition base should still be 100k (ignores the -20k discount item)
      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      expect(tuitionBase).toBe(totals.tuition);

      // Full assessment base = 107k (excludes discount items)
      const fullBase = calculateDiscountBase(items, "full_assessment");
      expect(fullBase).toBe(totals.tuition + totals.otherFees);
    });
  });

  describe("Discount Amount Calculations", () => {
    it("calculates percentage discount on tuition base", () => {
      const { items } = createStandardAssessment();
      const cashDiscount = createCashDiscountConfig();

      const base = calculateDiscountBase(items, cashDiscount.discountType.baseType);
      const discountAmount = calculateDiscountAmount(
        base,
        cashDiscount.discountType.calculationType,
        Number(cashDiscount.discountType.defaultValue)
      );

      // 10% of 50,000 tuition = 5,000
      expect(discountAmount).toBe(5000);
    });

    it("calculates percentage discount on full assessment base", () => {
      const { items, totals } = createStandardAssessment();

      const fullBase = calculateDiscountBase(items, "full_assessment");
      const discountAmount = calculateDiscountAmount(fullBase, "percentage", 5);

      // 5% of 60,000 = 3,000
      expect(discountAmount).toBe(totals.total * 0.05);
    });

    it("caps percentage discount at 100% of base", () => {
      const { items } = createStandardAssessment();

      const base = calculateDiscountBase(items, "tuition_only");
      const discountAmount = calculateDiscountAmount(base, "percentage", 150);

      // Cannot exceed base amount
      expect(discountAmount).toBe(50000);
    });

    it("caps fixed amount discount at base amount", () => {
      const { items } = createStandardAssessment();

      const base = calculateDiscountBase(items, "tuition_only");
      const discountAmount = calculateDiscountAmount(base, "fixed_amount", 999999);

      expect(discountAmount).toBe(50000);
    });
  });

  describe("Multiple Discount Application", () => {
    it("calculates multiple discounts independently (additive model)", () => {
      const { items } = createSHSAssessment();

      const requests: ApprovedDiscountRequest[] = [
        {
          id: "req-esc",
          discountTypeId: "type-esc",
          overrideValue: null,
          discountType: {
            code: "ESC_SCHOLARSHIP",
            name: "ESC Scholarship",
            calculationType: "percentage",
            baseType: "tuition_only",
            defaultValue: 20,
          },
        },
        {
          id: "req-employee",
          discountTypeId: "type-employee",
          overrideValue: null,
          discountType: {
            code: "EMPLOYEE_DISCOUNT",
            name: "Employee Discount",
            calculationType: "percentage",
            baseType: "full_assessment",
            defaultValue: 5,
          },
        },
      ];

      const discountLines = calculateTotalDiscounts(items, requests);
      const totalDiscount = sumDiscountLines(discountLines);

      // ESC: 20% of 80k tuition = 16k
      // Employee: 5% of 100k total = 5k
      expect(discountLines[0].discountAmount).toBe(16000);
      expect(discountLines[1].discountAmount).toBe(5000);
      expect(totalDiscount).toBe(21000);
    });

    it("applies override values when provided", () => {
      const { items } = createStandardAssessment();

      const requests: ApprovedDiscountRequest[] = [
        {
          id: "req-special",
          discountTypeId: "type-special",
          overrideValue: 15, // Override from default 10%
          discountType: {
            code: "SPECIAL_DISCOUNT",
            name: "Special Discount",
            calculationType: "percentage",
            baseType: "tuition_only",
            defaultValue: 10,
          },
        },
      ];

      const discountLines = calculateTotalDiscounts(items, requests);

      // 15% of 50k = 7,500 (not default 10% = 5,000)
      expect(discountLines[0].discountAmount).toBe(7500);
      expect(discountLines[0].discountValue).toBe(15);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Test: Cash Discount + Cascade Adjustments
// ─────────────────────────────────────────────────────────────────────────────

describe("Cash Discount + Cascade Integration", () => {
  describe("Cascade Adjustment Calculation", () => {
    it("recalculates ESC scholarship when cash discount applied", () => {
      const { items, discounts, totals } = createAssessmentWithESCScholarship();
      const cashDiscount = createCashDiscountConfig();

      // Cash discount: 10% of 100k tuition = 10k
      const cashDiscountAmount = calculateDiscountAmount(
        totals.tuition,
        cashDiscount.discountType.calculationType,
        Number(cashDiscount.discountType.defaultValue)
      );
      expect(cashDiscountAmount).toBe(10000);

      // Calculate cascade adjustments
      const cascadeResult = calculateCascadeAdjustments(
        discounts,
        cashDiscountAmount,
        items
      );

      // ESC was 20% of 100k = 20k
      // After cascade: 20% of 90k = 18k
      // Adjustment: 20k - 18k = 2k
      expect(cascadeResult.originalTuitionBase).toBe(100000);
      expect(cascadeResult.newTuitionBase).toBe(90000);
      expect(cascadeResult.adjustments).toHaveLength(1);
      expect(cascadeResult.adjustments[0].originalDiscountAmount).toBe(20000);
      expect(cascadeResult.adjustments[0].recalculatedDiscountAmount).toBe(18000);
      expect(cascadeResult.adjustments[0].adjustmentAmount).toBe(2000);
      expect(cascadeResult.totalAdjustment).toBe(2000);
    });

    it("recalculates multiple tuition discounts correctly", () => {
      const { items, discounts, totals } = createAssessmentWithMultipleDiscounts();

      // Cash discount: 10% of 100k = 10k
      const cashDiscountAmount = 10000;

      const cascadeResult = calculateCascadeAdjustments(
        discounts,
        cashDiscountAmount,
        items
      );

      // New tuition base: 90k
      // ESC: 20% of 90k = 18k (was 20k, adj = 2k)
      // Sibling: 10% of 90k = 9k (was 10k, adj = 1k)
      expect(cascadeResult.newTuitionBase).toBe(90000);
      expect(cascadeResult.adjustments).toHaveLength(2);

      const escAdj = cascadeResult.adjustments.find(
        (a) => a.discountTypeCode === "ESC_SCHOLARSHIP"
      );
      const siblingAdj = cascadeResult.adjustments.find(
        (a) => a.discountTypeCode === "SIBLING_DISCOUNT"
      );

      expect(escAdj?.adjustmentAmount).toBe(2000);
      expect(siblingAdj?.adjustmentAmount).toBe(1000);
      expect(cascadeResult.totalAdjustment).toBe(3000);
    });

    it("does not cascade full_assessment discounts", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "item-tuition", amount: 100000, isDiscount: false, feeItemTypeCode: "TUITION" },
        { id: "item-misc", amount: 7000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
        { id: "item-emp", amount: -5350, isDiscount: true, feeItemTypeCode: null },
      ];

      // Employee discount on full_assessment should NOT cascade
      const discounts: StudentDiscountForCascade[] = [
        {
          id: "discount-emp",
          studentId: "student-1",
          assessmentId: "assessment-1",
          discountTypeCode: "EMPLOYEE_DISCOUNT",
          discountTypeName: "Employee Discount",
          calculationType: "percentage",
          baseType: "full_assessment", // NOT tuition_only
          baseAmount: 107000,
          discountValue: 5,
          discountAmount: 5350,
          assessmentItemId: "item-emp",
        },
      ];

      const cascadeResult = calculateCascadeAdjustments(discounts, 10000, items);

      expect(cascadeResult.adjustments).toHaveLength(0);
      expect(cascadeResult.totalAdjustment).toBe(0);
    });
  });

  describe("Final Payment Calculation with Cascade", () => {
    it("calculates correct payment amount after cascade", () => {
      const { totals } = createAssessmentWithESCScholarship();
      const currentBalance = totals.netTotal; // 87,000
      const cashDiscountAmount = 10000;
      const cascadeAdjustment = 2000; // ESC recalculated

      const finalPayment = calculateFinalPaymentWithCascade(
        currentBalance,
        cashDiscountAmount,
        cascadeAdjustment
      );

      // 87,000 - 10,000 (cash) + 2,000 (cascade) = 79,000
      expect(finalPayment).toBe(79000);
    });

    it("calculates correct payment for multiple cascades", () => {
      const { totals } = createAssessmentWithMultipleDiscounts();
      const currentBalance = totals.netTotal; // 77,000
      const cashDiscountAmount = 10000;
      const cascadeAdjustment = 3000; // ESC + Sibling recalculated

      const finalPayment = calculateFinalPaymentWithCascade(
        currentBalance,
        cashDiscountAmount,
        cascadeAdjustment
      );

      // 77,000 - 10,000 (cash) + 3,000 (cascade) = 70,000
      expect(finalPayment).toBe(70000);
    });

    it("never returns negative payment amount", () => {
      const finalPayment = calculateFinalPaymentWithCascade(
        5000, // Small balance
        10000, // Large discount
        0
      );

      expect(finalPayment).toBe(0);
    });
  });

  describe("Cascade Preview Generation", () => {
    it("generates preview for UI display", () => {
      const { items, discounts } = createAssessmentWithESCScholarship();
      const cashDiscountAmount = 10000;

      const preview = generateCascadePreview(discounts, cashDiscountAmount, items);

      expect(preview.hasCascadeAdjustments).toBe(true);
      expect(preview.lines).toHaveLength(1);
      expect(preview.lines[0].discountTypeName).toBe("ESC Scholarship");
      expect(preview.lines[0].originalAmount).toBe(20000);
      expect(preview.lines[0].recalculatedAmount).toBe(18000);
      expect(preview.lines[0].adjustmentAmount).toBe(2000);
      expect(preview.totalAdjustment).toBe(2000);
      expect(preview.explanation).toContain("ESC Scholarship");
      expect(preview.explanation).toContain("₱90,000");
    });

    it("returns empty preview when no cascadable discounts", () => {
      const { items } = createStandardAssessment();
      const cashDiscountAmount = 5000;

      // No existing discounts
      const preview = generateCascadePreview([], cashDiscountAmount, items);

      expect(preview.hasCascadeAdjustments).toBe(false);
      expect(preview.lines).toHaveLength(0);
      expect(preview.totalAdjustment).toBe(0);
    });
  });

  describe("Cascade Eligibility Validation", () => {
    it("allows cascading for fresh discounts", () => {
      const { discounts } = createAssessmentWithESCScholarship();

      const result = validateCascadeEligibility(discounts);

      expect(result.canCascade).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("prevents re-cascading already cascaded discounts", () => {
      const discounts: StudentDiscountForCascade[] = [
        {
          id: "discount-esc",
          studentId: "student-1",
          assessmentId: "assessment-1",
          discountTypeCode: "ESC_SCHOLARSHIP",
          discountTypeName: "ESC Scholarship",
          calculationType: "percentage",
          baseType: "tuition_only",
          baseAmount: 100000,
          discountValue: 20,
          discountAmount: 20000,
          assessmentItemId: "item-esc",
          cascadeAdjustmentAmount: 2000, // Already cascaded!
        },
      ];

      const result = validateCascadeEligibility(discounts);

      expect(result.canCascade).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain("already have cascade adjustments");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Test: Payment Schema Validation
// ─────────────────────────────────────────────────────────────────────────────

describe("Payment Schema Integration", () => {
  describe("Basic Payment Validation", () => {
    it("validates a valid cash payment", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        applyCashDiscount: false,
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("validates a valid GCash payment with reference", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "gcash",
        referenceNumber: "GCASH-12345678",
        applyCashDiscount: false,
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires reference number for GCash payments", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "gcash",
        // Missing referenceNumber
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const refError = result.error.issues.find(
          (i) => i.path.includes("referenceNumber")
        );
        expect(refError).toBeDefined();
      }
    });

    it("requires cash tendered for cash payments", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        // Missing amountTendered
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const tenderedError = result.error.issues.find(
          (i) => i.path.includes("amountTendered")
        );
        expect(tenderedError).toBeDefined();
      }
    });

    it("validates cash tendered is sufficient", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 4000, // Less than amount
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const tenderedError = result.error.issues.find(
          (i) => i.path.includes("amountTendered")
        );
        expect(tenderedError?.message).toContain("equal to or greater than");
      }
    });
  });

  describe("Manual Entry Validation", () => {
    it("validates a valid manual entry payment", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: true,
        manualPaymentDate: new Date("2026-06-01"),
        manualOrNumber: "AK 00050",
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("requires payment date for manual entries", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: true,
        // Missing manualPaymentDate
        manualOrNumber: "AK 00050",
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("requires OR number for manual entries", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: true,
        manualPaymentDate: new Date("2026-06-01"),
        // Missing manualOrNumber
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("validates OR number format", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: true,
        manualPaymentDate: new Date("2026-06-01"),
        manualOrNumber: "INVALID", // Wrong format
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const orError = result.error.issues.find(
          (i) => i.path.includes("manualOrNumber")
        );
        expect(orError?.message).toContain("XX 00000");
      }
    });

    it("rejects future payment dates for manual entries", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: true,
        manualPaymentDate: futureDate,
        manualOrNumber: "AK 00050",
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        const dateError = result.error.issues.find(
          (i) => i.path.includes("manualPaymentDate")
        );
        expect(dateError?.message).toContain("cannot be in the future");
      }
    });
  });

  describe("Cash Discount Flag Validation", () => {
    it("accepts payment with applyCashDiscount flag", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 79000, // Full payment after discount
        paymentMethod: "cash",
        amountTendered: 79000,
        applyCashDiscount: true,
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(true);
      }
    });

    it("defaults applyCashDiscount to false", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        // No applyCashDiscount provided
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.applyCashDiscount).toBe(false);
      }
    });
  });

  describe("Idempotency Key Validation", () => {
    it("accepts valid UUID idempotency key", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        idempotencyKey: "550e8400-e29b-41d4-a716-446655440099",
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idempotencyKey).toBe("550e8400-e29b-41d4-a716-446655440099");
      }
    });

    it("rejects invalid idempotency key format", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        idempotencyKey: "not-a-uuid",
      };

      const result = PostPaymentSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration Test: Complete Payment Flow Simulation
// ─────────────────────────────────────────────────────────────────────────────

describe("Complete Payment Flow Integration", () => {
  describe("Regular Payment (No Discount)", () => {
    it("calculates correct balance after partial payment", () => {
      const { totals } = createStandardAssessment();
      const initialBalance = totals.total; // 60,000
      const paymentAmount = 20000;

      const newBalance = initialBalance - paymentAmount;

      expect(newBalance).toBe(40000);
    });

    it("settles assessment on full payment", () => {
      const { totals } = createStandardAssessment();
      const initialBalance = totals.total; // 60,000
      const paymentAmount = 60000;

      const newBalance = initialBalance - paymentAmount;
      const billingStatus = newBalance <= 0.01 ? "settled" : "outstanding";

      expect(newBalance).toBe(0);
      expect(billingStatus).toBe("settled");
    });
  });

  describe("Full Payment with Cash Discount", () => {
    it("applies discount and cascade correctly for ESC scholarship case", () => {
      const { items, discounts, totals } = createAssessmentWithESCScholarship();

      // Step 1: Calculate cash discount (10% of tuition)
      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      const cashDiscountAmount = calculateDiscountAmount(tuitionBase, "percentage", 10);
      expect(cashDiscountAmount).toBe(10000);

      // Step 2: Calculate cascade adjustments
      const cascadeResult = calculateCascadeAdjustments(
        discounts,
        cashDiscountAmount,
        items
      );
      expect(cascadeResult.totalAdjustment).toBe(2000);

      // Step 3: Calculate final payment amount
      const currentBalance = totals.netTotal; // 87,000
      const finalPayment = calculateFinalPaymentWithCascade(
        currentBalance,
        cashDiscountAmount,
        cascadeResult.totalAdjustment
      );

      // 87,000 - 10,000 (cash) + 2,000 (cascade) = 79,000
      expect(finalPayment).toBe(79000);
    });

    it("applies discount and cascade correctly for multiple scholarships", () => {
      const { items, discounts, totals } = createAssessmentWithMultipleDiscounts();

      // Step 1: Cash discount (10% of 100k tuition = 10k)
      const cashDiscountAmount = 10000;

      // Step 2: Cascade both ESC and Sibling
      const cascadeResult = calculateCascadeAdjustments(
        discounts,
        cashDiscountAmount,
        items
      );

      // ESC: 20k → 18k (adj = 2k)
      // Sibling: 10k → 9k (adj = 1k)
      // Total cascade = 3k
      expect(cascadeResult.totalAdjustment).toBe(3000);

      // Step 3: Final payment
      const currentBalance = totals.netTotal; // 77,000
      const finalPayment = calculateFinalPaymentWithCascade(
        currentBalance,
        cashDiscountAmount,
        cascadeResult.totalAdjustment
      );

      // 77,000 - 10,000 + 3,000 = 70,000
      expect(finalPayment).toBe(70000);
    });
  });

  describe("Assessment Balance Tracking", () => {
    it("tracks cumulative payments correctly", () => {
      const { totals } = createStandardAssessment();
      let balance = totals.total; // 60,000
      let totalPaid = 0;

      // Payment 1: 10,000
      totalPaid += 10000;
      balance -= 10000;
      expect(balance).toBe(50000);
      expect(totalPaid).toBe(10000);

      // Payment 2: 25,000
      totalPaid += 25000;
      balance -= 25000;
      expect(balance).toBe(25000);
      expect(totalPaid).toBe(35000);

      // Payment 3: 25,000 (final)
      totalPaid += 25000;
      balance -= 25000;
      expect(balance).toBe(0);
      expect(totalPaid).toBe(60000);
    });

    it("handles discount application mid-payment cycle", () => {
      const { items, discounts, totals } = createAssessmentWithESCScholarship();
      let balance = totals.netTotal; // 87,000 (after ESC)
      let totalAmount = totals.tuition + totals.otherFees - totals.escDiscount;
      let totalPaid = 0;

      // Partial payment: 20,000
      totalPaid += 20000;
      balance -= 20000;
      expect(balance).toBe(67000);

      // Now apply cash discount at full remaining payment
      const cashDiscountAmount = 10000;
      const cascadeResult = calculateCascadeAdjustments(
        discounts,
        cashDiscountAmount,
        items
      );

      // Apply discount: reduces totalAmount and balance
      totalAmount -= cashDiscountAmount;
      balance -= cashDiscountAmount;
      balance += cascadeResult.totalAdjustment;

      // After discount: 67k - 10k + 2k = 59k
      expect(balance).toBe(59000);

      // Final payment
      totalPaid += balance;
      balance -= balance;
      expect(balance).toBe(0);
      expect(totalPaid).toBe(79000); // 20k + 59k
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases & Error Scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe("Edge Cases & Error Scenarios", () => {
  describe("Zero and Negative Amounts", () => {
    it("handles zero tuition base gracefully", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "item-misc", amount: 5000, isDiscount: false, feeItemTypeCode: "MISC_FEE" },
      ];

      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      const discountAmount = calculateDiscountAmount(tuitionBase, "percentage", 10);

      expect(tuitionBase).toBe(0);
      expect(discountAmount).toBe(0);
    });

    it("returns zero discount for zero value", () => {
      const { items } = createStandardAssessment();

      const base = calculateDiscountBase(items, "tuition_only");
      const discountAmount = calculateDiscountAmount(base, "percentage", 0);

      expect(discountAmount).toBe(0);
    });

    it("handles all discount items (no charges)", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "item-disc1", amount: -5000, isDiscount: true, feeItemTypeCode: null },
        { id: "item-disc2", amount: -3000, isDiscount: true, feeItemTypeCode: null },
      ];

      const tuitionBase = calculateDiscountBase(items, "tuition_only");
      const fullBase = calculateDiscountBase(items, "full_assessment");

      expect(tuitionBase).toBe(0);
      expect(fullBase).toBe(0);
    });
  });

  describe("Precision Edge Cases", () => {
    it("rounds monetary values to 2 decimal places", () => {
      // 10% of 33.33 = 3.333 → should round to 3.33
      const discountAmount = calculateDiscountAmount(33.33, "percentage", 10);
      expect(discountAmount).toBe(3.33);
    });

    it("handles very large assessment amounts", () => {
      const items: CalculationAssessmentItem[] = [
        { id: "item-tuition", amount: 1000000, isDiscount: false, feeItemTypeCode: "TUITION" },
      ];

      const base = calculateDiscountBase(items, "tuition_only");
      const discountAmount = calculateDiscountAmount(base, "percentage", 10);

      expect(base).toBe(1000000);
      expect(discountAmount).toBe(100000);
    });

    it("handles fractional percentages", () => {
      const { items } = createStandardAssessment();

      const base = calculateDiscountBase(items, "tuition_only"); // 50,000
      const discountAmount = calculateDiscountAmount(base, "percentage", 7.5);

      // 7.5% of 50,000 = 3,750
      expect(discountAmount).toBe(3750);
    });
  });

  describe("Cascade Edge Cases", () => {
    it("handles cash discount equal to full tuition", () => {
      const { items, discounts } = createAssessmentWithESCScholarship();

      // 100% discount = new base is 0
      const cascadeResult = calculateCascadeAdjustments(discounts, 100000, items);

      expect(cascadeResult.newTuitionBase).toBe(0);
      // ESC on 0 base = 0, adjustment = 20k - 0 = 20k
      expect(cascadeResult.adjustments[0].recalculatedDiscountAmount).toBe(0);
      expect(cascadeResult.adjustments[0].adjustmentAmount).toBe(20000);
    });

    it("handles very small cash discount amounts", () => {
      const { items, discounts } = createAssessmentWithESCScholarship();

      // Tiny discount: 100 pesos
      const cascadeResult = calculateCascadeAdjustments(discounts, 100, items);

      // New tuition: 100k - 100 = 99,900
      // ESC: 20% of 99,900 = 19,980
      // Adjustment: 20k - 19,980 = 20
      expect(cascadeResult.newTuitionBase).toBe(99900);
      expect(cascadeResult.adjustments[0].recalculatedDiscountAmount).toBe(19980);
      expect(cascadeResult.adjustments[0].adjustmentAmount).toBe(20);
    });

    it("skips tiny adjustments below threshold", () => {
      const { items } = createStandardAssessment();

      // Create discount that would result in sub-centavo adjustment
      const discounts: StudentDiscountForCascade[] = [
        {
          id: "discount-tiny",
          studentId: "student-1",
          assessmentId: "assessment-1",
          discountTypeCode: "TINY_DISCOUNT",
          discountTypeName: "Tiny Discount",
          calculationType: "percentage",
          baseType: "tuition_only",
          baseAmount: 50000,
          discountValue: 0.01, // 0.01% = 5 pesos
          discountAmount: 5,
          assessmentItemId: "item-tiny",
        },
      ];

      // Cash discount of 1 peso would create sub-centavo adjustment
      const cascadeResult = calculateCascadeAdjustments(discounts, 1, items);

      // Adjustment would be: 5 - (0.01% of 49999) = 5 - 4.9999 = ~0.0001
      // This is below 0.01 threshold, so no adjustment is created
      expect(cascadeResult.adjustments).toHaveLength(0);
    });
  });

  describe("Payment Schema Edge Cases", () => {
    it("handles minimum valid payment amount", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 0.01, // Minimum
        paymentMethod: "cash",
        amountTendered: 0.01,
      };

      const result = PostPaymentSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects zero payment amount", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 0,
        paymentMethod: "cash",
        amountTendered: 0,
      };

      const result = PostPaymentSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("handles empty string reference number for non-GCash", () => {
      const input = {
        studentId: "550e8400-e29b-41d4-a716-446655440000",
        assessmentId: "550e8400-e29b-41d4-a716-446655440001",
        bookletId: "550e8400-e29b-41d4-a716-446655440002",
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        referenceNumber: "", // Empty string should be treated as undefined
      };

      const result = PostPaymentSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.referenceNumber).toBeUndefined();
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Safety Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Type Safety & Contract Tests", () => {
  describe("DiscountLine Structure", () => {
    it("produces correctly structured discount lines", () => {
      const { items } = createStandardAssessment();
      const requests: ApprovedDiscountRequest[] = [createCashDiscountConfig()];

      const lines = calculateTotalDiscounts(items, requests);

      expect(lines).toHaveLength(1);
      const line = lines[0];

      // Verify all required fields are present
      expect(line).toHaveProperty("discountRequestId");
      expect(line).toHaveProperty("discountTypeCode");
      expect(line).toHaveProperty("discountTypeName");
      expect(line).toHaveProperty("baseType");
      expect(line).toHaveProperty("baseAmount");
      expect(line).toHaveProperty("calculationType");
      expect(line).toHaveProperty("discountValue");
      expect(line).toHaveProperty("discountAmount");

      // Verify types
      expect(typeof line.discountRequestId).toBe("string");
      expect(typeof line.baseAmount).toBe("number");
      expect(typeof line.discountAmount).toBe("number");
    });
  });

  describe("CascadeResult Structure", () => {
    it("produces correctly structured cascade result", () => {
      const { items, discounts } = createAssessmentWithESCScholarship();

      const result = calculateCascadeAdjustments(discounts, 10000, items);

      expect(result).toHaveProperty("adjustments");
      expect(result).toHaveProperty("totalAdjustment");
      expect(result).toHaveProperty("originalTuitionBase");
      expect(result).toHaveProperty("newTuitionBase");
      expect(result).toHaveProperty("cashDiscountAmount");

      expect(Array.isArray(result.adjustments)).toBe(true);
      expect(typeof result.totalAdjustment).toBe("number");
    });
  });

  describe("CascadePreview Structure", () => {
    it("produces correctly structured cascade preview", () => {
      const { items, discounts } = createAssessmentWithESCScholarship();

      const preview = generateCascadePreview(discounts, 10000, items);

      expect(preview).toHaveProperty("hasCascadeAdjustments");
      expect(preview).toHaveProperty("lines");
      expect(preview).toHaveProperty("totalAdjustment");
      expect(preview).toHaveProperty("explanation");

      expect(typeof preview.hasCascadeAdjustments).toBe("boolean");
      expect(Array.isArray(preview.lines)).toBe(true);
      expect(typeof preview.explanation).toBe("string");
    });
  });
});
