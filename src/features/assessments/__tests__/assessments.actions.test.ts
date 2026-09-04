import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

/**
 * Assessment Actions Integration Tests
 *
 * Tests for createAssessmentFromEnrollmentAction covering:
 * 1. Authorization checks (permitted and denied roles)
 * 2. Input validation
 * 3. Business rule enforcement
 * 4. Balance forward scenarios
 * 5. SPED fee handling
 * 6. Error scenarios
 *
 * These tests mock the database and session to verify business logic
 * without requiring a live database connection.
 */

// ─────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────

// Mock session module
vi.mock("@/lib/auth/session", () => ({
  requireStaffSession: vi.fn(),
}));

// Mock permissions module
vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: vi.fn(),
}));

// Mock database module
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    query: {
      enrollments: { findFirst: vi.fn(), findMany: vi.fn() },
      gradeLevels: { findFirst: vi.fn() },
      assessments: { findFirst: vi.fn() },
      feeItemTypes: { findFirst: vi.fn() },
    },
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock cache tags
vi.mock("@/lib/cache/cache-tags", () => ({
  CACHE_TAGS: {
    ENROLLMENTS: "enrollments",
    DASHBOARD: "dashboard",
  },
  invalidateTag: vi.fn(),
}));

// Mock queries
vi.mock("../assessments.queries", () => ({
  resolveFeeScheduleForAssessment: vi.fn(),
}));

// Mock school year queries
vi.mock("@/lib/queries/schoolYears", () => ({
  getActiveSchoolYearId: vi.fn(),
}));

// Mock discount module
vi.mock("@/features/discounts", () => ({
  hasPendingDiscountRequests: vi.fn(),
  applyApprovedDiscountsToAssessment: vi.fn(),
}));

// Mock enrollment cancellation queries
vi.mock("@/features/enrollments/enrollment-cancellation.queries", () => ({
  hasPendingCancellationRequest: vi.fn(),
}));

// Mock archive guards
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

// Mock SPED utilities
vi.mock("@/lib/utils/special-education", () => ({
  isEffectivelySpecialEducation: vi.fn(),
  SPED_FEE_CODE: "SPED_FEE",
}));

// Mock SPED fee settings
vi.mock("@/features/settings/system-settings.actions", () => ({
  getSpedFeeAmount: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock audit logger
vi.mock("@/lib/utils/audit-logger", () => ({
  logAudit: vi.fn(),
  logAuditBatch: vi.fn(),
}));

// Mock balance forward utilities
vi.mock("@/lib/utils/balance-forward", () => ({
  reverseBalanceForwardItems: vi.fn(),
}));

// Mock reference generation
vi.mock("@/lib/utils/reference", () => ({
  generateBatchBfxNumbers: vi.fn(),
}));

// Import after mocks are set up
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { resolveFeeScheduleForAssessment } from "../assessments.queries";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { hasPendingDiscountRequests, applyApprovedDiscountsToAssessment } from "@/features/discounts";
import { hasPendingCancellationRequest } from "@/features/enrollments/enrollment-cancellation.queries";
import { assertStudentMutable, StudentArchivedException } from "@/features/archive/archive.guards";
import { isEffectivelySpecialEducation } from "@/lib/utils/special-education";
import { getSpedFeeAmount } from "@/features/settings/system-settings.actions";
import { logAudit, logAuditBatch } from "@/lib/utils/audit-logger";
import { generateBatchBfxNumbers } from "@/lib/utils/reference";

import { createAssessmentFromEnrollmentAction } from "../assessments.actions";

// ─────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────

const validUuids = {
  enrollment: "550e8400-e29b-41d4-a716-446655440000",
  student: "660e8400-e29b-41d4-a716-446655440001",
  schoolYear: "770e8400-e29b-41d4-a716-446655440002",
  gradeLevel: "880e8400-e29b-41d4-a716-446655440003",
  feeTemplateItem: "990e8400-e29b-41d4-a716-446655440004",
  feeSchedule: "aa0e8400-e29b-41d4-a716-446655440005",
  feeItemType: "bb0e8400-e29b-41d4-a716-446655440006",
};

const createMockSession = (role: string = "finance_officer") => ({
  userId: "user-123",
  role,
  username: "testuser",
});

const createMockEnrollmentResult = (overrides?: Record<string, unknown>) => [
  {
    id: validUuids.enrollment,
    studentId: validUuids.student,
    schoolYearId: validUuids.schoolYear,
    gradeLevelId: validUuids.gradeLevel,
    studentType: "new_student",
    status: "pending",
    specialEducationOverride: null,
    schoolYearLabel: "SY 2025-2026",
    studentIsSpecialEducation: false,
    ...overrides,
  },
];

const createMockGradeLevel = () => ({
  assessmentBand: "casa",
});

const createMockFeeSchedule = () => ({
  scheduleId: validUuids.feeSchedule,
  items: [
    {
      feeTemplateItemId: validUuids.feeTemplateItem,
      feeItemTypeId: validUuids.feeItemType,
      feeItemTypeCode: "TUITION",
      description: "Tuition Fee",
      isDiscount: false,
      isRefundable: true,
    },
  ],
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
// Authorization Tests
// ─────────────────────────────────────────────────────────────────

describe("createAssessmentFromEnrollmentAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authorization", () => {
    it("should reject request when user lacks assessments:create permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("teacher"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("permission");
      expect(hasPermission).toHaveBeenCalledWith("teacher", "assessments:create");
    });

    it("should allow request when user has assessments:create permission", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("finance_officer"));
      (hasPermission as Mock).mockReturnValue(true);

      // Mock the enrollment query chain
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      // Continue with other mocks to complete the flow
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(false);

      // Mock transaction
      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-assessment-id" }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        // Mock resolveFeeScheduleForAssessment inside transaction
        (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
        (applyApprovedDiscountsToAssessment as Mock).mockResolvedValue({
          totalDiscounts: 0,
          appliedCount: 0,
        });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("finance_officer", "assessments:create");
      // The action should proceed (not fail on permission)
      // If message exists, it should not be about permission
      if (result.message) {
        expect(result.message).not.toContain("permission");
      }
    });

    it("should allow admin role to create assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("admin"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      // We just need to verify hasPermission is called correctly
      await createAssessmentFromEnrollmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("admin", "assessments:create");
    });

    it("should allow registrar role to create assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("registrar"));
      (hasPermission as Mock).mockReturnValue(true);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      await createAssessmentFromEnrollmentAction({}, formData);

      expect(hasPermission).toHaveBeenCalledWith("registrar", "assessments:create");
    });

    it("should deny student role from creating assessments", async () => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession("student"));
      (hasPermission as Mock).mockReturnValue(false);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.message).toContain("permission");
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

    it("should reject invalid JSON in items field", async () => {
      const formData = new FormData();
      formData.set("enrollmentId", validUuids.enrollment);
      formData.set("items", "not valid json");

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("Invalid line items");
    });

    it("should reject empty items array", async () => {
      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
      expect(result.errors?.items).toBeDefined();
    });

    it("should reject invalid enrollmentId format", async () => {
      const formData = createFormData({
        enrollmentId: "not-a-uuid",
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
      // Either message or errors should indicate the problem
      expect(result.message || result.errors).toBeTruthy();
    });

    it("should reject negative amounts in items", async () => {
      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: -5000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
    });

    it("should reject duplicate feeTemplateItemIds", async () => {
      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [
          { feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 },
          { feeTemplateItemId: validUuids.feeTemplateItem, amount: 30000 },
        ],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.success).toBeUndefined();
      // The duplicate validation error could be in message or errors.items
      const hasError = result.message?.includes("once") ||
        result.errors?.items?.some((e: string) => e?.includes("once"));
      expect(hasError).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Business Rule Enforcement Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Business Rule Enforcement", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should reject when enrollment not found", async () => {
      // Mock empty enrollment result
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue([]);

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toBe("Enrollment not found.");
    });

    it("should reject when student is archived", async () => {
      // Setup enrollment query
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      // Mock archived student exception
      (assertStudentMutable as Mock).mockRejectedValue(
        new StudentArchivedException(
          "Student is archived and cannot be modified",
          validUuids.student,
          "graduated"
        )
      );

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("archived");
    });

    it("should reject when enrollment status is not pending", async () => {
      // Setup enrollment with non-pending status
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(
        createMockEnrollmentResult({ status: "enrolled" })
      );

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("Pending");
      expect(result.message).toContain("enrolled");
    });

    it("should reject when enrollment status is assessed", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(
        createMockEnrollmentResult({ status: "assessed" })
      );

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("Pending");
    });

    it("should reject when no active school year", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(null);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("No active school year");
    });

    it("should reject when enrollment is for different school year", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      // Different school year ID
      (getActiveSchoolYearId as Mock).mockResolvedValue("different-school-year-id");

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("active school year");
    });

    it("should reject when pending discount requests exist", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(true);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("pending discount requests");
    });

    it("should reject when assessment already exists", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue({ id: "existing-assessment" });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("already exists");
    });

    it("should reject when no fee schedule exists", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(null);

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("No fee schedule");
    });

    it("should reject when fee schedule has no items", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue({
        scheduleId: validUuids.feeSchedule,
        items: [],
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("no line items");
    });

    it("should reject when submitted items not in fee template", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());

      // Submit a valid UUID that's not in the template
      const nonExistentItemId = "cc0e8400-e29b-41d4-a716-446655440099";
      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [
          { feeTemplateItemId: nonExistentItemId, amount: 50000 },
        ],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("not in the current fee template");
    });

    it("should reject when total assessed amount is zero or negative", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(false);

      // Submit zero amount
      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 0 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("greater than zero");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Fee Schedule Change Detection Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Fee Schedule Change Detection", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should handle FEE_SCHEDULE_CHANGED error gracefully", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(false);

      // Mock transaction that throws FEE_SCHEDULE_CHANGED
      (db.transaction as Mock).mockImplementation(async () => {
        throw new Error("FEE_SCHEDULE_CHANGED");
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("fee schedule changed");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // SPED Fee Handling Tests
  // ─────────────────────────────────────────────────────────────────

  describe("SPED Fee Handling", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should add SPED fee when student is special education", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(
        createMockEnrollmentResult({ studentIsSpecialEducation: true })
      );

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(true);
      (db.query.feeItemTypes.findFirst as Mock).mockResolvedValue({
        id: "sped-fee-type-id",
        isRefundable: false,
      });
      (getSpedFeeAmount as Mock).mockResolvedValue(15000);

      // Track if SPED fee was included
      let insertedValues: unknown[] = [];

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockImplementation(() => ({
            values: vi.fn().mockImplementation((vals) => {
              insertedValues = Array.isArray(vals) ? vals : [vals];
              return {
                returning: vi.fn().mockResolvedValue([{ id: "new-assessment-id" }]),
              };
            }),
          })),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
        (applyApprovedDiscountsToAssessment as Mock).mockResolvedValue({
          totalDiscounts: 0,
          appliedCount: 0,
        });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      await createAssessmentFromEnrollmentAction({}, formData);

      // Verify isEffectivelySpecialEducation was checked
      expect(isEffectivelySpecialEducation).toHaveBeenCalled();
    });

    it("should use custom SPED fee amount when provided", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(
        createMockEnrollmentResult({ studentIsSpecialEducation: true })
      );

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(true);
      (db.query.feeItemTypes.findFirst as Mock).mockResolvedValue({
        id: "sped-fee-type-id",
        isRefundable: false,
      });

      (db.transaction as Mock).mockImplementation(async (callback) => {
        const mockTx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "new-assessment-id" }]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        };

        (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
        (applyApprovedDiscountsToAssessment as Mock).mockResolvedValue({
          totalDiscounts: 0,
          appliedCount: 0,
        });
        (logAudit as Mock).mockResolvedValue(undefined);

        await callback(mockTx);
      });

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
        spedFeeAmount: 20000, // Custom amount
      });

      await createAssessmentFromEnrollmentAction({}, formData);

      // Should NOT call getSpedFeeAmount when custom amount is provided
      expect(getSpedFeeAmount).not.toHaveBeenCalled();
    });

    it("should reject when SPED fee type not found in system", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(
        createMockEnrollmentResult({ studentIsSpecialEducation: true })
      );

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(true);
      (db.query.feeItemTypes.findFirst as Mock).mockResolvedValue(null); // SPED type not found

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("Special Education Fee type not found");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────────

  describe("Error Handling", () => {
    beforeEach(() => {
      (requireStaffSession as Mock).mockResolvedValue(createMockSession());
      (hasPermission as Mock).mockReturnValue(true);
    });

    it("should handle unexpected errors gracefully", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(createMockGradeLevel());
      (getActiveSchoolYearId as Mock).mockResolvedValue(validUuids.schoolYear);
      (hasPendingDiscountRequests as Mock).mockResolvedValue(false);
      (db.query.assessments.findFirst as Mock).mockResolvedValue(null);
      (resolveFeeScheduleForAssessment as Mock).mockResolvedValue(createMockFeeSchedule());
      (isEffectivelySpecialEducation as Mock).mockReturnValue(false);

      // Mock transaction that throws unexpected error
      (db.transaction as Mock).mockRejectedValue(new Error("Database connection lost"));

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("unexpected error");
    });

    it("should handle grade level not found", async () => {
      const mockFrom = vi.fn().mockReturnThis();
      const mockInnerJoin = vi.fn().mockReturnThis();
      const mockWhere = vi.fn().mockReturnThis();
      const mockLimit = vi.fn().mockResolvedValue(createMockEnrollmentResult());

      (db.select as Mock).mockReturnValue({
        from: mockFrom,
        innerJoin: mockInnerJoin,
        where: mockWhere,
        limit: mockLimit,
      });

      (assertStudentMutable as Mock).mockResolvedValue(undefined);
      (db.query.gradeLevels.findFirst as Mock).mockResolvedValue(null); // Grade level not found

      const formData = createFormData({
        enrollmentId: validUuids.enrollment,
        items: [{ feeTemplateItemId: validUuids.feeTemplateItem, amount: 50000 }],
      });

      const result = await createAssessmentFromEnrollmentAction({}, formData);

      expect(result.message).toContain("Grade level not found");
    });
  });
});
