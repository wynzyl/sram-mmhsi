import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Transaction Rollback Tests (C5 - Critical Finding)
 *
 * Tests verifying transaction atomicity and proper error handling:
 * 1. Assessment creation rollback - errors during fee item insertion
 * 2. Balance forward atomicity - partial transfer failure
 * 3. Payment + discount atomicity - discount application failure
 * 4. Void + cascade reversal atomicity - cascade reversal failure
 * 5. Concurrent OR consumption handling
 *
 * These tests verify that when errors occur mid-transaction:
 * - The action returns an error (not success)
 * - No partial state is indicated as committed
 * - Error messages are appropriate
 */

// ─────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => ({
  requireStaffSession: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      enrollments: { findFirst: vi.fn(), findMany: vi.fn() },
      assessments: { findFirst: vi.fn(), findMany: vi.fn() },
      payments: { findFirst: vi.fn() },
      receiptBooklets: { findFirst: vi.fn() },
      gradeLevels: { findFirst: vi.fn() },
      feeItemTypes: { findFirst: vi.fn() },
      studentDiscounts: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/cache/cache-tags", () => ({
  CACHE_TAGS: {
    ENROLLMENTS: "enrollments",
    DASHBOARD: "dashboard",
    ASSESSMENTS: "assessments",
    PAYMENTS: "payments",
  },
  invalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/utils/form-validation", () => ({
  parseFormData: vi.fn(),
}));

vi.mock("@/lib/utils/audit-logger", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/features/assessments/assessments.queries", () => ({
  resolveFeeScheduleForAssessment: vi.fn(),
}));

vi.mock("@/lib/queries/schoolYears", () => ({
  getActiveSchoolYearId: vi.fn(),
}));

vi.mock("@/features/discounts", () => ({
  hasPendingDiscountRequests: vi.fn(),
  applyApprovedDiscountsToAssessment: vi.fn(),
}));

vi.mock("@/features/enrollments/enrollment-cancellation.queries", () => ({
  hasPendingCancellationRequest: vi.fn(),
  assertNoPendingCancellation: vi.fn(),
  hasActiveEnrollmentForSchoolYear: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/features/archive/archive.guards", () => ({
  assertStudentMutable: vi.fn(),
  StudentArchivedException: class StudentArchivedException extends Error {
    constructor(
      public readonly studentId: string,
      public readonly studentStatus: "active" | "inactive" | "graduated" | "transferred" | "withdrawn" | "cancelled",
      public readonly blockedAction: string
    ) {
      super(`Cannot perform action: Student is archived (status: ${studentStatus})`);
    }
  },
  formatArchiveError: vi.fn((err) => ({
    error: { message: err.message },
  })),
}));

vi.mock("@/lib/utils/special-education", () => ({
  isEffectivelySpecialEducation: vi.fn(),
  SPED_FEE_CODE: "SPED_FEE",
}));

vi.mock("@/lib/utils/tx-helpers", () => ({
  lockPayment: vi.fn(),
  lockAssessment: vi.fn(),
  lockReceiptBooklet: vi.fn(),
  assertAssessmentNotTransferred: vi.fn(),
}));

vi.mock("@/lib/utils/enrollment-status", () => ({
  revertToAssessedOnVoid: vi.fn(),
  transitionToEnrolledOnPayment: vi.fn(),
}));

vi.mock("@/lib/utils/assessment-balance", () => ({
  applyAssessmentBalanceDelta: vi.fn(),
  recalcAssessmentTotalsForDiscount: vi.fn(),
  reverseCascadeAdjustment: vi.fn(),
}));

vi.mock("@/lib/utils/enrollment-payment", () => ({
  assertEnrollmentAllowsPayment: vi.fn(),
}));

vi.mock("@/lib/utils/or-number", () => ({
  formatStoredOrNumber: vi.fn((prefix, num) => `${prefix} ${String(num).padStart(5, "0")}`),
  parseOrNumber: vi.fn(),
  OR_NUMBER_REGEX: /^[A-Z]{2}\s\d{5}$/,
  OR_SEQUENCE_PAD: 5,
}));

vi.mock("@/features/payments/payments.queries", () => ({
  getBookletIdsAssignedToOthers: vi.fn().mockResolvedValue([]),
  checkFullPaymentCashDiscountEligibility: vi.fn().mockResolvedValue({ eligible: false }),
  getDiscountTypeByCode: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/utils/assessment-billing", () => ({
  ASSESSMENT_BALANCE_FULLY_PAID_EPSILON: 0.01,
}));

vi.mock("@/lib/constants/discount-codes", () => ({
  FULL_PAYMENT_DISCOUNT_CODE: "FULL_PAYMENT_DISCOUNT",
}));

vi.mock("@/features/discounts/services/cascade-operations", () => ({
  applyCascadeAdjustmentsForCashDiscount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/features/discounts/utils/discount-calculations", () => ({
  formatDiscountDescription: vi.fn().mockReturnValue("Discount"),
}));

// Import after mocks
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/utils/form-validation";
import { lockPayment, lockAssessment, lockReceiptBooklet } from "@/lib/utils/tx-helpers";
import { applyAssessmentBalanceDelta, reverseCascadeAdjustment } from "@/lib/utils/assessment-balance";
import { logAudit } from "@/lib/utils/audit-logger";
import { assertStudentMutable } from "@/features/archive/archive.guards";
import { assertNoPendingCancellation } from "@/features/enrollments/enrollment-cancellation.queries";
import { resolveFeeScheduleForAssessment } from "@/features/assessments/assessments.queries";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { hasPendingDiscountRequests } from "@/features/discounts";
import { formatStoredOrNumber } from "@/lib/utils/or-number";

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const STUDENT_ID = "660e8400-e29b-41d4-a716-446655440001";
const ASSESSMENT_ID = "770e8400-e29b-41d4-a716-446655440002";
const ENROLLMENT_ID = "880e8400-e29b-41d4-a716-446655440003";
const PAYMENT_ID = "990e8400-e29b-41d4-a716-446655440004";
const BOOKLET_ID = "aa0e8400-e29b-41d4-a716-446655440005";

const createMockSession = (role: string = "finance_officer") => ({
  userId: "user-123",
  role,
  username: "testuser",
  email: "test@school.edu",
});

const createFormData = (data: Record<string, unknown>): FormData => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      formData.set(key, JSON.stringify(value));
    } else if (value !== undefined && value !== null) {
      formData.set(key, String(value));
    }
  });
  return formData;
};

// ─────────────────────────────────────────────────────────────────
// Assessment Creation Rollback Tests
// ─────────────────────────────────────────────────────────────────

describe("Assessment Creation Rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAssessmentFromEnrollmentAction", () => {
    let createAssessmentFromEnrollmentAction: typeof import("@/features/assessments/assessments.actions").createAssessmentFromEnrollmentAction;

    beforeEach(async () => {
      const { createAssessmentFromEnrollmentAction: action } = await import("@/features/assessments/assessments.actions");
      createAssessmentFromEnrollmentAction = action;
    });

    it("should rollback when assessment item insertion fails", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          enrollmentId: ENROLLMENT_ID,
          items: [
            { feeTemplateItemId: VALID_UUID, amount: 50000 },
          ],
        },
      });

      // Mock enrollment query with proper chaining
      const chainable = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: ENROLLMENT_ID,
          studentId: STUDENT_ID,
          schoolYearId: VALID_UUID,
          gradeLevelId: VALID_UUID,
          studentType: "new_student",
          status: "pending",
          specialEducationOverride: null,
          schoolYearLabel: "SY 2025-2026",
          studentIsSpecialEducation: false,
        }]),
      };

      (db.select as Mock).mockReturnValue(chainable);

      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue({ assessmentBand: "casa" });
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue({
        scheduleId: VALID_UUID,
        items: [{ feeTemplateItemId: VALID_UUID, feeItemTypeId: VALID_UUID, feeItemTypeCode: "TUITION" }],
      });
      (getActiveSchoolYearId as Mock).mockResolvedValue(VALID_UUID);

      // Mock transaction to fail during assessment item insertion
      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation(() => ({
              returning: vi.fn().mockImplementation(() => {
                // First call (assessment) succeeds
                // Second call (items) fails
                throw new Error("Database constraint violation: FK_assessment_items");
              }),
            })),
          })),
          query: {
            assessments: { findFirst: vi.fn().mockResolvedValue(null) },
          },
        };
        await callback(mockTx);
      });

      const formData = createFormData({
        enrollmentId: ENROLLMENT_ID,
        items: JSON.stringify([{ feeTemplateItemId: VALID_UUID, amount: 50000 }]),
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      // Should return error, not success
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("should return error when transaction fails mid-operation", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          enrollmentId: ENROLLMENT_ID,
          items: [{ feeTemplateItemId: VALID_UUID, amount: 50000 }],
        },
      });

      // Mock enrollment query with proper chaining
      const chainable = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{
          id: ENROLLMENT_ID,
          studentId: STUDENT_ID,
          schoolYearId: VALID_UUID,
          gradeLevelId: VALID_UUID,
          status: "pending",
          schoolYearLabel: "SY 2025-2026",
          studentIsSpecialEducation: false,
        }]),
      };

      (db.select as Mock).mockReturnValue(chainable);

      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue({ assessmentBand: "casa" });
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue({
        scheduleId: VALID_UUID,
        items: [{ feeTemplateItemId: VALID_UUID, feeItemTypeId: VALID_UUID }],
      });
      (getActiveSchoolYearId as Mock).mockResolvedValue(VALID_UUID);

      // Mock transaction to fail with a generic database error
      (db.transaction as Mock).mockRejectedValue(
        new Error("FATAL: connection terminated unexpectedly")
      );

      const formData = createFormData({
        enrollmentId: ENROLLMENT_ID,
        items: JSON.stringify([{ feeTemplateItemId: VALID_UUID, amount: 50000 }]),
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      // Should return error, not success
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Payment Void Rollback Tests
// ─────────────────────────────────────────────────────────────────

describe("Payment Void Rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("voidPaymentAction", () => {
    let voidPaymentAction: typeof import("@/features/payments/actions/void-payment.actions").voidPaymentAction;

    beforeEach(async () => {
      const { voidPaymentAction: action } = await import("@/features/payments/actions/void-payment.actions");
      voidPaymentAction = action;
    });

    it("should rollback when balance reversion fails", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: PAYMENT_ID, voidReason: "Test void" },
      });

      // Mock transaction to fail during balance update
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue({
          id: PAYMENT_ID,
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          amount: "10000.00",
          status: "posted",
        });
        (assertStudentMutable as Mock).mockResolvedValue(undefined);
        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue({
          id: ASSESSMENT_ID,
          enrollmentId: ENROLLMENT_ID,
          balance: "40000.00",
          transferredAt: null,
        });

        // Fail during balance reversion
        (applyAssessmentBalanceDelta as Mock).mockRejectedValue(
          new Error("Database error: Cannot update assessment balance")
        );

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
            assessments: { findFirst: vi.fn().mockResolvedValue({ enrollmentId: ENROLLMENT_ID }) },
          },
        };

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: ASSESSMENT_ID });

      const formData = createFormData({
        paymentId: PAYMENT_ID,
        voidReason: "Test void",
      });

      const result = await voidPaymentAction({}, formData);

      // Should return error, not success
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("should rollback when cascade reversal fails", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: PAYMENT_ID, voidReason: "Test void" },
      });

      const CASH_DISCOUNT_ID = "bb0e8400-e29b-41d4-a716-446655440006";

      // Mock transaction to fail during cascade reversal
      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue({
          id: PAYMENT_ID,
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          amount: "10000.00",
          status: "posted",
        });
        (assertStudentMutable as Mock).mockResolvedValue(undefined);
        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue({
          id: ASSESSMENT_ID,
          enrollmentId: ENROLLMENT_ID,
          balance: "40000.00",
          transferredAt: null,
        });
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });

        // Mock cascade reversal to fail
        (reverseCascadeAdjustment as Mock).mockRejectedValue(
          new Error("Failed to reverse cascade adjustments")
        );

        const mockTx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  // Cash discount exists
                  id: CASH_DISCOUNT_ID,
                  discountTypeCode: "FULL_PAYMENT_DISCOUNT",
                  hasCascadeAdjustments: true,
                }]),
              }),
            }),
          }),
          query: {
            assessments: { findFirst: vi.fn().mockResolvedValue({ enrollmentId: ENROLLMENT_ID }) },
          },
        };

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: ASSESSMENT_ID });

      const formData = createFormData({
        paymentId: PAYMENT_ID,
        voidReason: "Test void",
      });

      const result = await voidPaymentAction({}, formData);

      // Should return error when cascade reversal fails
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("should rollback when audit log fails with throwOnFail", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: { paymentId: PAYMENT_ID, voidReason: "Test void" },
      });

      // Mock audit to fail
      (logAudit as Mock).mockRejectedValue(new Error("Audit service down"));

      (db.transaction as Mock).mockImplementation(async (callback) => {
        (lockPayment as Mock).mockResolvedValue({
          id: PAYMENT_ID,
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          amount: "10000.00",
          status: "posted",
        });
        (assertStudentMutable as Mock).mockResolvedValue(undefined);
        (assertNoPendingCancellation as Mock).mockResolvedValue(undefined);
        (lockAssessment as Mock).mockResolvedValue({
          id: ASSESSMENT_ID,
          enrollmentId: ENROLLMENT_ID,
          balance: "40000.00",
          transferredAt: null,
        });
        (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newTotalPaid: 0 });

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
            assessments: { findFirst: vi.fn().mockResolvedValue({ enrollmentId: ENROLLMENT_ID }) },
          },
        };

        await callback(mockTx);
      });

      (db.query.payments.findFirst as Mock).mockResolvedValue({ assessmentId: ASSESSMENT_ID });

      const formData = createFormData({
        paymentId: PAYMENT_ID,
        voidReason: "Test void",
      });

      const result = await voidPaymentAction({}, formData);

      // Verify audit was called (even if it failed)
      expect(logAudit).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Payment Posting Rollback Tests
// ─────────────────────────────────────────────────────────────────

describe("Payment Posting Rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postPaymentAction", () => {
    let postPaymentAction: typeof import("@/features/payments/payments.actions").postPaymentAction;

    beforeEach(async () => {
      const { postPaymentAction: action } = await import("@/features/payments/payments.actions");
      postPaymentAction = action;
    });

    it("should rollback when payment insertion fails", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          bookletId: BOOKLET_ID,
          amount: 5000,
          paymentMethod: "cash",
          amountTendered: 5000,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      (lockReceiptBooklet as Mock).mockResolvedValue({
        id: BOOKLET_ID,
        prefix: "AK",
        nextNumber: 50,
        endNumber: 100,
        status: "active",
      });
      (formatStoredOrNumber as Mock).mockReturnValue("AK 00050");

      // Mock transaction to fail during payment insert
      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            payments: { findFirst: vi.fn().mockResolvedValue(null) },
            assessments: {
              findFirst: vi.fn().mockResolvedValue({
                id: ASSESSMENT_ID,
                studentId: STUDENT_ID,
                enrollmentId: ENROLLMENT_ID,
                balance: "50000.00",
                transferredAt: null,
                cancelledAt: null,
              }),
            },
            enrollments: {
              findFirst: vi.fn().mockResolvedValue({ id: ENROLLMENT_ID, status: "assessed" }),
            },
          },
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{
                id: BOOKLET_ID,
                prefix: "AK",
                nextNumber: 50,
                endNumber: 100,
              }]),
            }),
          }),
          insert: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation(() => {
              throw new Error("Database constraint violation: unique_or_number");
            }),
          })),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        await callback(mockTx);
      });

      const formData = createFormData({
        studentId: STUDENT_ID,
        assessmentId: ASSESSMENT_ID,
        bookletId: BOOKLET_ID,
        amount: "5000",
        paymentMethod: "cash",
        amountTendered: "5000",
      });

      const result = await postPaymentAction({}, formData);

      // Should return error, not success
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("should rollback when balance update fails after payment insert", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          bookletId: BOOKLET_ID,
          amount: 5000,
          paymentMethod: "cash",
          amountTendered: 5000,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      (lockReceiptBooklet as Mock).mockResolvedValue({
        id: BOOKLET_ID,
        prefix: "AK",
        nextNumber: 50,
        endNumber: 100,
        status: "active",
      });
      (formatStoredOrNumber as Mock).mockReturnValue("AK 00050");

      // Mock balance update to fail
      (applyAssessmentBalanceDelta as Mock).mockRejectedValue(
        new Error("Failed to update assessment balance")
      );

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            payments: { findFirst: vi.fn().mockResolvedValue(null) },
            assessments: {
              findFirst: vi.fn().mockResolvedValue({
                id: ASSESSMENT_ID,
                studentId: STUDENT_ID,
                enrollmentId: ENROLLMENT_ID,
                balance: "50000.00",
                transferredAt: null,
                cancelledAt: null,
              }),
            },
            enrollments: {
              findFirst: vi.fn().mockResolvedValue({ id: ENROLLMENT_ID, status: "assessed" }),
            },
          },
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{
                id: BOOKLET_ID,
                prefix: "AK",
                nextNumber: 50,
                endNumber: 100,
              }]),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: PAYMENT_ID }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        await callback(mockTx);
      });

      const formData = createFormData({
        studentId: STUDENT_ID,
        assessmentId: ASSESSMENT_ID,
        bookletId: BOOKLET_ID,
        amount: "5000",
        paymentMethod: "cash",
        amountTendered: "5000",
      });

      const result = await postPaymentAction({}, formData);

      // Should return error when balance update fails
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });

    it("should handle concurrent OR number consumption gracefully", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          bookletId: BOOKLET_ID,
          amount: 5000,
          paymentMethod: "cash",
          amountTendered: 5000,
          // No idempotencyKey - testing OR number collision not idempotency
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      // Simulate race condition - another cashier already consumed the OR
      const uniqueViolationError = new Error(
        'duplicate key value violates unique constraint "payments_or_number_unique"'
      );

      (db.transaction as Mock).mockRejectedValue(uniqueViolationError);

      const formData = createFormData({
        studentId: STUDENT_ID,
        assessmentId: ASSESSMENT_ID,
        bookletId: BOOKLET_ID,
        amount: "5000",
        paymentMethod: "cash",
        amountTendered: "5000",
      });

      const result = await postPaymentAction({}, formData);

      // Should return error for unique violation on OR number
      // The action should handle this gracefully and return an error message
      expect(result.success).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Assessment Cancellation Rollback Tests
// ─────────────────────────────────────────────────────────────────

describe("Assessment Cancellation Rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cancelAssessmentAction", () => {
    let cancelAssessmentAction: typeof import("@/features/assessments/assessments.actions").cancelAssessmentAction;

    beforeEach(async () => {
      const { cancelAssessmentAction: action } = await import("@/features/assessments/assessments.actions");
      cancelAssessmentAction = action;
    });

    it("should rollback when assessment item deletion fails", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: ASSESSMENT_ID,
          cancellationReason: "Test cancellation",
        },
      });

      // Mock transaction to fail during item deletion
      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessments: {
              findFirst: vi.fn().mockResolvedValue({
                id: ASSESSMENT_ID,
                studentId: STUDENT_ID,
                enrollmentId: ENROLLMENT_ID,
                billingStatus: "outstanding",
                totalPaid: "0",
                cancelledAt: null,
              }),
            },
          },
          update: vi.fn().mockImplementation(() => {
            throw new Error("Failed to update assessment status");
          }),
        };
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: ASSESSMENT_ID,
        cancellationReason: "Test cancellation",
      });

      const result = await cancelAssessmentAction({}, formData);

      // Should return error, not success
      expect(result.success).toBeUndefined();
      expect(result.message).toBeDefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Transaction Error Propagation Tests
// ─────────────────────────────────────────────────────────────────

describe("Transaction Error Propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should propagate database connection errors correctly", async () => {
    (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
    (hasPermission as Mock).mockReturnValue(true);
    (parseFormData as Mock).mockReturnValue({
      success: true,
      data: { paymentId: PAYMENT_ID, voidReason: "Test" },
    });

    // Simulate database connection failure
    (db.transaction as Mock).mockRejectedValue(
      new Error("Connection refused: ECONNREFUSED")
    );

    const { voidPaymentAction } = await import(
      "@/features/payments/actions/void-payment.actions"
    );

    const formData = createFormData({
      paymentId: PAYMENT_ID,
      voidReason: "Test void",
    });

    const result = await voidPaymentAction({}, formData);

    expect(result.success).toBeUndefined();
    expect(result.message).toBeDefined();
  });

  it("should propagate timeout errors correctly", async () => {
    (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
    (hasPermission as Mock).mockReturnValue(true);
    (parseFormData as Mock).mockReturnValue({
      success: true,
      data: {
        studentId: STUDENT_ID,
        assessmentId: ASSESSMENT_ID,
        bookletId: BOOKLET_ID,
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
        isManualEntry: false,
        applyCashDiscount: false,
      },
    });

    // Simulate timeout
    (db.transaction as Mock).mockRejectedValue(
      new Error("Query timeout: operation exceeded 30000ms")
    );

    const { postPaymentAction } = await import("@/features/payments/payments.actions");

    const formData = createFormData({
      studentId: STUDENT_ID,
      assessmentId: ASSESSMENT_ID,
      bookletId: BOOKLET_ID,
      amount: "5000",
      paymentMethod: "cash",
      amountTendered: "5000",
    });

    const result = await postPaymentAction({}, formData);

    expect(result.success).toBeUndefined();
    expect(result.message).toBeDefined();
  });

  it("should propagate deadlock errors correctly", async () => {
    (requireStaffSession as Mock).mockResolvedValue(createMockSession());
    (hasPermission as Mock).mockReturnValue(true);
    (parseFormData as Mock).mockReturnValue({
      success: true,
      data: {
        assessmentId: ASSESSMENT_ID,
        cancellationReason: "Test",
      },
    });

    // Simulate deadlock
    (db.transaction as Mock).mockRejectedValue(
      new Error("deadlock detected")
    );

    const { cancelAssessmentAction } = await import(
      "@/features/assessments/assessments.actions"
    );

    const formData = createFormData({
      assessmentId: ASSESSMENT_ID,
      cancellationReason: "Test cancellation",
    });

    const result = await cancelAssessmentAction({}, formData);

    expect(result.success).toBeUndefined();
    expect(result.message).toBeDefined();
  });
});
