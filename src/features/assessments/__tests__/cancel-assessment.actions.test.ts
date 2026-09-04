import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Cancel Assessment Action Tests
 *
 * Tests for cancelAssessmentAction covering:
 * 1. Authorization checks (assessments:cancel permission)
 * 2. Input validation (remarks required)
 * 3. Business rule enforcement:
 *    - Assessment must be outstanding status
 *    - Enrollment must be assessed status
 *    - No posted payments (hard block)
 *    - Student not archived
 *    - No pending cancellation request
 * 4. Transaction rollback scenarios
 * 5. Balance forward reversal
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
      assessments: { findFirst: vi.fn() },
      assessmentItems: { findMany: vi.fn() },
    },
    transaction: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/cache/cache-tags", () => ({
  CACHE_TAGS: {
    ENROLLMENTS: "enrollments",
    DASHBOARD: "dashboard",
  },
  invalidateTag: vi.fn(),
}));

vi.mock("@/features/enrollments/enrollment-cancellation.queries", () => ({
  hasPendingCancellationRequest: vi.fn(),
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

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/utils/audit-logger", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/utils/balance-forward", () => ({
  reverseBalanceForwardItems: vi.fn(),
}));

vi.mock("@/lib/utils/form-validation", () => ({
  parseFormData: vi.fn(),
}));

vi.mock("@/lib/utils/currency", () => ({
  formatCurrency: vi.fn((amount) => `₱${amount.toLocaleString()}`),
}));

import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { hasPendingCancellationRequest } from "@/features/enrollments/enrollment-cancellation.queries";
import { assertStudentMutable, StudentArchivedException } from "@/features/archive/archive.guards";
import { logAudit } from "@/lib/utils/audit-logger";
import { reverseBalanceForwardItems } from "@/lib/utils/balance-forward";
import { parseFormData } from "@/lib/utils/form-validation";

import { cancelAssessmentAction } from "../assessments.actions";

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const validUuids = {
  assessment: "550e8400-e29b-41d4-a716-446655440000",
  student: "660e8400-e29b-41d4-a716-446655440001",
  enrollment: "770e8400-e29b-41d4-a716-446655440002",
};

const createMockSession = (role: string = "finance_officer") => ({
  userId: "user-123",
  role,
  username: "testuser",
});

const createMockAssessment = (overrides?: Record<string, unknown>) => ({
  id: validUuids.assessment,
  enrollmentId: validUuids.enrollment,
  studentId: validUuids.student,
  billingStatus: "outstanding",
  totalPaid: "0.00",
  totalAmount: "50000.00",
  balance: "50000.00",
  transferredAt: null,
  cancelledAt: null,
  enrollment: {
    id: validUuids.enrollment,
    status: "assessed",
    student: {
      referenceNumber: "0000001",
    },
  },
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

describe("cancelAssessmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization", () => {
    it("should reject request when user lacks assessments:cancel permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Student requested cancellation",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("permission");
      expect(hasPermission).toHaveBeenCalledWith("teacher", "assessments:cancel");
    });

    it("should allow admin role to cancel assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("admin"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Admin cancellation",
        },
      });
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Admin cancellation",
      });

      await cancelAssessmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("admin", "assessments:cancel");
    });

    it("should allow finance_officer role to cancel assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Finance officer cancellation",
        },
      });
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Finance officer cancellation",
      });

      await cancelAssessmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "assessments:cancel");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Input Validation Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Input Validation", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should reject when remarks is missing", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { remarks: ["Cancellation reason is required."] },
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.remarks).toBeDefined();
    });

    it("should reject when remarks is empty", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { remarks: ["Cancellation reason is required."] },
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.remarks).toBeDefined();
    });

    it("should reject when assessmentId is invalid", async () => {
      (parseFormData as Mock).mockReturnValue({
        success: false,
        errors: { assessmentId: ["Invalid assessment ID."] },
      });

      const formData = createFormData({
        assessmentId: "invalid-uuid",
        remarks: "Valid reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.assessmentId).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Business Rule Enforcement Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Business Rule Enforcement", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Valid cancellation reason",
        },
      });
    });

    it("should reject when assessment not found", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toBe("Assessment not found.");
    });

    it("should reject when student is archived", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockRejectedValue(
        new StudentArchivedException(
          validUuids.student,
          "graduated",
          "cancel_assessment"
        )
      );

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("archived");
    });

    it("should reject when assessment already cancelled", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          cancelledAt: new Date(),
          billingStatus: "cancelled",
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("already been cancelled");
    });

    it("should reject when assessment is fully_paid", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          billingStatus: "fully_paid",
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("fully paid");
    });

    it("should reject when assessment balance has been forwarded", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          billingStatus: "balance_forwarded",
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("transferred");
    });

    it("should reject when enrollment status is not assessed", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          enrollment: {
            id: validUuids.enrollment,
            status: "enrolled", // Not "assessed"
            student: { referenceNumber: "0000001" },
          },
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("enrolled");
      expect(result.message).toContain("assessed");
    });

    it("should reject when pending cancellation request exists", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(true);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("pending cancellation request");
    });

    it("should reject when payments have been posted (HARD BLOCK)", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          totalPaid: "10000.00", // Has posted payments
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.message).toContain("posted payments");
      expect(result.message).toContain("Void all payments");
    });

    it("should allow cancellation with zero payments", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          totalPaid: "0.00",
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      // Mock successful transaction
      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessmentItems: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        (logAudit as Mock).mockResolvedValue(undefined);
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBe(true);
    });

    it("should handle payments within epsilon threshold (0.009) as zero", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(
        createMockAssessment({
          totalPaid: "0.005", // Below epsilon threshold
        })
      );
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessmentItems: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        (logAudit as Mock).mockResolvedValue(undefined);
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      // Should succeed because 0.005 < 0.009 (epsilon)
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Balance Forward Reversal Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Balance Forward Reversal", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Valid cancellation reason",
        },
      });
    });

    it("should reverse balance forward items when present", async () => {
      const balanceForwardItems = [
        {
          id: "bf-item-1",
          assessmentId: validUuids.assessment,
          sourceAssessmentId: "source-assessment-1",
          amount: "15000.00",
        },
        {
          id: "bf-item-2",
          assessmentId: validUuids.assessment,
          sourceAssessmentId: "source-assessment-2",
          amount: "10000.00",
        },
      ];

      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessmentItems: {
              findMany: vi.fn().mockResolvedValue(balanceForwardItems),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        };
        (reverseBalanceForwardItems as Mock).mockResolvedValue(undefined);
        (logAudit as Mock).mockResolvedValue(undefined);
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation with balance forward",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBe(true);
      expect(reverseBalanceForwardItems).toHaveBeenCalled();
    });

    it("should succeed without balance forward items", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessmentItems: {
              findMany: vi.fn().mockResolvedValue([]), // No balance forward items
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        (logAudit as Mock).mockResolvedValue(undefined);
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation without balance forward",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBe(true);
      expect(reverseBalanceForwardItems).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Valid cancellation reason",
        },
      });
    });

    it("should handle transaction errors gracefully", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      (db.transaction as Mock).mockRejectedValue(new Error("Database error"));

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Cancellation reason",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("unexpected error");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Success Scenario Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Successful Cancellation", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
      (parseFormData as Mock).mockReturnValue({
        success: true,
        data: {
          assessmentId: validUuids.assessment,
          remarks: "Valid cancellation reason",
        },
      });
    });

    it("should return success with assessmentId and message", async () => {
      (db.query.assessments.findFirst as Mock).mockResolvedValue(createMockAssessment());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (hasPendingCancellationRequest as Mock).mockResolvedValue(false);

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          query: {
            assessmentItems: {
              findMany: vi.fn().mockResolvedValue([]),
            },
          },
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };
        (logAudit as Mock).mockResolvedValue(undefined);
        await callback(mockTx);
      });

      const formData = createFormData({
        assessmentId: validUuids.assessment,
        remarks: "Student withdrew from school",
      });

      const result = await cancelAssessmentAction({}, formData);

      expect(result.success).toBe(true);
      expect(result.assessmentId).toBe(validUuids.assessment);
      expect(result.message).toContain("cancelled successfully");
      expect(result.message).toContain("pending status");
    });
  });
});
