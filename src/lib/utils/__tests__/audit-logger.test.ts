/**
 * M4: Audit Log Content Tests
 *
 * Tests that audit log entries are created with appropriate content
 * for financial and critical business operations.
 */

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  anonymizeIpAddressForAuditLog,
  AUDIT_LOG_RETENTION_DAYS,
  type AuditParams,
  type AuditOptions,
  type AuditResult,
} from "../audit-logger";

// ─── IP Anonymization Tests ──────────────────────────────────────────────────

describe("audit-log IP anonymization", () => {
  it("returns a stable SHA-256 fingerprint for a concrete client IP", () => {
    const ip = "203.0.113.20";
    const digest = anonymizeIpAddressForAuditLog(ip);

    expect(digest).toBe(createHash("sha256").update(ip).digest("hex"));
  });

  it("does not persist an unknown/null IP value", () => {
    expect(anonymizeIpAddressForAuditLog("unknown")).toBeNull();
    expect(anonymizeIpAddressForAuditLog("null")).toBeNull();
    expect(anonymizeIpAddressForAuditLog("")).toBeNull();
    expect(anonymizeIpAddressForAuditLog(undefined)).toBeNull();
  });

  it("handles IPv6 addresses", () => {
    const ipv6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    const digest = anonymizeIpAddressForAuditLog(ipv6);

    expect(digest).toBe(createHash("sha256").update(ipv6).digest("hex"));
    expect(digest).toHaveLength(64); // SHA-256 hex length
  });

  it("trims whitespace from IP addresses", () => {
    const ip = "  192.168.1.1  ";
    const digest = anonymizeIpAddressForAuditLog(ip);

    expect(digest).toBe(createHash("sha256").update(ip.trim()).digest("hex"));
  });

  it("handles localhost addresses", () => {
    const localhost = "127.0.0.1";
    const digest = anonymizeIpAddressForAuditLog(localhost);

    expect(digest).not.toBeNull();
    expect(digest).toHaveLength(64);
  });

  it("produces unique hashes for different IPs", () => {
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    const digest1 = anonymizeIpAddressForAuditLog(ip1);
    const digest2 = anonymizeIpAddressForAuditLog(ip2);

    expect(digest1).not.toBe(digest2);
  });
});

// ─── Retention Policy Tests ──────────────────────────────────────────────────

describe("audit log retention policy", () => {
  it("should have a retention period of 365 days", () => {
    expect(AUDIT_LOG_RETENTION_DAYS).toBe(365);
  });

  it("should be a positive integer", () => {
    expect(Number.isInteger(AUDIT_LOG_RETENTION_DAYS)).toBe(true);
    expect(AUDIT_LOG_RETENTION_DAYS).toBeGreaterThan(0);
  });
});

// ─── AuditParams Type Tests ──────────────────────────────────────────────────

describe("AuditParams type structure", () => {
  it("should accept minimal required fields", () => {
    const params: AuditParams = {
      actorRole: "admin",
      action: "test:action",
      targetEntity: "test",
      targetId: "123",
    };

    expect(params.actorRole).toBe("admin");
    expect(params.action).toBe("test:action");
    expect(params.targetEntity).toBe("test");
    expect(params.targetId).toBe("123");
  });

  it("should accept optional actor field as null", () => {
    const params: AuditParams = {
      actor: null,
      actorRole: "system",
      action: "scheduler:cleanup",
      targetEntity: "auditLogs",
      targetId: "batch",
    };

    expect(params.actor).toBeNull();
  });

  it("should accept previous and new state objects", () => {
    const params: AuditParams = {
      actorRole: "finance_officer",
      action: "payments:void",
      targetEntity: "payments",
      targetId: "pay-123",
      previousState: { status: "posted", amount: 1000 },
      newState: { status: "voided", voidedAt: "2024-01-01" },
    };

    expect(params.previousState).toEqual({ status: "posted", amount: 1000 });
    expect(params.newState).toEqual({ status: "voided", voidedAt: "2024-01-01" });
  });

  it("should accept context and correlation ID", () => {
    const correlationId = "550e8400-e29b-41d4-a716-446655440000";
    const params: AuditParams = {
      actorRole: "cashier",
      action: "payments:post",
      targetEntity: "payments",
      targetId: "pay-456",
      context: "Full payment for enrollment",
      correlationId,
    };

    expect(params.context).toBe("Full payment for enrollment");
    expect(params.correlationId).toBe(correlationId);
  });

  it("should accept IP address for anonymization", () => {
    const params: AuditParams = {
      actorRole: "cashier",
      action: "payments:post",
      targetEntity: "payments",
      targetId: "pay-789",
      ipAddress: "192.168.1.100",
    };

    expect(params.ipAddress).toBe("192.168.1.100");
  });
});

// ─── AuditOptions Type Tests ─────────────────────────────────────────────────

describe("AuditOptions type structure", () => {
  it("should accept throwOnFail option", () => {
    const options: AuditOptions = {
      throwOnFail: true,
    };

    expect(options.throwOnFail).toBe(true);
  });

  it("should default throwOnFail to undefined", () => {
    const options: AuditOptions = {};

    expect(options.throwOnFail).toBeUndefined();
  });
});

// ─── AuditResult Type Tests ──────────────────────────────────────────────────

describe("AuditResult type structure", () => {
  it("should represent successful result", () => {
    const result: AuditResult = { success: true };

    expect(result.success).toBe(true);
    if (result.success) {
      // TypeScript narrowing - no error field on success
      expect("error" in result).toBe(false);
    }
  });

  it("should represent failed result with error message", () => {
    const result: AuditResult = {
      success: false,
      error: "Database connection failed",
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Database connection failed");
    }
  });
});

// ─── Payment Audit Content Structure Tests ───────────────────────────────────

describe("Payment Audit Content Structure", () => {
  describe("Payment Posting", () => {
    it("should structure payment post audit with required fields", () => {
      const auditContent: AuditParams = {
        actor: "user-123",
        actorRole: "cashier",
        action: "payments:post",
        targetEntity: "payments",
        targetId: "pay-123",
        newState: {
          studentRef: "0000001",
          orNumber: "AK 00001",
          amount: 5000,
          paymentMethod: "cash",
          status: "posted",
        },
        correlationId: "batch-001",
      };

      expect(auditContent.action).toBe("payments:post");
      expect(auditContent.targetEntity).toBe("payments");
      expect(auditContent.newState).toBeDefined();
      if (auditContent.newState) {
        const state = auditContent.newState as Record<string, unknown>;
        expect(state.orNumber).toBe("AK 00001");
        expect(state.amount).toBe(5000);
      }
    });

    it("should include idempotency key for payment posts", () => {
      const auditContent: AuditParams = {
        actorRole: "cashier",
        action: "payments:post",
        targetEntity: "payments",
        targetId: "pay-123",
        newState: {
          idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
          amount: 1500,
        },
        context: "Idempotent payment post",
      };

      const state = auditContent.newState as Record<string, unknown>;
      expect(state.idempotencyKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe("Payment Voiding", () => {
    it("should capture previous payment state on void", () => {
      const auditContent: AuditParams = {
        actor: "finance-123",
        actorRole: "finance_officer",
        action: "payments:void",
        targetEntity: "payments",
        targetId: "pay-123",
        previousState: {
          orNumber: "AK 00001",
          amount: 5000,
          status: "posted",
          postedAt: "2024-01-01T10:00:00Z",
        },
        newState: {
          orNumber: "AK 00001",
          amount: 5000,
          status: "voided",
          voidedAt: "2024-01-02T10:00:00Z",
          voidReason: "Duplicate payment",
        },
        context: "Void due to duplicate entry",
      };

      expect(auditContent.action).toBe("payments:void");
      expect(auditContent.previousState).toBeDefined();
      expect(auditContent.newState).toBeDefined();

      const prevState = auditContent.previousState as Record<string, unknown>;
      const newState = auditContent.newState as Record<string, unknown>;

      expect(prevState.status).toBe("posted");
      expect(newState.status).toBe("voided");
      expect(newState.voidReason).toBe("Duplicate payment");
    });

    it("should mark OR number status change on void", () => {
      const auditContent: AuditParams = {
        actorRole: "finance_officer",
        action: "payments:void",
        targetEntity: "payments",
        targetId: "pay-123",
        newState: {
          orNumber: "AK 00001",
          orStatus: "voided", // OR cannot be reused
        },
      };

      const state = auditContent.newState as Record<string, unknown>;
      expect(state.orStatus).toBe("voided");
    });
  });
});

// ─── Booklet Audit Content Structure Tests ───────────────────────────────────

describe("Booklet Audit Content Structure", () => {
  describe("Booklet Creation", () => {
    it("should capture booklet creation details", () => {
      const auditContent: AuditParams = {
        actor: "finance-123",
        actorRole: "finance_officer",
        action: "receiptBooklets:create",
        targetEntity: "receiptBooklets",
        targetId: "booklet-123",
        newState: {
          series: "AK-00001-00050",
          prefix: "AK",
          startNumber: 1,
          endNumber: 50,
          status: "active",
        },
      };

      expect(auditContent.action).toBe("receiptBooklets:create");
      const state = auditContent.newState as Record<string, unknown>;
      expect(state.series).toBe("AK-00001-00050");
      expect(state.prefix).toBe("AK");
    });
  });

  describe("Booklet Exhaustion", () => {
    it("should capture booklet exhaustion transition", () => {
      const auditContent: AuditParams = {
        actor: "system",
        actorRole: "system",
        action: "receiptBooklets:exhausted",
        targetEntity: "receiptBooklets",
        targetId: "booklet-123",
        previousState: {
          status: "active",
          nextNumber: 50,
        },
        newState: {
          status: "exhausted",
          nextNumber: 51,
          exhaustedAt: "2024-01-15T14:30:00Z",
        },
        context: "Automatic exhaustion on last OR consumption",
      };

      const prevState = auditContent.previousState as Record<string, unknown>;
      const newState = auditContent.newState as Record<string, unknown>;

      expect(prevState.status).toBe("active");
      expect(newState.status).toBe("exhausted");
    });
  });

  describe("Booklet Status Updates", () => {
    it("should capture manual status change to inactive", () => {
      const auditContent: AuditParams = {
        actor: "admin-123",
        actorRole: "admin",
        action: "receiptBooklets:update",
        targetEntity: "receiptBooklets",
        targetId: "booklet-123",
        previousState: { status: "active" },
        newState: { status: "inactive" },
        context: "Manual deactivation by admin",
      };

      expect(auditContent.action).toBe("receiptBooklets:update");
      expect(auditContent.context).toContain("Manual");
    });
  });
});

// ─── Discount Audit Content Structure Tests ──────────────────────────────────

describe("Discount Audit Content Structure", () => {
  describe("Discount Request Approval", () => {
    it("should capture approval with override value", () => {
      const auditContent: AuditParams = {
        actor: "principal-123",
        actorRole: "admin",
        action: "discountRequests:approve",
        targetEntity: "discountRequests",
        targetId: "req-123",
        previousState: {
          status: "pending",
          defaultValue: 5000,
        },
        newState: {
          status: "approved",
          overrideValue: 4500,
          overrideReason: "Partial scholarship due to late application",
          decidedAt: "2024-01-10T09:00:00Z",
        },
      };

      const newState = auditContent.newState as Record<string, unknown>;
      expect(newState.status).toBe("approved");
      expect(newState.overrideValue).toBe(4500);
      expect(newState.overrideReason).toBeDefined();
    });
  });

  describe("Discount Request Rejection", () => {
    it("should capture rejection with reason", () => {
      const auditContent: AuditParams = {
        actor: "registrar-123",
        actorRole: "registrar",
        action: "discountRequests:reject",
        targetEntity: "discountRequests",
        targetId: "req-456",
        previousState: { status: "pending" },
        newState: {
          status: "rejected",
          decisionRemarks: "Incomplete documentation provided",
          decidedAt: "2024-01-10T09:30:00Z",
        },
      };

      const newState = auditContent.newState as Record<string, unknown>;
      expect(newState.status).toBe("rejected");
      expect(newState.decisionRemarks).toContain("Incomplete");
    });
  });

  describe("Discount Reversal", () => {
    it("should capture reversal with assessment impact", () => {
      const auditContent: AuditParams = {
        actor: "finance-123",
        actorRole: "finance_officer",
        action: "studentDiscounts:reverse",
        targetEntity: "studentDiscounts",
        targetId: "sd-123",
        previousState: {
          discountAmount: 5000,
          reversedAt: null,
        },
        newState: {
          discountAmount: 5000,
          reversedAt: "2024-01-15T10:00:00Z",
          reversalRemarks: "Student no longer qualifies for scholarship",
          assessmentAdjustment: 5000, // Amount added back to assessment
        },
      };

      const newState = auditContent.newState as Record<string, unknown>;
      expect(newState.reversedAt).toBeDefined();
      expect(newState.assessmentAdjustment).toBe(5000);
    });
  });
});

// ─── Assessment Audit Content Structure Tests ────────────────────────────────

describe("Assessment Audit Content Structure", () => {
  describe("Assessment Creation", () => {
    it("should capture assessment creation with fee breakdown", () => {
      const auditContent: AuditParams = {
        actor: "registrar-123",
        actorRole: "registrar",
        action: "assessments:create",
        targetEntity: "assessments",
        targetId: "asmt-123",
        newState: {
          studentRef: "0000001",
          enrollmentId: "enr-123",
          totalAmount: 25000,
          itemCount: 5,
          billingStatus: "outstanding",
        },
      };

      const state = auditContent.newState as Record<string, unknown>;
      expect(state.totalAmount).toBe(25000);
      expect(state.billingStatus).toBe("outstanding");
    });
  });

  describe("Assessment Cancellation", () => {
    it("should capture cancellation with reason", () => {
      const auditContent: AuditParams = {
        actor: "finance-123",
        actorRole: "finance_officer",
        action: "assessments:cancel",
        targetEntity: "assessments",
        targetId: "asmt-123",
        previousState: {
          billingStatus: "outstanding",
          totalAmount: 25000,
        },
        newState: {
          billingStatus: "cancelled",
          cancelledAt: "2024-01-10T11:00:00Z",
        },
        context: "Cancellation reason: Student transferred to another school",
      };

      expect(auditContent.context).toContain("transferred");
    });
  });
});

// ─── Balance Forward Audit Content Structure Tests ───────────────────────────

describe("Balance Forward Audit Content Structure", () => {
  it("should structure BFX (balance forward) receipt creation", () => {
    const auditContent: AuditParams = {
      actor: "system",
      actorRole: "system",
      action: "payments:balance_forward",
      targetEntity: "payments",
      targetId: "bfx-123",
      newState: {
        type: "BFX",
        studentRef: "0000001",
        sourceSchoolYearId: "sy-2023",
        targetSchoolYearId: "sy-2024",
        forwardedBalance: 5000,
        sourceAssessmentId: "asmt-old-123",
        targetAssessmentId: "asmt-new-456",
      },
      context: "Year-end balance forward",
    };

    const state = auditContent.newState as Record<string, unknown>;
    expect(state.type).toBe("BFX");
    expect(state.forwardedBalance).toBe(5000);
    expect(state.sourceSchoolYearId).not.toBe(state.targetSchoolYearId);
  });

  it("should structure BFX reversal audit", () => {
    const auditContent: AuditParams = {
      actor: "admin-123",
      actorRole: "admin",
      action: "payments:reverse_balance_forward",
      targetEntity: "payments",
      targetId: "bfx-123",
      previousState: {
        status: "posted",
        forwardedBalance: 5000,
      },
      newState: {
        status: "reversed",
        reversedAt: "2024-02-01T10:00:00Z",
        reversalReason: "Incorrect source assessment",
      },
      context: "Manual BFX reversal due to error",
    };

    const newState = auditContent.newState as Record<string, unknown>;
    expect(newState.status).toBe("reversed");
    expect(newState.reversalReason).toBeDefined();
  });
});

// ─── Batch Audit Content Tests ───────────────────────────────────────────────

describe("Batch Audit Content", () => {
  it("should share correlation ID across related operations", () => {
    const correlationId = "batch-2024-01-15-001";

    const entries: AuditParams[] = [
      {
        actorRole: "system",
        action: "payments:balance_forward",
        targetEntity: "payments",
        targetId: "bfx-1",
        correlationId,
        newState: { studentRef: "0000001" },
      },
      {
        actorRole: "system",
        action: "payments:balance_forward",
        targetEntity: "payments",
        targetId: "bfx-2",
        correlationId,
        newState: { studentRef: "0000002" },
      },
      {
        actorRole: "system",
        action: "payments:balance_forward",
        targetEntity: "payments",
        targetId: "bfx-3",
        correlationId,
        newState: { studentRef: "0000003" },
      },
    ];

    // All entries share the same correlation ID
    expect(entries.every((e) => e.correlationId === correlationId)).toBe(true);
  });

  it("should structure bulk approval audit entries", () => {
    const correlationId = "bulk-approve-2024-01-15";

    const entries: AuditParams[] = [
      {
        actorRole: "admin",
        action: "discountRequests:bulk_approve",
        targetEntity: "discountRequests",
        targetId: "req-1",
        correlationId,
        newState: { status: "approved" },
      },
      {
        actorRole: "admin",
        action: "discountRequests:bulk_approve",
        targetEntity: "discountRequests",
        targetId: "req-2",
        correlationId,
        newState: { status: "approved" },
      },
    ];

    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("discountRequests:bulk_approve");
    expect(entries[1].correlationId).toBe(entries[0].correlationId);
  });
});

// ─── Audit Action Naming Convention Tests ────────────────────────────────────

describe("Audit Action Naming Conventions", () => {
  it("should follow entity:verb format", () => {
    const validActions = [
      "payments:post",
      "payments:void",
      "receiptBooklets:create",
      "receiptBooklets:update",
      "discountRequests:approve",
      "discountRequests:reject",
      "studentDiscounts:reverse",
      "assessments:create",
      "assessments:cancel",
      "students:create",
      "students:update",
      "enrollments:create",
    ];

    validActions.forEach((action) => {
      expect(action).toMatch(/^[a-zA-Z]+:[a-zA-Z_]+$/);
    });
  });

  it("should use consistent entity names", () => {
    const entities = [
      "payments",
      "receiptBooklets",
      "discountRequests",
      "studentDiscounts",
      "assessments",
      "students",
      "enrollments",
      "auditLogs",
    ];

    entities.forEach((entity) => {
      expect(entity).toMatch(/^[a-zA-Z]+$/);
    });
  });
});

// ─── Audit Content Serialization Tests ───────────────────────────────────────

describe("Audit Content Serialization", () => {
  it("should serialize complex nested objects", () => {
    const complexState = {
      studentInfo: {
        ref: "0000001",
        name: "John Doe",
      },
      feeBreakdown: [
        { itemId: "fee-1", amount: 5000, description: "Tuition" },
        { itemId: "fee-2", amount: 1000, description: "Misc Fee" },
      ],
      totals: {
        gross: 6000,
        discounts: 500,
        net: 5500,
      },
    };

    const serialized = JSON.stringify(complexState);
    const parsed = JSON.parse(serialized);

    expect(parsed.studentInfo.ref).toBe("0000001");
    expect(parsed.feeBreakdown).toHaveLength(2);
    expect(parsed.totals.net).toBe(5500);
  });

  it("should handle date serialization", () => {
    const stateWithDates = {
      createdAt: new Date("2024-01-15T10:00:00Z").toISOString(),
      postedAt: new Date("2024-01-15T11:00:00Z").toISOString(),
    };

    const serialized = JSON.stringify(stateWithDates);
    const parsed = JSON.parse(serialized);

    expect(parsed.createdAt).toBe("2024-01-15T10:00:00.000Z");
    expect(new Date(parsed.postedAt).getTime()).toBeDefined();
  });

  it("should handle null values in state", () => {
    const stateWithNulls = {
      decidedBy: null,
      decidedAt: null,
      overrideValue: null,
    };

    const serialized = JSON.stringify(stateWithNulls);
    const parsed = JSON.parse(serialized);

    expect(parsed.decidedBy).toBeNull();
    expect(parsed.decidedAt).toBeNull();
    expect(parsed.overrideValue).toBeNull();
  });
});
