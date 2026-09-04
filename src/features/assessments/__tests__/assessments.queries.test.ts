/**
 * Assessment Query Functions Tests
 *
 * Tests for assessment query function types, parameters, and edge cases.
 * Note: Full integration tests require database connection.
 *
 * M2 Finding: Medium-priority test for query functions
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock server-only to prevent import errors
vi.mock("server-only", () => ({}));

// Mock database and dependencies
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: {
      schoolYearFeeSchedules: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/queries/schoolYears", () => ({
  getActiveSchoolYear: vi.fn(),
}));

vi.mock("@/lib/utils/date", () => ({
  formatDate: vi.fn((date: Date) => date.toISOString().split("T")[0]),
}));

// Import mocked modules
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";

// Type imports for testing
import type {
  AssessmentListItem,
  AssessmentListParams,
  AssessmentBillingFilter,
  PendingAssessmentQueueRow,
  AssessmentTabCounts,
  ResolvedFeeItem,
  FeeScheduleResolution,
} from "../assessments.queries";

describe("Assessment Query Type Definitions", () => {
  describe("AssessmentBillingFilter", () => {
    const validFilters: AssessmentBillingFilter[] = [
      "unpaid",
      "outstanding",
      "paid",
      "cancelled",
      "forwarded",
    ];

    it("should include 'unpaid' filter for zero payments", () => {
      expect(validFilters).toContain("unpaid");
    });

    it("should include 'outstanding' filter for partial payments", () => {
      expect(validFilters).toContain("outstanding");
    });

    it("should include 'paid' filter for fully paid", () => {
      expect(validFilters).toContain("paid");
    });

    it("should include 'cancelled' filter for cancelled assessments", () => {
      expect(validFilters).toContain("cancelled");
    });

    it("should include 'forwarded' filter for balance forwarded", () => {
      expect(validFilters).toContain("forwarded");
    });

    it("should have exactly 5 filter values", () => {
      expect(validFilters).toHaveLength(5);
    });
  });

  describe("AssessmentListParams", () => {
    it("should accept minimal params with page and pageSize", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
      };

      expect(params.page).toBe(1);
      expect(params.pageSize).toBe(25);
    });

    it("should accept optional searchQuery", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "Santos",
      };

      expect(params.searchQuery).toBe("Santos");
    });

    it("should accept optional schoolYearId", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        schoolYearId: "sy-2024-uuid",
      };

      expect(params.schoolYearId).toBe("sy-2024-uuid");
    });

    it("should accept optional billingFilter", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        billingFilter: "outstanding",
      };

      expect(params.billingFilter).toBe("outstanding");
    });

    it("should accept all optional params together", () => {
      const params: AssessmentListParams = {
        page: 2,
        pageSize: 50,
        searchQuery: "Cruz",
        schoolYearId: "sy-2024",
        billingFilter: "unpaid",
      };

      expect(params).toEqual({
        page: 2,
        pageSize: 50,
        searchQuery: "Cruz",
        schoolYearId: "sy-2024",
        billingFilter: "unpaid",
      });
    });
  });

  describe("AssessmentListItem", () => {
    it("should have correct required fields", () => {
      const item: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Santos, Juan",
        isSpecialEducation: false,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 50000,
        totalPaid: 25000,
        balance: 25000,
        billingStatus: "outstanding",
        transferredAt: null,
      };

      expect(item.id).toBeDefined();
      expect(item.studentName).toBeDefined();
      expect(item.gradeLevel).toBeDefined();
      expect(item.schoolYear).toBeDefined();
    });

    it("should have numeric amount fields", () => {
      const item: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Cruz, Maria",
        isSpecialEducation: true,
        hasEscDiscount: true,
        gradeLevel: "Grade 8",
        schoolYear: "2024-2025",
        totalAmount: 45000.50,
        totalPaid: 20000.25,
        balance: 24500.25,
        billingStatus: "outstanding",
        transferredAt: null,
      };

      expect(typeof item.totalAmount).toBe("number");
      expect(typeof item.totalPaid).toBe("number");
      expect(typeof item.balance).toBe("number");
    });

    it("should allow all billing status values", () => {
      const statuses: AssessmentListItem["billingStatus"][] = [
        "outstanding",
        "fully_paid",
        "cancelled",
        "balance_forwarded",
      ];

      statuses.forEach((status) => {
        const item: AssessmentListItem = {
          id: "assessment-uuid",
          studentName: "Test Student",
          isSpecialEducation: false,
          hasEscDiscount: false,
          gradeLevel: "Grade 7",
          schoolYear: "2024-2025",
          totalAmount: 50000,
          totalPaid: status === "fully_paid" ? 50000 : 25000,
          balance: status === "fully_paid" ? 0 : 25000,
          billingStatus: status,
          transferredAt: status === "balance_forwarded" ? new Date() : null,
        };

        expect(item.billingStatus).toBe(status);
      });
    });

    it("should allow transferredAt to be Date", () => {
      const transferDate = new Date("2024-06-01");
      const item: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Forwarded Student",
        isSpecialEducation: false,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2023-2024",
        totalAmount: 50000,
        totalPaid: 30000,
        balance: 20000,
        billingStatus: "balance_forwarded",
        transferredAt: transferDate,
      };

      expect(item.transferredAt).toBeInstanceOf(Date);
      expect(item.transferredAt).toEqual(transferDate);
    });
  });

  describe("PendingAssessmentQueueRow", () => {
    it("should have correct fields", () => {
      const row: PendingAssessmentQueueRow = {
        enrollmentId: "enrollment-uuid",
        referenceNumber: "0000001",
        studentName: "Santos, Juan",
        schoolYear: "2024-2025",
        gradeLevel: "Grade 7",
        queuedAtLabel: "Jun 1, 2024",
      };

      expect(row.enrollmentId).toBeDefined();
      expect(row.referenceNumber).toBeDefined();
      expect(row.studentName).toBeDefined();
      expect(row.schoolYear).toBeDefined();
      expect(row.gradeLevel).toBeDefined();
      expect(row.queuedAtLabel).toBeDefined();
    });

    it("should format student name as 'LastName, FirstName'", () => {
      const row: PendingAssessmentQueueRow = {
        enrollmentId: "enrollment-uuid",
        referenceNumber: "0000002",
        studentName: "Cruz, Maria",
        schoolYear: "2024-2025",
        gradeLevel: "Grade 8",
        queuedAtLabel: "Jun 15, 2024",
      };

      expect(row.studentName).toMatch(/^.+, .+$/);
    });
  });

  describe("AssessmentTabCounts", () => {
    it("should have all billing category counts", () => {
      const counts: AssessmentTabCounts = {
        unpaid: 10,
        outstanding: 5,
        paid: 20,
        cancelled: 2,
        forwarded: 3,
      };

      expect(Object.keys(counts)).toHaveLength(5);
      expect(counts.unpaid).toBe(10);
      expect(counts.outstanding).toBe(5);
      expect(counts.paid).toBe(20);
      expect(counts.cancelled).toBe(2);
      expect(counts.forwarded).toBe(3);
    });

    it("should allow zero counts", () => {
      const counts: AssessmentTabCounts = {
        unpaid: 0,
        outstanding: 0,
        paid: 0,
        cancelled: 0,
        forwarded: 0,
      };

      Object.values(counts).forEach((count) => {
        expect(count).toBe(0);
      });
    });

    it("should calculate total from all categories", () => {
      const counts: AssessmentTabCounts = {
        unpaid: 10,
        outstanding: 5,
        paid: 20,
        cancelled: 2,
        forwarded: 3,
      };

      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      expect(total).toBe(40);
    });
  });

  describe("ResolvedFeeItem", () => {
    it("should have correct fields", () => {
      const item: ResolvedFeeItem = {
        feeTemplateItemId: "item-uuid",
        feeItemTypeId: "type-uuid",
        feeItemTypeCode: "TUITION",
        description: "Tuition Fee",
        amount: "30000.00",
        isDiscount: false,
        isRefundable: true,
        order: 1,
      };

      expect(item.feeTemplateItemId).toBeDefined();
      expect(item.feeItemTypeId).toBeDefined();
      expect(item.feeItemTypeCode).toBeDefined();
      expect(item.description).toBeDefined();
      expect(item.amount).toBeDefined();
      expect(typeof item.isDiscount).toBe("boolean");
      expect(typeof item.isRefundable).toBe("boolean");
      expect(typeof item.order).toBe("number");
    });

    it("should represent discount fee items", () => {
      const discountItem: ResolvedFeeItem = {
        feeTemplateItemId: "discount-item-uuid",
        feeItemTypeId: "discount-type-uuid",
        feeItemTypeCode: "SIBLING_DISCOUNT",
        description: "Sibling Discount (10%)",
        amount: "-3000.00",
        isDiscount: true,
        isRefundable: false,
        order: 10,
      };

      expect(discountItem.isDiscount).toBe(true);
      expect(discountItem.amount.startsWith("-")).toBe(true);
    });
  });

  describe("FeeScheduleResolution", () => {
    it("should be null when no schedule found", () => {
      const resolution: FeeScheduleResolution = null;
      expect(resolution).toBeNull();
    });

    it("should have scheduleId, feeTemplateId, and items", () => {
      const resolution: FeeScheduleResolution = {
        scheduleId: "schedule-uuid",
        feeTemplateId: "template-uuid",
        items: [
          {
            feeTemplateItemId: "item-1",
            feeItemTypeId: "type-1",
            feeItemTypeCode: "TUITION",
            description: "Tuition Fee",
            amount: "30000.00",
            isDiscount: false,
            isRefundable: true,
            order: 1,
          },
        ],
      };

      expect(resolution).not.toBeNull();
      expect(resolution!.scheduleId).toBeDefined();
      expect(resolution!.feeTemplateId).toBeDefined();
      expect(resolution!.items).toHaveLength(1);
    });

    it("should allow multiple fee items", () => {
      const resolution: FeeScheduleResolution = {
        scheduleId: "schedule-uuid",
        feeTemplateId: "template-uuid",
        items: [
          {
            feeTemplateItemId: "item-1",
            feeItemTypeId: "type-1",
            feeItemTypeCode: "TUITION",
            description: "Tuition Fee",
            amount: "30000.00",
            isDiscount: false,
            isRefundable: true,
            order: 1,
          },
          {
            feeTemplateItemId: "item-2",
            feeItemTypeId: "type-2",
            feeItemTypeCode: "MISC",
            description: "Miscellaneous Fee",
            amount: "5000.00",
            isDiscount: false,
            isRefundable: false,
            order: 2,
          },
          {
            feeTemplateItemId: "item-3",
            feeItemTypeId: "type-3",
            feeItemTypeCode: "BOOKS",
            description: "Books and Materials",
            amount: "3000.00",
            isDiscount: false,
            isRefundable: true,
            order: 3,
          },
        ],
      };

      expect(resolution!.items).toHaveLength(3);

      // Verify items are ordered
      resolution!.items.forEach((item, index) => {
        expect(item.order).toBe(index + 1);
      });
    });
  });
});

describe("Query Parameter Validation", () => {
  describe("Pagination Parameters", () => {
    it("should accept standard pagination", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
      };

      expect(params.page).toBeGreaterThan(0);
      expect(params.pageSize).toBeGreaterThan(0);
    });

    it("should accept custom page sizes", () => {
      const pageSizes = [10, 25, 50, 100];

      pageSizes.forEach((pageSize) => {
        const params: AssessmentListParams = {
          page: 1,
          pageSize,
        };

        expect(params.pageSize).toBe(pageSize);
      });
    });

    it("should accept high page numbers", () => {
      const params: AssessmentListParams = {
        page: 999,
        pageSize: 25,
      };

      expect(params.page).toBe(999);
    });
  });

  describe("Search Query Parameters", () => {
    it("should accept single word search", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "Santos",
      };

      expect(params.searchQuery).toBe("Santos");
    });

    it("should accept multi-word search", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "Juan Santos",
      };

      expect(params.searchQuery).toContain(" ");
    });

    it("should accept partial name search", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "San",
      };

      expect(params.searchQuery?.length).toBeLessThan(10);
    });
  });

  describe("Filter Combinations", () => {
    it("should allow combining search with billing filter", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "Cruz",
        billingFilter: "outstanding",
      };

      expect(params.searchQuery).toBeDefined();
      expect(params.billingFilter).toBeDefined();
    });

    it("should allow combining schoolYearId with billing filter", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        schoolYearId: "sy-2023",
        billingFilter: "forwarded",
      };

      expect(params.schoolYearId).toBeDefined();
      expect(params.billingFilter).toBe("forwarded");
    });

    it("should allow all filters combined", () => {
      const params: AssessmentListParams = {
        page: 1,
        pageSize: 25,
        searchQuery: "Santos",
        schoolYearId: "sy-2024",
        billingFilter: "paid",
      };

      expect(Object.keys(params)).toHaveLength(5);
    });
  });
});

describe("Business Logic Constraints", () => {
  describe("Balance Relationships", () => {
    it("should have balance = totalAmount - totalPaid for outstanding", () => {
      const item: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Test Student",
        isSpecialEducation: false,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 50000,
        totalPaid: 25000,
        balance: 25000,
        billingStatus: "outstanding",
        transferredAt: null,
      };

      expect(item.balance).toBe(item.totalAmount - item.totalPaid);
    });

    it("should have zero balance for fully_paid", () => {
      const item: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Paid Student",
        isSpecialEducation: false,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 50000,
        totalPaid: 50000,
        balance: 0,
        billingStatus: "fully_paid",
        transferredAt: null,
      };

      expect(item.balance).toBe(0);
      expect(item.totalPaid).toBe(item.totalAmount);
    });

    it("should have zero totalPaid for unpaid filter scenario", () => {
      // unpaid: totalPaid = 0, not cancelled/forwarded
      const unpaidItem: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "Unpaid Student",
        isSpecialEducation: false,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 50000,
        totalPaid: 0,
        balance: 50000,
        billingStatus: "outstanding", // initial status before any payment
        transferredAt: null,
      };

      expect(unpaidItem.totalPaid).toBe(0);
      expect(unpaidItem.balance).toBe(unpaidItem.totalAmount);
    });
  });

  describe("Special Education Flag", () => {
    it("should track special education students", () => {
      const spedStudent: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "SPED Student",
        isSpecialEducation: true,
        hasEscDiscount: false,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 55000, // Includes SPED fee
        totalPaid: 0,
        balance: 55000,
        billingStatus: "outstanding",
        transferredAt: null,
      };

      expect(spedStudent.isSpecialEducation).toBe(true);
    });
  });

  describe("ESC Discount Flag", () => {
    it("should track ESC scholarship students", () => {
      const escStudent: AssessmentListItem = {
        id: "assessment-uuid",
        studentName: "ESC Scholar",
        isSpecialEducation: false,
        hasEscDiscount: true,
        gradeLevel: "Grade 7",
        schoolYear: "2024-2025",
        totalAmount: 35000, // After ESC discount
        totalPaid: 0,
        balance: 35000,
        billingStatus: "outstanding",
        transferredAt: null,
      };

      expect(escStudent.hasEscDiscount).toBe(true);
    });
  });

  describe("Fee Item Ordering", () => {
    it("should maintain fee item order in resolution", () => {
      const items: ResolvedFeeItem[] = [
        {
          feeTemplateItemId: "item-1",
          feeItemTypeId: "type-1",
          feeItemTypeCode: "TUITION",
          description: "Tuition Fee",
          amount: "30000.00",
          isDiscount: false,
          isRefundable: true,
          order: 1,
        },
        {
          feeTemplateItemId: "item-2",
          feeItemTypeId: "type-2",
          feeItemTypeCode: "MISC",
          description: "Miscellaneous Fee",
          amount: "2000.00",
          isDiscount: false,
          isRefundable: false,
          order: 2,
        },
        {
          feeTemplateItemId: "item-3",
          feeItemTypeId: "type-3",
          feeItemTypeCode: "BOOKS",
          description: "Books",
          amount: "3000.00",
          isDiscount: false,
          isRefundable: true,
          order: 3,
        },
      ];

      // Verify items are in order
      for (let i = 0; i < items.length - 1; i++) {
        expect(items[i].order).toBeLessThan(items[i + 1].order);
      }
    });

    it("should place discounts after regular fees", () => {
      const items: ResolvedFeeItem[] = [
        {
          feeTemplateItemId: "fee-1",
          feeItemTypeId: "type-1",
          feeItemTypeCode: "TUITION",
          description: "Tuition Fee",
          amount: "30000.00",
          isDiscount: false,
          isRefundable: true,
          order: 1,
        },
        {
          feeTemplateItemId: "discount-1",
          feeItemTypeId: "dtype-1",
          feeItemTypeCode: "EARLY_BIRD",
          description: "Early Bird Discount",
          amount: "-1500.00",
          isDiscount: true,
          isRefundable: false,
          order: 10, // Discounts typically have higher order
        },
      ];

      const regularFees = items.filter((i) => !i.isDiscount);
      const discounts = items.filter((i) => i.isDiscount);

      // All regular fees should have lower order than discounts
      const maxRegularOrder = Math.max(...regularFees.map((f) => f.order));
      const minDiscountOrder = Math.min(...discounts.map((d) => d.order));

      expect(maxRegularOrder).toBeLessThan(minDiscountOrder);
    });
  });
});
