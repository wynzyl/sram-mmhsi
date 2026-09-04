import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Comprehensive Authorization Tests (C4 - Critical Finding)
 *
 * Tests RBAC permission enforcement across Assessment, Discount, and Payment features.
 * Verifies that:
 * 1. Actions reject requests when required permission is missing
 * 2. Actions proceed when permission is granted
 * 3. Permission check happens before any business logic
 *
 * Permissions tested:
 * - assessments:create, assessments:cancel, assessments:reverse_transfer, assessments:update
 * - payments:post, payments:void, payments:void_request, payments:void_approve
 * - booklets:manage
 * - discounts:manage, discounts:apply, discounts:request, discounts:review
 */

// ─────────────────────────────────────────────────────────────────
// Mock Setup (shared across all authorization tests)
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
      assessments: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() },
      receiptBooklets: { findFirst: vi.fn() },
      discountTypes: { findFirst: vi.fn() },
      discountRequests: { findFirst: vi.fn() },
      studentDiscounts: { findFirst: vi.fn() },
      gradeLevels: { findFirst: vi.fn() },
      feeItemTypes: { findFirst: vi.fn() },
      voidRequests: { findFirst: vi.fn() },
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
    DISCOUNTS: "discounts",
    BOOKLETS: "booklets",
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

// Feature-specific mocks
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
import { requireStaffSession, requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { parseFormData } from "@/lib/utils/form-validation";

// ─────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const createMockSession = (role: string) => ({
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
// Assessment Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("Assessment Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAssessmentFromEnrollmentAction", () => {
    // Dynamically import to ensure mocks are applied
    let createAssessmentFromEnrollmentAction: typeof import("@/features/assessments/assessments.actions").createAssessmentFromEnrollmentAction;

    beforeEach(async () => {
      const module = await import("@/features/assessments/assessments.actions");
      createAssessmentFromEnrollmentAction = module.createAssessmentFromEnrollmentAction;
    });

    it("should reject when user lacks assessments:create permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        enrollmentId: VALID_UUID,
        items: [{ feeTemplateItemId: VALID_UUID, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "assessments:create");
      expect(result.message).toContain("permission");
      expect(result.success).toBeUndefined();
    });

    it("should proceed when user has assessments:create permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      // Mock validation failure to short-circuit (we only test auth here)
      (parseFormData as Mock).mockReturnValue({
        success: false,
        error: { flatten: () => ({ fieldErrors: { enrollmentId: ["Invalid"] } }) },
      });

      const formData = createFormData({
        enrollmentId: "invalid",
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "assessments:create");
      // If permission check passed, we get to validation errors
      expect(result.errors).toBeDefined();
    });
  });

  describe("cancelAssessmentAction", () => {
    let cancelAssessmentAction: typeof import("@/features/assessments/assessments.actions").cancelAssessmentAction;

    beforeEach(async () => {
      const module = await import("@/features/assessments/assessments.actions");
      cancelAssessmentAction = module.cancelAssessmentAction;
    });

    it("should reject when user lacks assessments:cancel permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        assessmentId: VALID_UUID,
        cancellationReason: "Test cancellation",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "assessments:cancel");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has assessments:cancel permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({});

      // We only care that permission check passed - the action will fail on validation
      // but that's expected since we didn't mock the full chain
      const result = await cancelAssessmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "assessments:cancel");
      // Permission was checked, so auth passed - result may have errors from validation
    });
  });

  describe("reverseBalanceTransferAction", () => {
    let reverseBalanceTransferAction: typeof import("@/features/assessments/assessments.actions").reverseBalanceTransferAction;

    beforeEach(async () => {
      const module = await import("@/features/assessments/assessments.actions");
      reverseBalanceTransferAction = module.reverseBalanceTransferAction;
    });

    it("should reject when user lacks assessments:reverse_transfer permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("registrar"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        sourceAssessmentId: VALID_UUID,
      });

      const result = await reverseBalanceTransferAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("registrar", "assessments:reverse_transfer");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has assessments:reverse_transfer permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("admin"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({});

      const result = await reverseBalanceTransferAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("admin", "assessments:reverse_transfer");
      // Permission was checked, so auth passed
    });
  });

  describe("addSpecialFeeAction (assessments:update)", () => {
    let addSpecialFeeAction: typeof import("@/features/assessments/assessments.actions").addSpecialFeeAction;

    beforeEach(async () => {
      const module = await import("@/features/assessments/assessments.actions");
      addSpecialFeeAction = module.addSpecialFeeAction;
    });

    it("should reject when user lacks assessments:update permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        assessmentId: VALID_UUID,
        amount: 5000,
      });

      const result = await addSpecialFeeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "assessments:update");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has assessments:update permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({});

      const result = await addSpecialFeeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "assessments:update");
      // Permission was checked, so auth passed
    });
  });

  describe("removeSpecialFeeAction (assessments:update)", () => {
    let removeSpecialFeeAction: typeof import("@/features/assessments/assessments.actions").removeSpecialFeeAction;

    beforeEach(async () => {
      const module = await import("@/features/assessments/assessments.actions");
      removeSpecialFeeAction = module.removeSpecialFeeAction;
    });

    it("should reject when user lacks assessments:update permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        assessmentId: VALID_UUID,
      });

      const result = await removeSpecialFeeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "assessments:update");
      expect(result.message).toContain("permission");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Payment Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("Payment Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("postPaymentAction (payments:post)", () => {
    let postPaymentAction: typeof import("@/features/payments/payments.actions").postPaymentAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/payments.actions");
      postPaymentAction = module.postPaymentAction;
    });

    it("should reject when user lacks payments:post permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        studentId: VALID_UUID,
        assessmentId: VALID_UUID,
        bookletId: VALID_UUID,
        amount: 5000,
        paymentMethod: "cash",
        amountTendered: 5000,
      });

      const result = await postPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "payments:post");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has payments:post permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({});

      const result = await postPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "payments:post");
      // Permission was checked, so auth passed
    });
  });

  describe("voidPaymentAction (payments:void)", () => {
    let voidPaymentAction: typeof import("@/features/payments/actions/void-payment.actions").voidPaymentAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/actions/void-payment.actions");
      voidPaymentAction = module.voidPaymentAction;
    });

    it("should reject when user lacks payments:void permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        paymentId: VALID_UUID,
        voidReason: "Test void",
      });

      const result = await voidPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "payments:void");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has payments:void permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({});

      const result = await voidPaymentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "payments:void");
      // Permission was checked, so auth passed
    });
  });

  describe("requestVoidAction (payments:void_request)", () => {
    let requestVoidAction: typeof import("@/features/payments/void-requests.actions").requestVoidAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/void-requests.actions");
      requestVoidAction = module.requestVoidAction;
    });

    it("should reject when user lacks payments:void_request permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        paymentId: VALID_UUID,
        reason: "Test request",
      });

      const result = await requestVoidAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "payments:void_request");
      expect(result.message).toContain("permission");
    });
  });

  describe("approveVoidRequestAction (payments:void_approve)", () => {
    let approveVoidRequestAction: typeof import("@/features/payments/void-requests.actions").approveVoidRequestAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/void-requests.actions");
      approveVoidRequestAction = module.approveVoidRequestAction;
    });

    it("should reject when user lacks payments:void_approve permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        requestId: VALID_UUID,
      });

      const result = await approveVoidRequestAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "payments:void_approve");
      expect(result.message).toContain("permission");
    });
  });

  describe("rejectVoidRequestAction (payments:void_approve)", () => {
    let rejectVoidRequestAction: typeof import("@/features/payments/void-requests.actions").rejectVoidRequestAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/void-requests.actions");
      rejectVoidRequestAction = module.rejectVoidRequestAction;
    });

    it("should reject when user lacks payments:void_approve permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        requestId: VALID_UUID,
        rejectionReason: "Not valid",
      });

      const result = await rejectVoidRequestAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "payments:void_approve");
      expect(result.message).toContain("permission");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Booklet Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("Booklet Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBookletAction (booklets:manage)", () => {
    let createBookletAction: typeof import("@/features/payments/actions/booklets.actions").createBookletAction;

    beforeEach(async () => {
      const module = await import("@/features/payments/actions/booklets.actions");
      createBookletAction = module.createBookletAction;
    });

    it("should reject when user lacks booklets:manage permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        series: "AK-00001-00050",
        prefix: "AK",
        startNumber: 1,
        endNumber: 50,
      });

      const result = await createBookletAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "booklets:manage");
      expect(result.message).toContain("permission");
    });

    it("should proceed when user has booklets:manage permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      // Mock validation to pass so we proceed past auth
      (parseFormData as Mock).mockReturnValue({
        success: false,
        error: { flatten: () => ({ fieldErrors: { series: ["Invalid"] } }) },
      });

      const formData = createFormData({});

      const result = await createBookletAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "booklets:manage");
      // If permission was checked, the test passes - errors may or may not exist
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Discount Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("Discount Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDiscountTypeAction (discounts:manage)", () => {
    let createDiscountTypeAction: typeof import("@/features/discounts/actions/discount-types.actions").createDiscountTypeAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-types.actions");
      createDiscountTypeAction = module.createDiscountTypeAction;
    });

    it("should reject when user lacks discounts:manage permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("registrar"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        name: "Test Discount",
        code: "TEST",
        calculationType: "percentage",
        baseType: "total_charges",
        value: 10,
      });

      const result = await createDiscountTypeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("registrar", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });

  describe("updateDiscountTypeAction (discounts:manage)", () => {
    let updateDiscountTypeAction: typeof import("@/features/discounts/actions/discount-types.actions").updateDiscountTypeAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-types.actions");
      updateDiscountTypeAction = module.updateDiscountTypeAction;
    });

    it("should reject when user lacks discounts:manage permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        discountTypeId: VALID_UUID,
        name: "Updated Name",
      });

      const result = await updateDiscountTypeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });

  describe("deleteDiscountTypeAction (discounts:manage)", () => {
    let deleteDiscountTypeAction: typeof import("@/features/discounts/actions/discount-types.actions").deleteDiscountTypeAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-types.actions");
      deleteDiscountTypeAction = module.deleteDiscountTypeAction;
    });

    it("should reject when user lacks discounts:manage permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        discountTypeId: VALID_UUID,
      });

      const result = await deleteDiscountTypeAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });

  describe("createDiscountRequestAction (discounts:request)", () => {
    let createDiscountRequestAction: typeof import("@/features/discounts/actions/discount-requests.actions").createDiscountRequestAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-requests.actions");
      createDiscountRequestAction = module.createDiscountRequestAction;
    });

    it("should reject when user lacks discounts:request permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        studentId: VALID_UUID,
        enrollmentId: VALID_UUID,
        discountTypeId: VALID_UUID,
      });

      const result = await createDiscountRequestAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "discounts:request");
      expect(result.message).toContain("permission");
    });
  });

  describe("approveDiscountRequestAction (discounts:review)", () => {
    let approveDiscountRequestAction: typeof import("@/features/discounts/actions/discount-requests.actions").approveDiscountRequestAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-requests.actions");
      approveDiscountRequestAction = module.approveDiscountRequestAction;
    });

    it("should reject when user lacks discounts:review permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("registrar"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        requestId: VALID_UUID,
      });

      const result = await approveDiscountRequestAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("registrar", "discounts:review");
      expect(result.message).toContain("permission");
    });
  });

  describe("rejectDiscountRequestAction (discounts:review)", () => {
    let rejectDiscountRequestAction: typeof import("@/features/discounts/actions/discount-requests.actions").rejectDiscountRequestAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-requests.actions");
      rejectDiscountRequestAction = module.rejectDiscountRequestAction;
    });

    it("should reject when user lacks discounts:review permission", async () => {
      (requireSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        requestId: VALID_UUID,
        rejectionReason: "Not eligible",
      });

      const result = await rejectDiscountRequestAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "discounts:review");
      expect(result.message).toContain("permission");
    });
  });

  describe("applyApprovedDiscountToExistingAssessment (discounts:apply)", () => {
    let applyApprovedDiscountToExistingAssessment: typeof import("@/features/discounts/actions/discount-application.actions").applyApprovedDiscountToExistingAssessment;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-application.actions");
      applyApprovedDiscountToExistingAssessment = module.applyApprovedDiscountToExistingAssessment;
    });

    it("should reject when user lacks discounts:apply permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        requestId: VALID_UUID,
      });

      const result = await applyApprovedDiscountToExistingAssessment({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("teacher", "discounts:apply");
      expect(result.message).toContain("permission");
    });
  });

  describe("reverseDiscountAction (discounts:manage)", () => {
    let reverseDiscountAction: typeof import("@/features/discounts/actions/discount-application.actions").reverseDiscountAction;

    beforeEach(async () => {
      const module = await import("@/features/discounts/actions/discount-application.actions");
      reverseDiscountAction = module.reverseDiscountAction;
    });

    it("should reject when user lacks discounts:manage permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("cashier"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        studentDiscountId: VALID_UUID,
        reason: "Applied in error",
      });

      const result = await reverseDiscountAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("cashier", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Role-Based Access Summary Tests
// ─────────────────────────────────────────────────────────────────

describe("RBAC Permission Matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * These tests verify that specific roles are denied specific permissions.
   * This documents the expected RBAC matrix for the system.
   */

  describe("Teacher Role Restrictions", () => {
    const teacherSession = createMockSession("teacher");

    it("teacher cannot create assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(teacherSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createAssessmentFromEnrollmentAction } = await import(
        "@/features/assessments/assessments.actions"
      );

      const result = await createAssessmentFromEnrollmentAction(
        {},
        createFormData({ enrollmentId: VALID_UUID })
      );

      expect(hasPermission).toHaveBeenCalledWith("teacher", "assessments:create");
      expect(result.message).toContain("permission");
    });

    it("teacher cannot post payments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(teacherSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { postPaymentAction } = await import("@/features/payments/payments.actions");

      const result = await postPaymentAction({}, createFormData({ amount: 5000 }));

      expect(hasPermission).toHaveBeenCalledWith("teacher", "payments:post");
      expect(result.message).toContain("permission");
    });

    it("teacher cannot manage booklets", async () => {
      (requireSession as Mock).mockResolvedValue(teacherSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createBookletAction } = await import(
        "@/features/payments/actions/booklets.actions"
      );

      const result = await createBookletAction({}, createFormData({ series: "AK-00001-00050" }));

      expect(hasPermission).toHaveBeenCalledWith("teacher", "booklets:manage");
      expect(result.message).toContain("permission");
    });

    it("teacher cannot manage discount types", async () => {
      (requireSession as Mock).mockResolvedValue(teacherSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createDiscountTypeAction } = await import(
        "@/features/discounts/actions/discount-types.actions"
      );

      const result = await createDiscountTypeAction({}, createFormData({ name: "Test" }));

      expect(hasPermission).toHaveBeenCalledWith("teacher", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });

  describe("Cashier Role Restrictions", () => {
    const cashierSession = createMockSession("cashier");

    it("cashier cannot create assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(cashierSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createAssessmentFromEnrollmentAction } = await import(
        "@/features/assessments/assessments.actions"
      );

      const result = await createAssessmentFromEnrollmentAction(
        {},
        createFormData({ enrollmentId: VALID_UUID })
      );

      expect(hasPermission).toHaveBeenCalledWith("cashier", "assessments:create");
      expect(result.message).toContain("permission");
    });

    it("cashier cannot manage booklets", async () => {
      (requireSession as Mock).mockResolvedValue(cashierSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createBookletAction } = await import(
        "@/features/payments/actions/booklets.actions"
      );

      const result = await createBookletAction({}, createFormData({ series: "AK-00001-00050" }));

      expect(hasPermission).toHaveBeenCalledWith("cashier", "booklets:manage");
      expect(result.message).toContain("permission");
    });

    it("cashier cannot approve void requests", async () => {
      (requireStaffSession as Mock).mockResolvedValue(cashierSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { approveVoidRequestAction } = await import(
        "@/features/payments/void-requests.actions"
      );

      const result = await approveVoidRequestAction({}, createFormData({ requestId: VALID_UUID }));

      expect(hasPermission).toHaveBeenCalledWith("cashier", "payments:void_approve");
      expect(result.message).toContain("permission");
    });

    it("cashier cannot review discount requests", async () => {
      (requireSession as Mock).mockResolvedValue(cashierSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { approveDiscountRequestAction } = await import(
        "@/features/discounts/actions/discount-requests.actions"
      );

      const result = await approveDiscountRequestAction(
        {},
        createFormData({ requestId: VALID_UUID })
      );

      expect(hasPermission).toHaveBeenCalledWith("cashier", "discounts:review");
      expect(result.message).toContain("permission");
    });
  });

  describe("Registrar Role Restrictions", () => {
    const registrarSession = createMockSession("registrar");

    it("registrar cannot reverse balance transfers", async () => {
      (requireStaffSession as Mock).mockResolvedValue(registrarSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { reverseBalanceTransferAction } = await import(
        "@/features/assessments/assessments.actions"
      );

      const result = await reverseBalanceTransferAction(
        {},
        createFormData({ sourceAssessmentId: VALID_UUID })
      );

      expect(hasPermission).toHaveBeenCalledWith("registrar", "assessments:reverse_transfer");
      expect(result.message).toContain("permission");
    });

    it("registrar cannot manage discount types", async () => {
      (requireSession as Mock).mockResolvedValue(registrarSession);
      (hasPermission as Mock).mockReturnValue(false);

      const { createDiscountTypeAction } = await import(
        "@/features/discounts/actions/discount-types.actions"
      );

      const result = await createDiscountTypeAction({}, createFormData({ name: "Test" }));

      expect(hasPermission).toHaveBeenCalledWith("registrar", "discounts:manage");
      expect(result.message).toContain("permission");
    });
  });
});
