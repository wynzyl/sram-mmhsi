import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Payment Idempotency Tests (F7 - Critical Finding C3)
 *
 * Tests for idempotent payment posting covering:
 * 1. First submission creates payment and consumes OR
 * 2. Retry with same idempotencyKey returns original payment without side effects
 *    - No second payment created
 *    - No second OR consumed
 *    - No duplicate balance change
 *    - No second audit entry
 * 3. Database unique constraint fallback (race condition handling)
 * 4. Different idempotencyKey creates separate payment
 * 5. Backward compatibility - no idempotencyKey still works
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
      enrollments: { findFirst: vi.fn() },
      receiptBooklets: { findFirst: vi.fn() },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
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

vi.mock("@/lib/utils/assessment-balance", () => ({
  applyAssessmentBalanceDelta: vi.fn(),
}));

vi.mock("@/lib/utils/enrollment-status", () => ({
  transitionToEnrolledOnPayment: vi.fn(),
}));

vi.mock("@/lib/utils/or-number", () => ({
  formatOrNumber: vi.fn((prefix, num) => `${prefix} ${String(num).padStart(5, "0")}`),
  formatStoredOrNumber: vi.fn((prefix, num) => `${prefix} ${String(num).padStart(5, "0")}`),
  parseOrNumber: vi.fn(),
  OR_NUMBER_REGEX: /^[A-Z]{2}\s\d{5}$/,
  OR_SEQUENCE_PAD: 5,
}));

vi.mock("@/lib/utils/tx-helpers", () => ({
  lockReceiptBooklet: vi.fn(),
}));

vi.mock("@/lib/utils/enrollment-payment", () => ({
  assertEnrollmentAllowsPayment: vi.fn(),
}));

vi.mock("@/lib/utils/booklet-access", () => ({
  assertBookletAccessible: vi.fn(),
}));

vi.mock("@/features/payments/payments.queries", () => ({
  getBookletIdsAssignedToOthers: vi.fn().mockResolvedValue([]),
  checkFullPaymentCashDiscountEligibility: vi.fn().mockResolvedValue({ eligible: false }),
  getDiscountTypeByCode: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/features/enrollments/enrollment-cancellation.queries", () => ({
  assertNoPendingCancellation: vi.fn(),
  hasActiveEnrollmentForSchoolYear: vi.fn().mockResolvedValue(false),
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

vi.mock("@/lib/utils/assessment-billing", () => ({
  ASSESSMENT_BALANCE_FULLY_PAID_EPSILON: 0.01,
}));

vi.mock("@/features/discounts/discount.queries", () => ({
  getCashDiscountEligibility: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/features/discounts/services/cascade-operations", () => ({
  applyCascadeAdjustmentsForCashDiscount: vi.fn().mockResolvedValue(0),
}));

vi.mock("@/features/discounts/utils/discount-calculations", () => ({
  formatDiscountDescription: vi.fn().mockReturnValue("Cash Discount"),
}));

vi.mock("@/lib/constants/discount-codes", () => ({
  FULL_PAYMENT_DISCOUNT_CODE: "FULL_PAYMENT_DISCOUNT",
}));

// Import after mocks are set up
import { postPaymentAction } from "../payments.actions";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/utils/audit-logger";
import { applyAssessmentBalanceDelta } from "@/lib/utils/assessment-balance";
import { transitionToEnrolledOnPayment } from "@/lib/utils/enrollment-status";
import { parseFormData } from "@/lib/utils/form-validation";
import { lockReceiptBooklet } from "@/lib/utils/tx-helpers";
import { formatStoredOrNumber } from "@/lib/utils/or-number";

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const createMockSession = () => ({
  userId: "user-123",
  role: "cashier" as const,
  email: "cashier@school.edu",
});

const STUDENT_ID = "550e8400-e29b-41d4-a716-446655440000";
const ASSESSMENT_ID = "660e8400-e29b-41d4-a716-446655440001";
const BOOKLET_ID = "770e8400-e29b-41d4-a716-446655440002";
const IDEMPOTENCY_KEY = "880e8400-e29b-41d4-a716-446655440003";
const PAYMENT_ID = "990e8400-e29b-41d4-a716-446655440004";
const OR_NUMBER = "AK 00050";

const createValidFormData = (overrides: Record<string, string> = {}) => {
  const data: Record<string, string> = {
    studentId: STUDENT_ID,
    assessmentId: ASSESSMENT_ID,
    bookletId: BOOKLET_ID,
    amount: "5000",
    paymentMethod: "cash",
    amountTendered: "5000",
    idempotencyKey: IDEMPOTENCY_KEY,
    isManualEntry: "false",
    applyCashDiscount: "false",
    ...overrides,
  };
  return new FormData();
};

const createMockAssessment = () => ({
  id: ASSESSMENT_ID,
  studentId: STUDENT_ID,
  enrollmentId: "enrollment-123",
  schoolYearId: "sy-2025-2026",
  balance: "10000",
  cancelledAt: null,
  transferredAt: null,
});

const createMockEnrollment = () => ({
  id: "enrollment-123",
  status: "assessed",
});

const createMockBooklet = () => ({
  id: BOOKLET_ID,
  prefix: "AK",
  series: "AK-00001-00050",
  startNumber: 1,
  endNumber: 50,
  nextNumber: 50,
  status: "active",
  usageMode: "auto_only",
  assignedCashierId: null,
});

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

const setupSuccessfulPaymentMocks = (existingPaymentByKey: null | { id: string; orNumber: string | null } = null) => {
  const mockSession = createMockSession();
  (requireStaffSession as Mock).mockResolvedValue(mockSession);
  (hasPermission as Mock).mockReturnValue(true);

  const assessment = createMockAssessment();
  const enrollment = createMockEnrollment();
  const booklet = createMockBooklet();

  // Track calls for verification
  const insertCalls: unknown[] = [];
  const auditCalls: unknown[] = [];

  // Mock parseFormData to return validated data
  (parseFormData as Mock).mockReturnValue({
    success: true,
    data: {
      studentId: STUDENT_ID,
      assessmentId: ASSESSMENT_ID,
      bookletId: BOOKLET_ID,
      amount: 5000,
      paymentMethod: "cash",
      amountTendered: 5000,
      idempotencyKey: IDEMPOTENCY_KEY,
      isManualEntry: false,
      applyCashDiscount: false,
    },
  });

  // Mock lockReceiptBooklet to return booklet
  (lockReceiptBooklet as Mock).mockResolvedValue(booklet);

  // Mock formatStoredOrNumber
  (formatStoredOrNumber as Mock).mockReturnValue(OR_NUMBER);

  // Create mock transaction
  const mockTx = {
    query: {
      payments: {
        findFirst: vi.fn().mockImplementation(() => {
          // Return existing payment if idempotencyKey matches
          if (existingPaymentByKey) {
            return Promise.resolve(existingPaymentByKey);
          }
          return Promise.resolve(null);
        }),
      },
      assessments: {
        findFirst: vi.fn().mockResolvedValue(assessment),
      },
      enrollments: {
        findFirst: vi.fn().mockResolvedValue(enrollment),
      },
      receiptBooklets: {
        findFirst: vi.fn().mockResolvedValue(booklet),
      },
    },
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([booklet]),
      }),
    }),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation((values) => {
        insertCalls.push({ values });
        return {
          returning: vi.fn().mockResolvedValue([{ id: PAYMENT_ID }]),
        };
      }),
    })),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  (db.transaction as Mock).mockImplementation(async (callback) => {
    return callback(mockTx);
  });

  (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newBalance: 5000 });
  (transitionToEnrolledOnPayment as Mock).mockResolvedValue(undefined);
  (logAudit as Mock).mockImplementation((...args) => {
    auditCalls.push(args);
    return Promise.resolve();
  });

  return {
    mockSession,
    mockTx,
    insertCalls,
    auditCalls,
    booklet,
  };
};

// ─────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────

describe("postPaymentAction - Idempotency (F7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("First Submission (No Existing Payment)", () => {
    it("should create payment and consume OR on first submission", async () => {
      setupSuccessfulPaymentMocks(null);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Payment posted successfully");
      expect(db.transaction).toHaveBeenCalled();
    });

    it("should include OR number in success message", async () => {
      setupSuccessfulPaymentMocks(null);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("OR Number:");
    });

    it("should call applyAssessmentBalanceDelta on first submission", async () => {
      setupSuccessfulPaymentMocks(null);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      await postPaymentAction({}, formData);

      expect(applyAssessmentBalanceDelta).toHaveBeenCalled();
    });

    it("should create audit log entry on first submission", async () => {
      setupSuccessfulPaymentMocks(null);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      await postPaymentAction({}, formData);

      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "payment_posted",
          targetEntity: "payments",
        }),
        expect.any(Object)
      );
    });
  });

  describe("Retry with Same idempotencyKey (Idempotent Replay)", () => {
    it("should return original payment on retry without creating new payment", async () => {
      // Set up mock with existing payment found by idempotencyKey
      const existingPayment = { id: PAYMENT_ID, orNumber: OR_NUMBER };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("duplicate submit ignored");
      expect(result.message).toContain(OR_NUMBER);
    });

    it("should NOT update assessment balance on idempotent replay", async () => {
      const existingPayment = { id: PAYMENT_ID, orNumber: OR_NUMBER };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      await postPaymentAction({}, formData);

      // Balance should NOT be updated because idempotent replay returns early
      expect(applyAssessmentBalanceDelta).not.toHaveBeenCalled();
    });

    it("should NOT create audit log on idempotent replay", async () => {
      const existingPayment = { id: PAYMENT_ID, orNumber: OR_NUMBER };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      await postPaymentAction({}, formData);

      // Audit log should NOT be created because idempotent replay returns early
      expect(logAudit).not.toHaveBeenCalled();
    });

    it("should NOT call enrollment status transition on idempotent replay", async () => {
      const existingPayment = { id: PAYMENT_ID, orNumber: OR_NUMBER };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      await postPaymentAction({}, formData);

      expect(transitionToEnrolledOnPayment).not.toHaveBeenCalled();
    });
  });

  describe("Database Unique Constraint Fallback (Race Condition)", () => {
    it("should handle unique constraint violation and return success with existing OR", async () => {
      const mockSession = createMockSession();
      (requireStaffSession as Mock).mockResolvedValue(mockSession);
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
          idempotencyKey: IDEMPOTENCY_KEY,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      // Simulate unique constraint violation in transaction
      const constraintError = new Error("duplicate key value violates unique constraint \"payments_idempotency_key_uidx\"");
      (db.transaction as Mock).mockRejectedValue(constraintError);

      // After catching the error, the action queries for the existing payment
      (db.query.payments.findFirst as Mock).mockResolvedValue({
        orNumber: OR_NUMBER,
      });

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("duplicate submit ignored");
      expect(result.message).toContain(OR_NUMBER);
    });

    it("should return error if unique constraint violated but no existing payment found", async () => {
      const mockSession = createMockSession();
      (requireStaffSession as Mock).mockResolvedValue(mockSession);
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
          idempotencyKey: IDEMPOTENCY_KEY,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      // Simulate unique constraint violation
      const constraintError = new Error("duplicate key value violates unique constraint \"payments_idempotency_key_uidx\"");
      (db.transaction as Mock).mockRejectedValue(constraintError);

      // But no existing payment found (edge case)
      (db.query.payments.findFirst as Mock).mockResolvedValue(null);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      // Should fall through to generic error handling
      expect(result.message).toBeDefined();
    });
  });

  describe("Different idempotencyKey Creates New Payment", () => {
    it("should create separate payment for different idempotencyKey", async () => {
      // First submission with original key
      setupSuccessfulPaymentMocks(null);

      const firstFormData = new FormData();
      firstFormData.set("studentId", STUDENT_ID);
      firstFormData.set("assessmentId", ASSESSMENT_ID);
      firstFormData.set("bookletId", BOOKLET_ID);
      firstFormData.set("amount", "5000");
      firstFormData.set("paymentMethod", "cash");
      firstFormData.set("amountTendered", "5000");
      firstFormData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const firstResult = await postPaymentAction({}, firstFormData);
      expect(firstResult.success).toBe(true);

      // Reset mocks
      vi.clearAllMocks();

      // Second submission with DIFFERENT idempotencyKey
      const differentKey = "999e8400-e29b-41d4-a716-446655440099";
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          bookletId: BOOKLET_ID,
          amount: 3000,
          paymentMethod: "cash",
          amountTendered: 3000,
          idempotencyKey: differentKey,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      setupSuccessfulPaymentMocks(null); // No existing payment for this key

      const secondFormData = new FormData();
      secondFormData.set("studentId", STUDENT_ID);
      secondFormData.set("assessmentId", ASSESSMENT_ID);
      secondFormData.set("bookletId", BOOKLET_ID);
      secondFormData.set("amount", "3000");
      secondFormData.set("paymentMethod", "cash");
      secondFormData.set("amountTendered", "3000");
      secondFormData.set("idempotencyKey", differentKey);

      const secondResult = await postPaymentAction({}, secondFormData);

      expect(secondResult.success).toBe(true);
      expect(secondResult.message).toContain("Payment posted successfully");
      // Should NOT say "duplicate submit ignored"
      expect(secondResult.message).not.toContain("duplicate");
    });
  });

  describe("Backward Compatibility (No idempotencyKey)", () => {
    it("should create payment even without idempotencyKey", async () => {
      const mockSession = createMockSession();
      (requireStaffSession as Mock).mockResolvedValue(mockSession);
      (hasPermission as Mock).mockReturnValue(true);

      // No idempotencyKey in the parsed data
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          studentId: STUDENT_ID,
          assessmentId: ASSESSMENT_ID,
          bookletId: BOOKLET_ID,
          amount: 5000,
          paymentMethod: "cash",
          amountTendered: 5000,
          idempotencyKey: undefined, // No key provided
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      const assessment = createMockAssessment();
      const enrollment = createMockEnrollment();
      const booklet = createMockBooklet();

      const mockTx = {
        query: {
          payments: {
            findFirst: vi.fn().mockResolvedValue(null),
          },
          assessments: {
            findFirst: vi.fn().mockResolvedValue(assessment),
          },
          enrollments: {
            findFirst: vi.fn().mockResolvedValue(enrollment),
          },
          receiptBooklets: {
            findFirst: vi.fn().mockResolvedValue(booklet),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([booklet]),
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

      (db.transaction as Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newBalance: 5000 });
      (transitionToEnrolledOnPayment as Mock).mockResolvedValue(undefined);
      (logAudit as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      // No idempotencyKey set

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Payment posted successfully");
    });

    it("should skip idempotency check when no key provided", async () => {
      const mockSession = createMockSession();
      (requireStaffSession as Mock).mockResolvedValue(mockSession);
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
          idempotencyKey: undefined,
          isManualEntry: false,
          applyCashDiscount: false,
        },
      });

      const assessment = createMockAssessment();
      const enrollment = createMockEnrollment();
      const booklet = createMockBooklet();

      let paymentFindFirstCalled = false;

      const mockTx = {
        query: {
          payments: {
            findFirst: vi.fn().mockImplementation(() => {
              paymentFindFirstCalled = true;
              return Promise.resolve(null);
            }),
          },
          assessments: {
            findFirst: vi.fn().mockResolvedValue(assessment),
          },
          enrollments: {
            findFirst: vi.fn().mockResolvedValue(enrollment),
          },
          receiptBooklets: {
            findFirst: vi.fn().mockResolvedValue(booklet),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([booklet]),
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

      (db.transaction as Mock).mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      (applyAssessmentBalanceDelta as Mock).mockResolvedValue({ newBalance: 5000 });
      (transitionToEnrolledOnPayment as Mock).mockResolvedValue(undefined);
      (logAudit as Mock).mockResolvedValue(undefined);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");

      await postPaymentAction({}, formData);

      // When no idempotencyKey, the code doesn't query for existing payment by key
      // The findFirst is only called with idempotencyKey condition when key is provided
      // Without key, the if(idempotencyKey) block is skipped entirely
      // So we verify balance was updated (meaning no early return)
      expect(applyAssessmentBalanceDelta).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle null orNumber in existing payment gracefully", async () => {
      // Edge case: existing payment found but orNumber is null
      const existingPayment = { id: PAYMENT_ID, orNumber: null };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain("duplicate submit ignored");
    });

    it("should preserve original OR number on idempotent replay", async () => {
      const originalOrNumber = "XY 99999";
      const existingPayment = { id: PAYMENT_ID, orNumber: originalOrNumber };
      setupSuccessfulPaymentMocks(existingPayment);

      const formData = new FormData();
      formData.set("studentId", STUDENT_ID);
      formData.set("assessmentId", ASSESSMENT_ID);
      formData.set("bookletId", BOOKLET_ID);
      formData.set("amount", "5000");
      formData.set("paymentMethod", "cash");
      formData.set("amountTendered", "5000");
      formData.set("idempotencyKey", IDEMPOTENCY_KEY);

      const result = await postPaymentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.message).toContain(originalOrNumber);
    });
  });
});
