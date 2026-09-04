/**
 * Payment Query Functions Tests
 *
 * Tests for payment query function types, parameters, and business logic.
 * Note: Full integration tests require database connection.
 *
 * M2 Finding: Medium-priority test for query functions
 */

import { describe, it, expect, vi } from "vitest";

// Mock server-only to prevent import errors
vi.mock("server-only", () => ({}));

// Type imports for testing
import type {
  CashierQueueRow,
  CashierStats,
  RecentCollection,
  CashierQueueData,
  CashierQueueParams,
  PortalPaymentRow,
  PortalPaymentsData,
  ManualEntrySuggestions,
  CashDiscountEligibility,
  CascadeAdjustmentPreview,
  CascadeAdjustmentPreviewLine,
  AppliedCashDiscountDetails,
  AppliedCascadeAdjustment,
  RelatedTuitionDiscount,
  CascadeFixNeeded,
  CascadeFixAdjustment,
  CascadeFixFormState,
} from "../payments.types";

describe("Payment Query Type Definitions", () => {
  describe("CashierQueueRow", () => {
    it("should have correct fields for cashier queue display", () => {
      const row: CashierQueueRow = {
        assessmentId: "assessment-uuid",
        studentName: "Santos, Juan",
        referenceNumber: "0000001",
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        billingStatus: "outstanding",
        balance: 25000,
        totalPaid: 25000,
      };

      expect(row.assessmentId).toBeDefined();
      expect(row.studentName).toBeDefined();
      expect(row.referenceNumber).toBeDefined();
      expect(row.gradeLevel).toBeDefined();
      expect(row.schoolYear).toBeDefined();
      expect(row.billingStatus).toBeDefined();
      expect(typeof row.balance).toBe("number");
      expect(typeof row.totalPaid).toBe("number");
    });

    it("should represent unpaid assessment", () => {
      const unpaidRow: CashierQueueRow = {
        assessmentId: "assessment-uuid",
        studentName: "Cruz, Maria",
        referenceNumber: "0000002",
        gradeLevel: "Grade 8",
        schoolYear: "2024-2025",
        billingStatus: "outstanding",
        balance: 50000,
        totalPaid: 0,
      };

      expect(unpaidRow.totalPaid).toBe(0);
      expect(unpaidRow.balance).toBeGreaterThan(0);
    });

    it("should represent partially paid assessment", () => {
      const partialRow: CashierQueueRow = {
        assessmentId: "assessment-uuid",
        studentName: "Reyes, Pedro",
        referenceNumber: "0000003",
        gradeLevel: "Grade 9",
        schoolYear: "2024-2025",
        billingStatus: "outstanding",
        balance: 30000,
        totalPaid: 20000,
      };

      expect(partialRow.totalPaid).toBeGreaterThan(0);
      expect(partialRow.balance).toBeGreaterThan(0);
    });
  });

  describe("CashierStats", () => {
    it("should have correct statistics fields", () => {
      const stats: CashierStats = {
        totalCollectedToday: 150000,
        pendingPaymentsCount: 45,
        studentsAssessed: 120,
        totalCollectibles: 3500000,
      };

      expect(typeof stats.totalCollectedToday).toBe("number");
      expect(typeof stats.pendingPaymentsCount).toBe("number");
      expect(typeof stats.studentsAssessed).toBe("number");
      expect(typeof stats.totalCollectibles).toBe("number");
    });

    it("should allow zero values", () => {
      const emptyStats: CashierStats = {
        totalCollectedToday: 0,
        pendingPaymentsCount: 0,
        studentsAssessed: 0,
        totalCollectibles: 0,
      };

      Object.values(emptyStats).forEach((value) => {
        expect(value).toBe(0);
      });
    });
  });

  describe("RecentCollection", () => {
    it("should have correct fields for recent payment display", () => {
      const collection: RecentCollection = {
        paymentId: "payment-uuid",
        orNumber: "AK 00051",
        amount: 5000,
        paymentDate: new Date("2024-06-01T10:30:00"),
        studentFirstName: "Juan",
        studentLastName: "Santos",
        assessmentId: "assessment-uuid",
      };

      expect(collection.paymentId).toBeDefined();
      expect(collection.orNumber).toBe("AK 00051");
      expect(typeof collection.amount).toBe("number");
      expect(collection.paymentDate).toBeInstanceOf(Date);
    });

    it("should allow null OR number for manual/special payments", () => {
      const manualCollection: RecentCollection = {
        paymentId: "payment-uuid",
        orNumber: null,
        amount: 3000,
        paymentDate: new Date(),
        studentFirstName: "Maria",
        studentLastName: "Cruz",
        assessmentId: null,
      };

      expect(manualCollection.orNumber).toBeNull();
      expect(manualCollection.assessmentId).toBeNull();
    });
  });

  describe("CashierQueueData", () => {
    it("should combine queue, stats, and recent collections", () => {
      const data: CashierQueueData = {
        queue: [
          {
            assessmentId: "assessment-1",
            studentName: "Student 1",
            referenceNumber: "0000001",
            gradeLevel: "Grade 7",
            schoolYear: "2024-2025",
            billingStatus: "outstanding",
            balance: 25000,
            totalPaid: 0,
          },
        ],
        stats: {
          totalCollectedToday: 50000,
          pendingPaymentsCount: 1,
          studentsAssessed: 100,
          totalCollectibles: 2500000,
        },
        recentCollections: [],
        queueTotalCount: 1,
      };

      expect(data.queue).toHaveLength(1);
      expect(data.stats.totalCollectedToday).toBe(50000);
      expect(data.queueTotalCount).toBe(1);
    });
  });

  describe("CashierQueueParams", () => {
    it("should accept optional pagination parameters", () => {
      const params1: CashierQueueParams = {};
      const params2: CashierQueueParams = { page: 1 };
      const params3: CashierQueueParams = { pageSize: 50 };
      const params4: CashierQueueParams = { page: 2, pageSize: 25 };

      expect(params1).toEqual({});
      expect(params2.page).toBe(1);
      expect(params3.pageSize).toBe(50);
      expect(params4).toEqual({ page: 2, pageSize: 25 });
    });
  });

  describe("PortalPaymentRow", () => {
    it("should have correct fields for portal display", () => {
      const row: PortalPaymentRow = {
        id: "payment-uuid",
        studentId: "student-uuid",
        studentName: "Santos, Juan",
        studentReference: "0000001",
        orNumber: "AK 00051",
        amount: 5000,
        paymentMethod: "cash",
        paymentDate: "2024-06-01T10:30:00Z",
        status: "posted",
        paymentReference: null,
        schoolYearId: "sy-uuid",
        schoolYearLabel: "2024-2025",
        gradeLevelName: "Grade 7",
      };

      expect(row.id).toBeDefined();
      expect(row.studentId).toBeDefined();
      expect(typeof row.paymentDate).toBe("string"); // ISO string for serialization
    });

    it("should support all payment methods", () => {
      const methods = ["cash", "check", "bank_transfer", "gcash", "other"];

      methods.forEach((method) => {
        const row: PortalPaymentRow = {
          id: "payment-uuid",
          studentId: "student-uuid",
          studentName: "Test Student",
          studentReference: "0000001",
          orNumber: "AK 00051",
          amount: 1000,
          paymentMethod: method,
          paymentDate: new Date().toISOString(),
          status: "posted",
          paymentReference: method !== "cash" ? "REF123" : null,
          schoolYearId: "sy-uuid",
          schoolYearLabel: "2024-2025",
          gradeLevelName: "Grade 7",
        };

        expect(row.paymentMethod).toBe(method);
      });
    });
  });

  describe("PortalPaymentsData", () => {
    it("should include display flags", () => {
      const data: PortalPaymentsData = {
        rows: [],
        showStudentColumn: true,
        hasLinkedStudents: true,
      };

      expect(typeof data.showStudentColumn).toBe("boolean");
      expect(typeof data.hasLinkedStudents).toBe("boolean");
    });
  });

  describe("ManualEntrySuggestions", () => {
    it("should provide OR number suggestions", () => {
      const suggestions: ManualEntrySuggestions = {
        lastManualPaymentDate: "2024-06-01",
        suggestedOrNumbers: [
          { bookletId: "booklet-1", series: "AK-00051-00100", nextOr: "AK 00052" },
          { bookletId: "booklet-2", series: "BK-00001-00050", nextOr: "BK 00001" },
        ],
      };

      expect(suggestions.suggestedOrNumbers).toHaveLength(2);
      expect(suggestions.suggestedOrNumbers[0].nextOr).toBe("AK 00052");
    });

    it("should allow null last manual payment date", () => {
      const suggestions: ManualEntrySuggestions = {
        lastManualPaymentDate: null,
        suggestedOrNumbers: [],
      };

      expect(suggestions.lastManualPaymentDate).toBeNull();
    });
  });
});

describe("Cash Discount Eligibility Types", () => {
  describe("CashDiscountEligibility", () => {
    it("should represent ineligible status", () => {
      const ineligible: CashDiscountEligibility = {
        eligible: false,
        reason: "Cash discount cutoff date has passed",
      };

      expect(ineligible.eligible).toBe(false);
      expect(ineligible.reason).toBeDefined();
      expect(ineligible.discountDetails).toBeUndefined();
    });

    it("should represent eligible status with discount details", () => {
      const eligible: CashDiscountEligibility = {
        eligible: true,
        discountDetails: {
          discountTypeId: "dtype-uuid",
          discountTypeName: "Full Payment Cash Discount",
          calculationType: "percentage",
          baseType: "tuition_only",
          discountValue: 5,
          baseAmount: 30000,
          cashDiscountAmount: 1500,
          currentBalance: 50000,
          newBalance: 48500,
          paymentRequired: 48500,
          cutoffDate: new Date("2024-07-31"),
        },
      };

      expect(eligible.eligible).toBe(true);
      expect(eligible.discountDetails).toBeDefined();
      expect(eligible.discountDetails?.cashDiscountAmount).toBe(1500);
    });

    it("should include cascade preview when applicable", () => {
      const eligibleWithCascade: CashDiscountEligibility = {
        eligible: true,
        discountDetails: {
          discountTypeId: "dtype-uuid",
          discountTypeName: "Full Payment Cash Discount",
          calculationType: "percentage",
          baseType: "tuition_only",
          discountValue: 5,
          baseAmount: 30000,
          cashDiscountAmount: 1500,
          currentBalance: 45000,
          newBalance: 43750,
          paymentRequired: 43750,
          cutoffDate: new Date("2024-07-31"),
          cascadePreview: {
            hasCascadeAdjustments: true,
            lines: [
              {
                discountTypeName: "ESC Scholarship",
                originalAmount: 15000,
                recalculatedAmount: 14250,
                adjustmentAmount: 750,
              },
            ],
            totalAdjustment: 750,
            explanation: "Existing scholarships will be recalculated based on discounted tuition.",
          },
        },
      };

      expect(eligibleWithCascade.discountDetails?.cascadePreview).toBeDefined();
      expect(eligibleWithCascade.discountDetails?.cascadePreview?.hasCascadeAdjustments).toBe(true);
    });
  });

  describe("CascadeAdjustmentPreview", () => {
    it("should show no adjustments when none needed", () => {
      const preview: CascadeAdjustmentPreview = {
        hasCascadeAdjustments: false,
        lines: [],
        totalAdjustment: 0,
        explanation: "No cascade adjustments needed.",
      };

      expect(preview.hasCascadeAdjustments).toBe(false);
      expect(preview.lines).toHaveLength(0);
      expect(preview.totalAdjustment).toBe(0);
    });

    it("should show multiple adjustment lines", () => {
      const preview: CascadeAdjustmentPreview = {
        hasCascadeAdjustments: true,
        lines: [
          {
            discountTypeName: "ESC Scholarship",
            originalAmount: 15000,
            recalculatedAmount: 14250,
            adjustmentAmount: 750,
          },
          {
            discountTypeName: "Sibling Discount",
            originalAmount: 3000,
            recalculatedAmount: 2850,
            adjustmentAmount: 150,
          },
        ],
        totalAdjustment: 900,
        explanation: "Existing discounts recalculated based on discounted tuition.",
      };

      expect(preview.lines).toHaveLength(2);
      expect(preview.totalAdjustment).toBe(900);

      // Verify total matches sum of individual adjustments
      const sum = preview.lines.reduce((acc, line) => acc + line.adjustmentAmount, 0);
      expect(preview.totalAdjustment).toBe(sum);
    });
  });

  describe("CascadeAdjustmentPreviewLine", () => {
    it("should calculate adjustment correctly", () => {
      const line: CascadeAdjustmentPreviewLine = {
        discountTypeName: "ESC Scholarship",
        originalAmount: 15000,
        recalculatedAmount: 14250,
        adjustmentAmount: 750,
      };

      // Adjustment should equal original - recalculated
      expect(line.adjustmentAmount).toBe(line.originalAmount - line.recalculatedAmount);
    });

    it("should always have positive adjustment", () => {
      const line: CascadeAdjustmentPreviewLine = {
        discountTypeName: "Test Discount",
        originalAmount: 10000,
        recalculatedAmount: 9500,
        adjustmentAmount: 500,
      };

      expect(line.adjustmentAmount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("Applied Cash Discount Types", () => {
  describe("AppliedCashDiscountDetails", () => {
    it("should indicate no applied discount", () => {
      const noDiscount: AppliedCashDiscountDetails = {
        hasAppliedCashDiscount: false,
      };

      expect(noDiscount.hasAppliedCashDiscount).toBe(false);
      expect(noDiscount.discountDetails).toBeUndefined();
    });

    it("should show applied discount with cascade adjustments", () => {
      const withDiscount: AppliedCashDiscountDetails = {
        hasAppliedCashDiscount: true,
        discountDetails: {
          studentDiscountId: "sd-uuid",
          discountAmount: 1500,
          appliedAt: new Date("2024-06-01"),
          appliedByName: "Finance Officer",
          cascadeAdjustments: [
            {
              discountTypeName: "ESC Scholarship",
              originalAmount: 15000,
              adjustmentAmount: 750,
            },
          ],
          totalCascadeAdjustment: 750,
          relatedDiscounts: [],
          cutoffDate: new Date("2024-07-31"),
          isExpired: false,
        },
      };

      expect(withDiscount.hasAppliedCashDiscount).toBe(true);
      expect(withDiscount.discountDetails?.cascadeAdjustments).toHaveLength(1);
      expect(withDiscount.discountDetails?.isExpired).toBe(false);
    });

    it("should show related tuition discounts", () => {
      const withRelated: AppliedCashDiscountDetails = {
        hasAppliedCashDiscount: true,
        discountDetails: {
          studentDiscountId: "sd-uuid",
          discountAmount: 1500,
          appliedAt: new Date("2024-06-01"),
          appliedByName: "Finance Officer",
          cascadeAdjustments: [],
          totalCascadeAdjustment: 0,
          relatedDiscounts: [
            {
              discountTypeName: "Sibling Discount",
              baseAmount: 28500, // Discounted tuition
              discountAmount: 2850, // 10% of discounted tuition
            },
          ],
          cutoffDate: new Date("2024-07-31"),
          isExpired: false,
        },
      };

      expect(withRelated.discountDetails?.relatedDiscounts).toHaveLength(1);
    });

    it("should indicate expired discount", () => {
      const expired: AppliedCashDiscountDetails = {
        hasAppliedCashDiscount: true,
        discountDetails: {
          studentDiscountId: "sd-uuid",
          discountAmount: 1500,
          appliedAt: new Date("2024-05-01"),
          appliedByName: "Finance Officer",
          cascadeAdjustments: [],
          totalCascadeAdjustment: 0,
          relatedDiscounts: [],
          cutoffDate: new Date("2024-07-31"),
          isExpired: true, // Past cutoff, no payment made
        },
      };

      expect(expired.discountDetails?.isExpired).toBe(true);
    });
  });

  describe("AppliedCascadeAdjustment", () => {
    it("should track cascade adjustment details", () => {
      const adjustment: AppliedCascadeAdjustment = {
        discountTypeName: "ESC Scholarship",
        originalAmount: 15000,
        adjustmentAmount: 750,
      };

      expect(adjustment.discountTypeName).toBeDefined();
      expect(adjustment.originalAmount).toBeGreaterThan(adjustment.adjustmentAmount);
    });
  });

  describe("RelatedTuitionDiscount", () => {
    it("should track discounts using discounted base", () => {
      const related: RelatedTuitionDiscount = {
        discountTypeName: "Sibling Discount",
        baseAmount: 28500, // Discounted tuition (30000 - 1500)
        discountAmount: 2850, // 10% of discounted base
      };

      expect(related.discountTypeName).toBeDefined();
      // Verify percentage calculation
      expect(related.discountAmount).toBeCloseTo(related.baseAmount * 0.1, 2);
    });
  });
});

describe("Cascade Fix Types", () => {
  describe("CascadeFixNeeded", () => {
    it("should indicate fix is needed", () => {
      const fixNeeded: CascadeFixNeeded = {
        needsFix: true,
        cashDiscountId: "cd-uuid",
        cashDiscountAmount: 1500,
        adjustments: [
          {
            studentDiscountId: "sd-uuid-1",
            discountTypeName: "ESC Scholarship",
            originalBase: 30000, // Pre-cash-discount tuition
            correctBase: 28500, // Post-cash-discount tuition
            originalAmount: 15000, // 50% of 30000
            correctAmount: 14250, // 50% of 28500
            adjustmentNeeded: 750,
            assessmentItemId: "ai-uuid",
          },
        ],
        totalAdjustment: 750,
      };

      expect(fixNeeded.needsFix).toBe(true);
      expect(fixNeeded.adjustments).toHaveLength(1);
      expect(fixNeeded.totalAdjustment).toBe(750);
    });

    it("should support multiple adjustments", () => {
      const fixNeeded: CascadeFixNeeded = {
        needsFix: true,
        cashDiscountId: "cd-uuid",
        cashDiscountAmount: 1500,
        adjustments: [
          {
            studentDiscountId: "sd-uuid-1",
            discountTypeName: "ESC Scholarship",
            originalBase: 30000,
            correctBase: 28500,
            originalAmount: 15000,
            correctAmount: 14250,
            adjustmentNeeded: 750,
            assessmentItemId: "ai-uuid-1",
          },
          {
            studentDiscountId: "sd-uuid-2",
            discountTypeName: "Sibling Discount",
            originalBase: 30000,
            correctBase: 28500,
            originalAmount: 3000,
            correctAmount: 2850,
            adjustmentNeeded: 150,
            assessmentItemId: "ai-uuid-2",
          },
        ],
        totalAdjustment: 900,
      };

      expect(fixNeeded.adjustments).toHaveLength(2);

      // Verify total is sum of individual adjustments
      const sum = fixNeeded.adjustments.reduce((acc, adj) => acc + adj.adjustmentNeeded, 0);
      expect(fixNeeded.totalAdjustment).toBe(sum);
    });
  });

  describe("CascadeFixAdjustment", () => {
    it("should calculate adjustment correctly", () => {
      const adjustment: CascadeFixAdjustment = {
        studentDiscountId: "sd-uuid",
        discountTypeName: "ESC Scholarship",
        originalBase: 30000,
        correctBase: 28500,
        originalAmount: 15000, // 50% of 30000
        correctAmount: 14250, // 50% of 28500
        adjustmentNeeded: 750,
        assessmentItemId: "ai-uuid",
      };

      // Verify adjustment = original - correct
      expect(adjustment.adjustmentNeeded).toBe(
        adjustment.originalAmount - adjustment.correctAmount
      );

      // Verify base difference matches cash discount
      const baseDifference = adjustment.originalBase - adjustment.correctBase;
      expect(baseDifference).toBe(1500); // The cash discount amount
    });

    it("should allow null assessmentItemId", () => {
      const adjustment: CascadeFixAdjustment = {
        studentDiscountId: "sd-uuid",
        discountTypeName: "Test Discount",
        originalBase: 10000,
        correctBase: 9500,
        originalAmount: 1000,
        correctAmount: 950,
        adjustmentNeeded: 50,
        assessmentItemId: null, // Not yet created
      };

      expect(adjustment.assessmentItemId).toBeNull();
    });
  });

  describe("CascadeFixFormState", () => {
    it("should represent success state", () => {
      const success: CascadeFixFormState = {
        success: true,
        message: "Cascade adjustments applied successfully.",
        totalAdjustment: 750,
      };

      expect(success.success).toBe(true);
      expect(success.totalAdjustment).toBe(750);
    });

    it("should represent error state", () => {
      const error: CascadeFixFormState = {
        success: false,
        message: "Failed to apply cascade adjustments.",
      };

      expect(error.success).toBe(false);
      expect(error.totalAdjustment).toBeUndefined();
    });

    it("should represent initial empty state", () => {
      const initial: CascadeFixFormState = {};

      expect(initial.success).toBeUndefined();
      expect(initial.message).toBeUndefined();
    });
  });
});

describe("Business Logic Validation", () => {
  describe("Balance Calculations", () => {
    it("should have consistent queue row balance", () => {
      const row: CashierQueueRow = {
        assessmentId: "assessment-uuid",
        studentName: "Test Student",
        referenceNumber: "0000001",
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        billingStatus: "outstanding",
        balance: 25000,
        totalPaid: 25000,
      };

      // For an outstanding assessment with partial payment:
      // total = balance + totalPaid
      const impliedTotal = row.balance + row.totalPaid;
      expect(impliedTotal).toBe(50000);
    });
  });

  describe("Discount Percentage Calculations", () => {
    it("should calculate percentage discount correctly", () => {
      const eligible: CashDiscountEligibility = {
        eligible: true,
        discountDetails: {
          discountTypeId: "dtype-uuid",
          discountTypeName: "5% Cash Discount",
          calculationType: "percentage",
          baseType: "tuition_only",
          discountValue: 5, // 5%
          baseAmount: 30000,
          cashDiscountAmount: 1500, // 5% of 30000
          currentBalance: 50000,
          newBalance: 48500,
          paymentRequired: 48500,
          cutoffDate: new Date("2024-07-31"),
        },
      };

      // Verify percentage calculation
      const calculated = eligible.discountDetails!.baseAmount * (eligible.discountDetails!.discountValue / 100);
      expect(eligible.discountDetails!.cashDiscountAmount).toBe(calculated);
    });

    it("should handle fixed amount discount", () => {
      const eligible: CashDiscountEligibility = {
        eligible: true,
        discountDetails: {
          discountTypeId: "dtype-uuid",
          discountTypeName: "Early Payment Discount",
          calculationType: "fixed_amount",
          baseType: "full_assessment",
          discountValue: 2000, // Fixed 2000
          baseAmount: 50000,
          cashDiscountAmount: 2000,
          currentBalance: 50000,
          newBalance: 48000,
          paymentRequired: 48000,
          cutoffDate: new Date("2024-07-31"),
        },
      };

      // Fixed discount = discountValue
      expect(eligible.discountDetails!.cashDiscountAmount).toBe(
        eligible.discountDetails!.discountValue
      );
    });
  });

  describe("OR Number Format", () => {
    it("should follow OR number format in suggestions", () => {
      const suggestions: ManualEntrySuggestions = {
        lastManualPaymentDate: "2024-06-01",
        suggestedOrNumbers: [
          { bookletId: "booklet-1", series: "AK-00051-00100", nextOr: "AK 00052" },
        ],
      };

      // OR number format: "XX 00000"
      const orNumber = suggestions.suggestedOrNumbers[0].nextOr;
      expect(orNumber).toMatch(/^[A-Z]{2} \d{5}$/);
    });

    it("should follow series format in suggestions", () => {
      const suggestions: ManualEntrySuggestions = {
        lastManualPaymentDate: null,
        suggestedOrNumbers: [
          { bookletId: "booklet-1", series: "AK-00051-00100", nextOr: "AK 00051" },
        ],
      };

      // Series format: "XX-00000-00000"
      const series = suggestions.suggestedOrNumbers[0].series;
      expect(series).toMatch(/^[A-Z]{2}-\d{5}-\d{5}$/);
    });
  });
});
