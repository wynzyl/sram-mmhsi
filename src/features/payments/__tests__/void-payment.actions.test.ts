import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Void Payment Action Tests
 *
 * Tests for voidPaymentAction covering:
 * 1. Authorization checks (payments:void permission)
 * 2. Input validation (paymentId UUID, voidReason min length)
 * 3. Business rule enforcement:
 *    - Payment must exist
 *    - Payment must not be already voided
 *    - Student must not be archived
 *    - No pending enrollment cancellation request
 *    - Assessment must not be transferred
 * 4. Side effects:
 *    - Payment marked as voided
 *    - Assessment balance reverted
 *    - Cash discount reversal (if applicable)
 *    - Cascade adjustment reversal (if applicable)
 *    - Enrollment status reversion (if total paid becomes zero)
 *    - Audit logging
 */

// ─────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => ({
  requireStaffSession: vi.fn(),
}));

vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      payments: { findFirst: vi.fn() },
      assessments: { findFirst: vi.fn() },
    },
    transaction: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("@/lib/cache/cache-tags", () => ({
  CACHE_TAGS: {
    DASHBOARD: "dashboard",
    ENROLLMENTS: "enrollments",
  },
  invalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/form-validation", () => ({
  parseFormData: vi.fn(),
}));

vi.mock("@/lib/utils/tx-helpers", () => ({
  lockPayment: vi.fn(),
  lockAssessment: vi.fn(),
  assertAssessmentNotTransferred: vi.fn(),
}));

vi.mock("@/lib/utils/enrollment-status", () => ({
  revertToAssessedOnVoid: vi.fn(),
}));

vi.mock("@/lib/utils/assessment-balance", () => ({
  applyAssessmentBalanceDelta: vi.fn(),
  recalcAssessmentTotalsForDiscount: vi.fn(),
  reverseCascadeAdjustment: vi.fn(),
}));

vi.mock("@/features/enrollments/enrollment-cancellation.queries", () => ({
  assertNoPendingCancellation: vi.fn(),
}));

vi.mock("@/features/archive/archive.guards", () => ({
  assertStudentMutable: vi.fn(),
  StudentArchivedException: class StudentArchivedException extends Error {
    constructor(
      message: string,
      public readonly studentId: string,
      public readonly status: string
    ) {
      super(message);
    }
  },
  formatArchiveError: vi.fn((err) => ({
    error: { message: err.message },
  })),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/audit-logger", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/constants/discount-codes", () => ({
  FULL_PAYMENT_DISCOUNT_CODE: "FULL_PAYMENT_DISCOUNT",
}));

vi.mock("@/lib/utils/assessment-billing", () => ({
  ASSESSMENT_BALANCE_FULLY_PAID_EPSILON: 0.01,
}));

// Import after mocks are set up
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/utils/form-validation";
import { lockPayment, lockAssessment, assertAssessmentNotTransferred } from "@/lib/utils/tx-helpers";
import { revertToAssessedOnVoid } from "@/lib/utils/enrollment-status";
import {
  applyAssessmentBalanceDelta,
  recalcAssessmentTotalsForDiscount,
  reverseCascadeAdjustment,
} from "@/lib/utils/assessment-balance";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import { assertStudentMutable, StudentArchivedException } from "@/features/archive/archive.guards";
import { logAudit } from "@/lib/utils/audit-logger";

import { voidPaymentAction } from "../actions/void-payment.actions";

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const validUuids = {
  payment: "550e8400-e29b-41d4-a716-446655440000",
  assessment: "660e8400-e29b-41d4-a716-446655440001",
  student: "770e8400-e29b-41d4-a716-446655440002",
  enrollment: "880e8400-e29b-41d4-a716-446655440003",
  cashDiscount: "990e8400-e29b-41d4-a716-446655440004",
  cascadeDiscount: "aa0e8400-e29b-41d4-a716-446655440005",
};

const createMockSession = (role: string = "cashier") => ({
  userId: "user-123",
  role,
  username: "testuser",
});

const createMockPayment = (overrides?: Record<string, unknown>) => ({
  id: validUuids.payment,
  studentId: validUuids.student,
  assessmentId: validUuids.assessment,
  amount: "10000.00",
  status: "posted",
  orNumber: "AK 00001",
  orStatus: "consumed",
  paymentMethod: "cash",
  paymentDate: new Date(),
  ...overrides,
});

const createMockAssessment = (overrides?: Record<string, unknown>) => ({
  id: validUuids.assessment,
  enrollmentId: validUuids.enrollment,
  studentId: validUuids.student,
  totalAmount: "50000.00",
  totalPaid: "10000.00",
  balance: "40000.00",
  billingStatus: "outstanding",
  cancelledAt: null,
  transferredAt: null,
  ...overrides,
});

const createFormData = (data: Record<string, string>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    formData.set(key, value);
  });
  return formData;
};

// ─────────────────────────────────────────────────────────────────
// Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("voidPaymentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization", () => {
    it("should reject request when user lacks payments:void permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("student"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test void reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("permission");
      expect(hasPermission).toHaveBeenCalledWith("student", "payments:void");
    });

    it("should allow cashier role to void payments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Test reason" },
      });

      // Mock successful void
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);
        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });
        (logAudit as Mock).mockResolvedValue(undefined);

        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
        };
        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Customer requested refund",
      });

      await voidPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "payments:void");
    });

    it("should allow admin role to void payments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("admin"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Admin void" },
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Admin void",
      });

      await voidPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("admin", "payments:void");
    });

    it("should allow finance_officer role to void payments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Finance void" },
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Finance void",
      });

      await voidPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "payments:void");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Input Validation Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Input Validation", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should reject when paymentId is missing", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { paymentId: ["Payment ID is required"] },
      });

      const formData = createFormData({
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.paymentId).toBeDefined();
    });

    it("should reject when paymentId is invalid UUID", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { paymentId: ["Payment ID is required"] },
      });

      const formData = createFormData({
        paymentId: "invalid-uuid",
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.paymentId).toBeDefined();
    });

    it("should reject when voidReason is missing", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { voidReason: ["Please provide a reason for voiding"] },
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.voidReason).toBeDefined();
    });

    it("should reject when voidReason is too short (< 3 chars)", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { voidReason: ["Please provide a reason for voiding"] },
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "ab", // Only 2 characters
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.voidReason).toBeDefined();
    });

    it("should accept valid voidReason with 3+ characters", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "abc" },
      });

      // Mock the transaction to throw to exit early
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(null);
        await callback({});
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "abc", // Exactly 3 characters
      });

      const result = await voidPaymentAction({}, formData);

      // Should proceed to transaction (payment not found is expected)
      expect(result.message).toBe("Payment not found.");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Business Rule Enforcement Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Business Rule Enforcement", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Valid reason for void" },
      });
    });

    it("should reject when payment not found", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(null);
        await callback({});
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toBe("Payment not found.");
    });

    it("should reject when payment is already voided", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment({ status: "voided" }));
        await callback({});
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toBe("Payment is already voided.");
    });

    it("should reject when student is archived", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockRejectedValue(
          new StudentArchivedException(
            "Student is archived and cannot be modified",
            validUuids.student,
            "graduated"
          )
        );
        await callback({});
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toContain("archived");
    });

    it("should reject when pending cancellation request exists", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
        };

        (assertNoPendingCancellation as Mock).mockRejectedValue(
          new Error("Cannot void payment: enrollment has a pending cancellation request")
        );

        await callback(mockTx);
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toContain("pending cancellation");
    });

    it("should reject when assessment has been transferred", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(
          createMockAssessment({ transferredAt: new Date() })
        );
        (assertAssessmentNotTransferred as Mock).mockImplementation(() => {
          throw new Error("Cannot void payment: assessment balance has been transferred");
        });

        await callback(mockTx);
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Test reason",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toContain("transferred");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Balance Reversion Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Balance Reversion", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Valid reason" },
      });
    });

    it("should revert assessment balance when payment is voided", async () => {
      let balanceDeltaCalled = false;
      let deltaAmount = 0;

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment({ amount: "15000.00" }));
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No cash discount
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockImplementation(
          async (_tx, _assessmentId, delta) => {
            balanceDeltaCalled = true;
            deltaAmount = delta;
            return { newTotalPaid: 0 };
          }
        );
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Reverting payment",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(balanceDeltaCalled).toBe(true);
      expect(deltaAmount).toBe(-15000); // Negative delta for reversal
    });

    it("should revert enrollment status to assessed when total paid becomes zero", async () => {
      let revertCalled = false;

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 }); // Zero!
        (revertToAssessedOnVoid as Mock).mockImplementation(async () => {
          revertCalled = true;
        });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Voiding last payment",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(revertCalled).toBe(true);
    });

    it("should NOT revert enrollment status when total paid is still above zero", async () => {
      let revertCalled = false;

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment({ amount: "5000.00" }));
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment({ totalPaid: "15000.00" }));
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 10000 }); // Still has payments
        (revertToAssessedOnVoid as Mock).mockImplementation(async () => {
          revertCalled = true;
        });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Voiding partial payment",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(revertCalled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Cash Discount Reversal Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Cash Discount Reversal", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Voiding with discount" },
      });
    });

    it("should reverse cash discount when payment had one applied", async () => {
      // This test verifies that cash discount reversal is triggered
      // The actual reversal logic is tested in discount utility tests

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const cashDiscountData = {
          id: validUuids.cashDiscount,
          discountAmount: "5000.00",
          assessmentItemId: "discount-item-1",
        };

        // Track select calls to return different data
        let selectCallIndex = 0;
        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockImplementation(() => ({
            from: vi.fn().mockImplementation(() => ({
              where: vi.fn().mockImplementation(() => {
                selectCallIndex++;
                // First select: cash discount lookup - return discount
                if (selectCallIndex === 1) {
                  return { limit: vi.fn().mockResolvedValue([cashDiscountData]) };
                }
                // Second select: cascade adjustments - return empty
                if (selectCallIndex === 2) {
                  return [];
                }
                // Third select: discount type lookup - return discount type ID
                if (selectCallIndex === 3) {
                  return { limit: vi.fn().mockResolvedValue([{ id: "dtype-1" }]) };
                }
                return { limit: vi.fn().mockResolvedValue([]) };
              }),
            })),
          })),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (recalcAssessmentTotalsForDiscount as Mock).mockResolvedValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Voiding payment with cash discount",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      // Verify the discount recalculation was called
      expect(recalcAssessmentTotalsForDiscount).toHaveBeenCalled();
    });

    it("should NOT attempt discount reversal when payment had no cash discount", async () => {
      let discountReversalCalled = false;

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No cash discount
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (recalcAssessmentTotalsForDiscount as Mock).mockImplementation(async () => {
          discountReversalCalled = true;
        });
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Voiding payment without discount",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(discountReversalCalled).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Cascade Adjustment Reversal Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Cascade Adjustment Reversal", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Voiding with cascade" },
      });
    });

    it("should reverse cascade adjustments when cash discount had them", async () => {
      // This test verifies that cascade reversal is triggered when cash discount with cascades is voided
      // The complex cascade calculation is tested in dedicated cascade-calculations tests

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const cashDiscountData = {
          id: validUuids.cashDiscount,
          discountAmount: "10000.00",
          assessmentItemId: "discount-item-1",
        };

        const cascadeAdjustments = [
          {
            studentDiscountId: validUuids.cascadeDiscount,
            cascadeAdjustmentAmount: "2000.00",
            assessmentItemId: "cascade-item-1",
          },
        ];

        let selectCallCount = 0;
        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockImplementation(() => ({
            from: vi.fn().mockImplementation(() => ({
              where: vi.fn().mockImplementation(() => {
                selectCallCount++;
                if (selectCallCount === 1) {
                  // Cash discount lookup
                  return { limit: vi.fn().mockResolvedValue([cashDiscountData]) };
                } else if (selectCallCount === 2) {
                  // Cascade adjustments lookup - return array directly
                  return cascadeAdjustments;
                } else if (selectCallCount === 3) {
                  // Cascade items lookup
                  return [{ id: "cascade-item-1" }];
                } else if (selectCallCount === 4) {
                  // Discount type lookup
                  return { limit: vi.fn().mockResolvedValue([{ id: "dtype-1" }]) };
                }
                return { limit: vi.fn().mockResolvedValue([]) };
              }),
            })),
          })),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (reverseCascadeAdjustment as Mock).mockResolvedValue(undefined);
        (recalcAssessmentTotalsForDiscount as Mock).mockResolvedValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Voiding payment with cascade adjustments",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      // Verify cascade reversal utility was called
      expect(reverseCascadeAdjustment).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Audit Logging Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Audit Logging", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Audit test reason" },
      });
    });

    it("should create audit log entry for payment void", async () => {
      let auditCalled = false;
      let auditAction = "";

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 5000 });
        (logAudit as Mock).mockImplementation(async (params) => {
          auditCalled = true;
          auditAction = params.action;
        });

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Testing audit logging",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(auditCalled).toBe(true);
      expect(auditAction).toBe("payment_voided");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Error test reason" },
      });
    });

    it("should handle database errors gracefully", async () => {
      (db.transaction as Mock).mockRejectedValue(new Error("Database connection failed"));

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Testing error handling",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("Database connection failed");
    });

    it("should return specific error message when provided", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
        };

        (assertNoPendingCancellation as Mock).mockRejectedValue(
          new Error("Specific error: cannot void during cancellation")
        );

        await callback(mockTx);
      });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Testing specific error",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.message).toContain("cannot void during cancellation");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Success Scenario Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Successful Void", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: validUuids.payment, voidReason: "Customer refund request" },
      });
    });

    it("should return success message when void completes", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(createMockPayment());
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({ enrollmentId: validUuids.enrollment }),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };

        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue(createMockAssessment());
        (assertAssessmentNotTransferred as Mock).mockReturnValue(undefined);
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 5000 });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: validUuids.assessment });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Customer requested refund",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Payment voided successfully.");
    });

    it("should handle payment without assessment gracefully", async () => {
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue(
          createMockPayment({ assessmentId: null })
        );
        (assertStudentMutable as Mock).mockResolvedValue(undefined);

        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: null });

      const formData = createFormData({
        paymentId: validUuids.payment,
        voidReason: "Orphan payment void",
      });

      const result = await voidPaymentAction({}, formData);

      expect(result.success).toBe(true);
    });
  });
});
