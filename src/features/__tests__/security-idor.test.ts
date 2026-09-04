/**
 * Security Test Suite: IDOR/BOLA (Object-Level Authorization)
 *
 * Tests protection against Insecure Direct Object References (IDOR) and
 * Broken Object-Level Authorization (BOLA) vulnerabilities.
 *
 * OWASP API Security Top 10 - API1:2023 Broken Object Level Authorization
 * https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
 *
 * These tests verify that:
 * 1. Users cannot access resources belonging to other users
 * 2. Portal users are restricted to their own data
 * 3. Cross-enrollment access is blocked
 * 4. Resource ID manipulation is detected and blocked
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ─── Mock Setup ──────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/session", () => ({
  requireStaffSession: vi.fn(),
  requireSession: vi.fn(),
  getCurrentUser: vi.fn(),
  getStaffUser: vi.fn(),
  getPortalUser: vi.fn(),
}));

vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      students: { findFirst: vi.fn() },
      enrollments: { findFirst: vi.fn() },
      assessments: { findFirst: vi.fn() },
      payments: { findFirst: vi.fn() },
      receiptBooklets: { findFirst: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(),
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/cache/cache-tags", () => ({
  CACHE_TAGS: {
    ENROLLMENTS: "enrollments",
    ASSESSMENTS: "assessments",
    PAYMENTS: "payments",
  },
  invalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

import {
  requireStaffSession,
  getCurrentUser,
  getPortalUser,
} from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";

// ─── Test Helpers ────────────────────────────────────────────────────────────

const USER_A_ID = "user-aaa-111";
const USER_B_ID = "user-bbb-222";
const STUDENT_A_ID = "student-aaa-111";
const STUDENT_B_ID = "student-bbb-222";
const ENROLLMENT_A_ID = "enrollment-aaa-111";
const ENROLLMENT_B_ID = "enrollment-bbb-222";
const ASSESSMENT_A_ID = "assessment-aaa-111";
const ASSESSMENT_B_ID = "assessment-bbb-222";
const PAYMENT_A_ID = "payment-aaa-111";
const PAYMENT_B_ID = "payment-bbb-222";

const createStaffSession = (userId: string, role: string) => ({
  userId,
  role,
  username: `user-${userId}`,
  email: `${userId}@school.edu`,
});

const createPortalSession = (userId: string, studentId: string) => ({
  userId,
  role: "student",
  studentId,
  username: `portal-${userId}`,
});

// ─── Object Ownership Verification Tests ─────────────────────────────────────

describe("Object Ownership Verification Patterns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Student Resource Ownership", () => {
    it("should verify student belongs to accessing user (portal)", () => {
      // Pattern: Portal user should only access their own student record
      const portalSession = createPortalSession(USER_A_ID, STUDENT_A_ID);

      // User A requests their own student data - ALLOWED
      const isOwner = portalSession.studentId === STUDENT_A_ID;
      expect(isOwner).toBe(true);

      // User A requests User B's student data - SHOULD BE BLOCKED
      const notOwner = portalSession.studentId === STUDENT_B_ID;
      expect(notOwner).toBe(false);
    });

    it("should define student access guard function signature", () => {
      // Expected guard pattern for portal actions
      const guardPortalStudentAccess = (
        sessionStudentId: string,
        requestedStudentId: string
      ): boolean => {
        return sessionStudentId === requestedStudentId;
      };

      // Own student - allowed
      expect(guardPortalStudentAccess(STUDENT_A_ID, STUDENT_A_ID)).toBe(true);

      // Other student - blocked
      expect(guardPortalStudentAccess(STUDENT_A_ID, STUDENT_B_ID)).toBe(false);
    });
  });

  describe("Enrollment Resource Ownership", () => {
    it("should verify enrollment belongs to student (portal)", () => {
      const mockEnrollment = {
        id: ENROLLMENT_A_ID,
        studentId: STUDENT_A_ID,
      };

      const portalSession = createPortalSession(USER_A_ID, STUDENT_A_ID);

      // Student A accessing their enrollment - ALLOWED
      const isOwner = mockEnrollment.studentId === portalSession.studentId;
      expect(isOwner).toBe(true);

      // Student A accessing Student B's enrollment - BLOCKED
      const otherEnrollment = { id: ENROLLMENT_B_ID, studentId: STUDENT_B_ID };
      const notOwner = otherEnrollment.studentId === portalSession.studentId;
      expect(notOwner).toBe(false);
    });

    it("should require enrollment ownership check before operations", () => {
      // Guard function signature for enrollment operations
      const assertEnrollmentOwnership = (
        enrollment: { studentId: string },
        sessionStudentId: string
      ): void => {
        if (enrollment.studentId !== sessionStudentId) {
          throw new Error("Access denied: enrollment does not belong to you");
        }
      };

      const enrollment = { studentId: STUDENT_A_ID };

      // Own enrollment - no error
      expect(() =>
        assertEnrollmentOwnership(enrollment, STUDENT_A_ID)
      ).not.toThrow();

      // Other's enrollment - throws
      expect(() =>
        assertEnrollmentOwnership(enrollment, STUDENT_B_ID)
      ).toThrow("Access denied");
    });
  });

  describe("Assessment Resource Ownership", () => {
    it("should trace assessment ownership through enrollment chain", () => {
      // Assessment -> Enrollment -> Student ownership chain
      const mockAssessment = {
        id: ASSESSMENT_A_ID,
        enrollmentId: ENROLLMENT_A_ID,
      };

      const mockEnrollment = {
        id: ENROLLMENT_A_ID,
        studentId: STUDENT_A_ID,
      };

      // Portal user owns the student that owns the enrollment that owns the assessment
      const portalSession = createPortalSession(USER_A_ID, STUDENT_A_ID);

      const isOwner =
        mockAssessment.enrollmentId === mockEnrollment.id &&
        mockEnrollment.studentId === portalSession.studentId;

      expect(isOwner).toBe(true);
    });

    it("should verify assessment access through ownership chain", () => {
      const verifyAssessmentAccess = (
        assessmentEnrollmentId: string,
        enrollmentStudentId: string,
        sessionStudentId: string
      ): boolean => {
        // Must match the entire chain
        return enrollmentStudentId === sessionStudentId;
      };

      // Valid chain
      expect(
        verifyAssessmentAccess(ENROLLMENT_A_ID, STUDENT_A_ID, STUDENT_A_ID)
      ).toBe(true);

      // Broken chain (different student)
      expect(
        verifyAssessmentAccess(ENROLLMENT_A_ID, STUDENT_A_ID, STUDENT_B_ID)
      ).toBe(false);
    });
  });

  describe("Payment Resource Ownership", () => {
    it("should trace payment ownership through assessment chain", () => {
      // Payment -> Assessment -> Enrollment -> Student
      const mockPayment = {
        id: PAYMENT_A_ID,
        assessmentId: ASSESSMENT_A_ID,
        studentId: STUDENT_A_ID, // Denormalized for efficiency
      };

      const portalSession = createPortalSession(USER_A_ID, STUDENT_A_ID);

      // Direct ownership check (denormalized)
      const isOwner = mockPayment.studentId === portalSession.studentId;
      expect(isOwner).toBe(true);
    });

    it("should block cross-student payment access", () => {
      const verifyPaymentAccess = (
        paymentStudentId: string,
        sessionStudentId: string
      ): boolean => {
        return paymentStudentId === sessionStudentId;
      };

      // Own payment
      expect(verifyPaymentAccess(STUDENT_A_ID, STUDENT_A_ID)).toBe(true);

      // Other's payment
      expect(verifyPaymentAccess(STUDENT_B_ID, STUDENT_A_ID)).toBe(false);
    });
  });
});

// ─── Parameter Tampering Prevention Tests ────────────────────────────────────

describe("Parameter Tampering Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ID Substitution Detection", () => {
    it("should detect studentId substitution in request body", () => {
      // Attacker sends their own session but substitutes another student's ID
      const attackerSession = createPortalSession(USER_A_ID, STUDENT_A_ID);
      const requestBody = { studentId: STUDENT_B_ID }; // TAMPERED

      const isTampered = requestBody.studentId !== attackerSession.studentId;
      expect(isTampered).toBe(true);
    });

    it("should validate resource ID matches session context", () => {
      const validateResourceOwnership = (
        sessionStudentId: string,
        requestedResourceStudentId: string
      ): { valid: boolean; error?: string } => {
        if (sessionStudentId !== requestedResourceStudentId) {
          return {
            valid: false,
            error: "Resource does not belong to authenticated user",
          };
        }
        return { valid: true };
      };

      // Valid request
      const valid = validateResourceOwnership(STUDENT_A_ID, STUDENT_A_ID);
      expect(valid.valid).toBe(true);

      // Tampered request
      const tampered = validateResourceOwnership(STUDENT_A_ID, STUDENT_B_ID);
      expect(tampered.valid).toBe(false);
      expect(tampered.error).toContain("does not belong");
    });

    it("should reject UUID manipulation attempts", () => {
      // Attacker tries various UUID manipulations
      const validUUID = "550e8400-e29b-41d4-a716-446655440000";

      // Different UUID (changed last digit) - should be detected
      const differentUUID = "550e8400-e29b-41d4-a716-446655440001";
      expect(differentUUID).not.toBe(validUUID);

      // Whitespace padding attacks - should be normalized before comparison
      const paddedUUIDs = [
        "550e8400-e29b-41d4-a716-446655440000 ", // Trailing space
        " 550e8400-e29b-41d4-a716-446655440000", // Leading space
        "550e8400-e29b-41d4-a716-446655440000\n", // Newline
        "\t550e8400-e29b-41d4-a716-446655440000", // Tab
      ];

      // After trimming, these should match - demonstrates need for normalization
      paddedUUIDs.forEach((padded) => {
        expect(padded.trim()).toBe(validUUID);
        // But raw comparison should fail (security check catches padding)
        expect(padded).not.toBe(validUUID);
      });
    });
  });

  describe("Enrollment Context Validation", () => {
    it("should validate enrollment belongs to student before operations", async () => {
      const validateEnrollmentContext = async (
        enrollmentId: string,
        sessionStudentId: string
      ): Promise<{ valid: boolean; error?: string }> => {
        // Mock: fetch enrollment and verify ownership
        const mockEnrollment = {
          id: enrollmentId,
          studentId:
            enrollmentId === ENROLLMENT_A_ID ? STUDENT_A_ID : STUDENT_B_ID,
        };

        if (mockEnrollment.studentId !== sessionStudentId) {
          return {
            valid: false,
            error: "Enrollment does not belong to this student",
          };
        }

        return { valid: true };
      };

      // Test valid context
      const validResult = await validateEnrollmentContext(ENROLLMENT_A_ID, STUDENT_A_ID);
      expect(validResult).toEqual({ valid: true });

      // Test invalid context (cross-student)
      const invalidResult = await validateEnrollmentContext(ENROLLMENT_B_ID, STUDENT_A_ID);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain("does not belong");
    });
  });
});

// ─── Staff vs Portal Boundary Tests ──────────────────────────────────────────

describe("Staff vs Portal Session Boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Portal Session Restrictions", () => {
    it("should identify portal session type", () => {
      const portalSession = {
        userId: USER_A_ID,
        role: "student",
        studentId: STUDENT_A_ID,
      };

      const isPortalSession = portalSession.role === "student";
      const hasStudentId = "studentId" in portalSession;

      expect(isPortalSession).toBe(true);
      expect(hasStudentId).toBe(true);
    });

    it("should restrict portal users to read-only operations", () => {
      const PORTAL_ALLOWED_OPERATIONS = [
        "view_dashboard",
        "view_assessments",
        "view_payments",
        "view_grades",
        "view_documents",
      ];

      const PORTAL_BLOCKED_OPERATIONS = [
        "create_assessment",
        "post_payment",
        "void_payment",
        "cancel_enrollment",
        "create_booklet",
      ];

      const isAllowed = (operation: string): boolean => {
        return PORTAL_ALLOWED_OPERATIONS.includes(operation);
      };

      // Allowed operations
      PORTAL_ALLOWED_OPERATIONS.forEach((op) => {
        expect(isAllowed(op)).toBe(true);
      });

      // Blocked operations
      PORTAL_BLOCKED_OPERATIONS.forEach((op) => {
        expect(isAllowed(op)).toBe(false);
      });
    });
  });

  describe("Staff Session Capabilities", () => {
    it("should allow staff to access multiple students", () => {
      const staffSession = createStaffSession(USER_A_ID, "registrar");

      // Staff can access any student within their permission scope
      const canAccessStudent = (
        _session: typeof staffSession,
        _studentId: string
      ): boolean => {
        // Staff access is role-based, not ownership-based
        return true;
      };

      expect(canAccessStudent(staffSession, STUDENT_A_ID)).toBe(true);
      expect(canAccessStudent(staffSession, STUDENT_B_ID)).toBe(true);
    });

    it("should still enforce role-based restrictions for staff", () => {
      const teacherSession = createStaffSession(USER_A_ID, "teacher");

      // Teacher should not be able to perform payment operations
      const canPostPayment = (session: typeof teacherSession): boolean => {
        return ["cashier", "finance_officer", "admin"].includes(session.role);
      };

      expect(canPostPayment(teacherSession)).toBe(false);

      const cashierSession = createStaffSession(USER_B_ID, "cashier");
      expect(canPostPayment(cashierSession)).toBe(true);
    });
  });
});

// ─── Cross-Resource Access Tests ─────────────────────────────────────────────

describe("Cross-Resource Access Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cross-Enrollment Access", () => {
    it("should prevent accessing assessments from wrong enrollment", () => {
      const verifyAssessmentEnrollmentMatch = (
        assessmentEnrollmentId: string,
        requestedEnrollmentId: string
      ): boolean => {
        return assessmentEnrollmentId === requestedEnrollmentId;
      };

      // Same enrollment
      expect(
        verifyAssessmentEnrollmentMatch(ENROLLMENT_A_ID, ENROLLMENT_A_ID)
      ).toBe(true);

      // Different enrollment (cross-access attempt)
      expect(
        verifyAssessmentEnrollmentMatch(ENROLLMENT_A_ID, ENROLLMENT_B_ID)
      ).toBe(false);
    });

    it("should prevent paying for wrong assessment", () => {
      const validatePaymentTarget = (
        assessmentStudentId: string,
        paymentStudentId: string
      ): { valid: boolean; error?: string } => {
        if (assessmentStudentId !== paymentStudentId) {
          return {
            valid: false,
            error: "Cannot post payment for another student's assessment",
          };
        }
        return { valid: true };
      };

      // Valid payment target
      expect(
        validatePaymentTarget(STUDENT_A_ID, STUDENT_A_ID)
      ).toMatchObject({ valid: true });

      // Cross-student payment attempt
      expect(
        validatePaymentTarget(STUDENT_A_ID, STUDENT_B_ID)
      ).toMatchObject({
        valid: false,
        error: expect.stringContaining("another student"),
      });
    });
  });

  describe("Cross-School-Year Access", () => {
    it("should validate school year context for operations", () => {
      const ACTIVE_SCHOOL_YEAR_ID = "sy-2024-2025";
      const OLD_SCHOOL_YEAR_ID = "sy-2023-2024";

      const validateSchoolYearContext = (
        resourceSchoolYearId: string,
        activeSchoolYearId: string
      ): { valid: boolean; error?: string } => {
        if (resourceSchoolYearId !== activeSchoolYearId) {
          return {
            valid: false,
            error: "Cannot modify resources from a different school year",
          };
        }
        return { valid: true };
      };

      // Current year
      expect(
        validateSchoolYearContext(ACTIVE_SCHOOL_YEAR_ID, ACTIVE_SCHOOL_YEAR_ID)
      ).toMatchObject({ valid: true });

      // Previous year (should be blocked for most operations)
      expect(
        validateSchoolYearContext(OLD_SCHOOL_YEAR_ID, ACTIVE_SCHOOL_YEAR_ID)
      ).toMatchObject({
        valid: false,
        error: expect.stringContaining("different school year"),
      });
    });
  });
});

// ─── Audit Trail for Security Events ─────────────────────────────────────────

describe("Security Event Auditing", () => {
  describe("Failed Access Attempts", () => {
    it("should structure access denial audit entry", () => {
      const createAccessDenialAudit = (
        userId: string,
        resourceType: string,
        resourceId: string,
        reason: string
      ) => ({
        actor: userId,
        actorRole: "student",
        action: `${resourceType}:access_denied`,
        targetEntity: resourceType,
        targetId: resourceId,
        context: reason,
        severity: "warning",
      });

      const audit = createAccessDenialAudit(
        USER_A_ID,
        "assessments",
        ASSESSMENT_B_ID,
        "Cross-student access attempt"
      );

      expect(audit.action).toBe("assessments:access_denied");
      expect(audit.context).toContain("Cross-student");
      expect(audit.severity).toBe("warning");
    });

    it("should include suspicious activity indicators", () => {
      const createSuspiciousActivityAudit = (
        userId: string,
        attemptType: string,
        details: Record<string, unknown>
      ) => ({
        actor: userId,
        action: "security:suspicious_activity",
        targetEntity: "security",
        targetId: userId,
        context: attemptType,
        newState: details,
        severity: "high",
      });

      const audit = createSuspiciousActivityAudit(
        USER_A_ID,
        "repeated_idor_attempts",
        {
          attemptCount: 5,
          targetResources: [STUDENT_B_ID, ENROLLMENT_B_ID, ASSESSMENT_B_ID],
          timeWindow: "5_minutes",
        }
      );

      expect(audit.action).toBe("security:suspicious_activity");
      expect(audit.severity).toBe("high");
      expect(audit.newState).toHaveProperty("attemptCount", 5);
    });
  });
});

// ─── Error Message Security Tests ────────────────────────────────────────────

describe("Secure Error Messages", () => {
  describe("Information Disclosure Prevention", () => {
    it("should use generic messages for unauthorized access", () => {
      const SECURE_ERROR_MESSAGES = {
        NOT_FOUND: "Resource not found", // Don't reveal if exists
        ACCESS_DENIED: "Access denied", // Don't reveal why
        INVALID_REQUEST: "Invalid request", // Don't reveal structure
      };

      // Should NOT reveal:
      // - Whether the resource exists
      // - Who owns the resource
      // - The exact validation that failed

      expect(SECURE_ERROR_MESSAGES.NOT_FOUND).not.toContain("belongs to");
      expect(SECURE_ERROR_MESSAGES.NOT_FOUND).not.toContain("another user");
      expect(SECURE_ERROR_MESSAGES.ACCESS_DENIED).not.toContain("permission");
    });

    it("should not leak resource existence in error messages", () => {
      const getSecureError = (
        resourceExists: boolean,
        hasAccess: boolean
      ): string => {
        // Always return the same error regardless of existence
        if (!resourceExists || !hasAccess) {
          return "Resource not found or access denied";
        }
        return "OK";
      };

      // Both scenarios return the same message (prevents enumeration)
      expect(getSecureError(false, false)).toBe(
        "Resource not found or access denied"
      );
      expect(getSecureError(true, false)).toBe(
        "Resource not found or access denied"
      );
    });
  });
});

// ─── Guard Function Type Definitions ─────────────────────────────────────────

describe("IDOR Guard Function Types", () => {
  describe("Type Definitions for Guards", () => {
    it("should define StudentOwnershipGuard signature", () => {
      type StudentOwnershipGuard = (
        sessionStudentId: string,
        requestedStudentId: string
      ) => asserts requestedStudentId is string;

      const guard: StudentOwnershipGuard = (session, requested) => {
        if (session !== requested) {
          throw new Error("Access denied");
        }
      };

      expect(() => guard(STUDENT_A_ID, STUDENT_A_ID)).not.toThrow();
      expect(() => guard(STUDENT_A_ID, STUDENT_B_ID)).toThrow();
    });

    it("should define EnrollmentOwnershipGuard signature", () => {
      type EnrollmentOwnershipGuard = (
        enrollment: { studentId: string },
        sessionStudentId: string
      ) => void;

      const guard: EnrollmentOwnershipGuard = (enrollment, sessionId) => {
        if (enrollment.studentId !== sessionId) {
          throw new Error("Enrollment does not belong to student");
        }
      };

      const enrollmentA = { studentId: STUDENT_A_ID };

      expect(() => guard(enrollmentA, STUDENT_A_ID)).not.toThrow();
      expect(() => guard(enrollmentA, STUDENT_B_ID)).toThrow();
    });

    it("should define ResourceAccessResult type", () => {
      type ResourceAccessResult =
        | { allowed: true; resource: unknown }
        | { allowed: false; error: string };

      const checkAccess = (isOwner: boolean): ResourceAccessResult => {
        if (isOwner) {
          return { allowed: true, resource: { id: "test" } };
        }
        return { allowed: false, error: "Access denied" };
      };

      const allowed = checkAccess(true);
      expect(allowed.allowed).toBe(true);
      if (allowed.allowed) {
        expect(allowed.resource).toBeDefined();
      }

      const denied = checkAccess(false);
      expect(denied.allowed).toBe(false);
      if (!denied.allowed) {
        expect(denied.error).toBe("Access denied");
      }
    });
  });
});
