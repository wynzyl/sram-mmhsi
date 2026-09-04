/**
 * Balance Forward Utility Tests
 *
 * Tests for reverseBalanceForwardItems() function which handles:
 * - BFX receipt soft-deletion from source assessments
 * - Source assessment balance/status restoration
 * - Audit logging for each operation
 *
 * H2 Finding: High-priority test for balance forward logic
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { reverseBalanceForwardItems } from "../balance-forward";

// Mock the dependencies
vi.mock("@/lib/utils/audit-logger", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/observability/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked modules
import { logAudit } from "@/lib/utils/audit-logger";
import { logger } from "@/lib/observability/logger";

describe("reverseBalanceForwardItems", () => {
  // Mock transaction
  let mockTx: {
    query: {
      assessments: { findFirst: Mock };
      payments: { findMany: Mock };
    };
    update: Mock;
  };

  // Chainable mock for update operations
  let updateChain: { set: Mock; where: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create chainable update mock
    updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      query: {
        assessments: {
          findFirst: vi.fn(),
        },
        payments: {
          findMany: vi.fn(),
        },
      },
      update: vi.fn().mockReturnValue(updateChain),
    };
  });

  describe("basic reversal operations", () => {
    it("should reverse a single balance forward item successfully", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";
      const bfxReceiptId = "bfx-receipt-456";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });

      mockTx.query.payments.findMany.mockResolvedValue([
        { id: bfxReceiptId, referenceNumber: "BFX-2024-001" },
      ]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: "5000.00", schoolYearLabel: "2024-2025" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(1);
      expect(result.restoredAssessmentIds).toEqual([sourceAssessmentId]);
      expect(result.totalAmountRestored).toBe(5000);
    });

    it("should reverse multiple balance forward items from different school years", async () => {
      // Arrange
      const sourceAssessment1 = "source-assessment-2023";
      const sourceAssessment2 = "source-assessment-2024";

      mockTx.query.assessments.findFirst
        .mockResolvedValueOnce({ id: sourceAssessment1 })
        .mockResolvedValueOnce({ id: sourceAssessment2 });

      mockTx.query.payments.findMany
        .mockResolvedValueOnce([{ id: "bfx-1", referenceNumber: "BFX-2023-001" }])
        .mockResolvedValueOnce([{ id: "bfx-2", referenceNumber: "BFX-2024-001" }]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: sourceAssessment1, amount: "3000.00", schoolYearLabel: "2023-2024" },
          { sourceAssessmentId: sourceAssessment2, amount: "2000.00", schoolYearLabel: "2024-2025" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(2);
      expect(result.restoredAssessmentIds).toEqual([sourceAssessment1, sourceAssessment2]);
      expect(result.totalAmountRestored).toBe(5000);
    });

    it("should handle multiple BFX receipts from single source assessment", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });

      // Multiple BFX receipts (e.g., partial transfers)
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-2024-001" },
        { id: "bfx-2", referenceNumber: "BFX-2024-002" },
        { id: "bfx-3", referenceNumber: "BFX-2024-003" },
      ]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: "10000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(3);
      expect(result.restoredAssessmentIds).toEqual([sourceAssessmentId]);
    });
  });

  describe("skip conditions", () => {
    it("should skip items with null sourceAssessmentId", async () => {
      // Arrange - item has no source (e.g., manual entry)
      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: null, amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(0);
      expect(result.restoredAssessmentIds).toEqual([]);
      expect(result.totalAmountRestored).toBe(0);
      expect(mockTx.query.assessments.findFirst).not.toHaveBeenCalled();
    });

    it("should skip and log warning when source assessment not found", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue(null);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "deleted-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(0);
      expect(result.restoredAssessmentIds).toEqual([]);
      expect(result.totalAmountRestored).toBe(0);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("deleted-assessment-123 not found")
      );
    });

    it("should handle mix of valid and invalid source assessments", async () => {
      // Arrange
      mockTx.query.assessments.findFirst
        .mockResolvedValueOnce({ id: "valid-assessment" })
        .mockResolvedValueOnce(null); // Second one not found

      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "valid-assessment", amount: "3000.00" },
          { sourceAssessmentId: "invalid-assessment", amount: "2000.00" },
          { sourceAssessmentId: null, amount: "1000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(1);
      expect(result.restoredAssessmentIds).toEqual(["valid-assessment"]);
      expect(result.totalAmountRestored).toBe(3000);
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });

    it("should handle source assessment with no BFX receipts", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]); // No BFX receipts

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(0);
      expect(result.restoredAssessmentIds).toEqual(["source-assessment-123"]);
      expect(result.totalAmountRestored).toBe(5000);
      // Should still restore assessment even without BFX receipts
      expect(mockTx.update).toHaveBeenCalled();
    });
  });

  describe("BFX receipt soft-deletion", () => {
    it("should soft-delete BFX receipt with correct fields", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";
      const bfxReceiptId = "bfx-receipt-456";
      const userId = "user-001";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: bfxReceiptId, referenceNumber: "BFX-2024-001" },
      ]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId,
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert - verify update was called for BFX receipt
      expect(mockTx.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedBy: userId,
          updatedBy: userId,
          deletedAt: expect.any(Date),
          updatedAt: expect.any(Date),
        })
      );
    });

    it("should create audit log for BFX receipt soft-delete", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";
      const bfxReceiptId = "bfx-receipt-456";
      const targetAssessmentId = "target-assessment-789";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: bfxReceiptId, referenceNumber: "BFX-2024-001" },
      ]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: "5000.00" },
        ],
        targetAssessmentId,
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "user-001",
          actorRole: "finance_officer",
          action: "bfx_receipt_soft_deleted",
          targetEntity: "payments",
          targetId: bfxReceiptId,
          context: sourceAssessmentId,
          newState: expect.objectContaining({
            bfxNumber: "BFX-2024-001",
            reason: "balance_transfer_reversed",
            sourceAssessmentId,
            targetAssessmentId,
          }),
        }),
        { throwOnFail: true }
      );
    });
  });

  describe("source assessment restoration", () => {
    it("should restore source assessment balance and status", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";
      const restoredAmount = "7500.50";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: restoredAmount },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert - verify assessment update was called
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: restoredAmount,
          billingStatus: "outstanding",
          transferredAt: null,
          transferredBy: null,
          transferredToAssessmentId: null,
          transferRemarks: null,
          updatedBy: "user-001",
        })
      );
    });

    it("should create audit log for assessment restoration", async () => {
      // Arrange
      const sourceAssessmentId = "source-assessment-123";
      const targetAssessmentId = "target-assessment-789";

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: sourceAssessmentId,
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId, amount: "5000.00" },
        ],
        targetAssessmentId,
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: "user-001",
          actorRole: "finance_officer",
          action: "assessment_transfer_reversed",
          targetEntity: "assessments",
          targetId: sourceAssessmentId,
          context: targetAssessmentId,
          newState: expect.objectContaining({
            restoredBalance: "5000.00",
            restoredBillingStatus: "outstanding",
            reason: "balance_transfer_reversed",
          }),
        }),
        { throwOnFail: true }
      );
    });
  });

  describe("reason variants", () => {
    it("should use 'balance_transfer_reversed' reason in audit logs", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert - both audit logs should have the correct reason
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "bfx_receipt_soft_deleted",
          newState: expect.objectContaining({
            reason: "balance_transfer_reversed",
          }),
        }),
        expect.anything()
      );
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "assessment_transfer_reversed",
          newState: expect.objectContaining({
            reason: "balance_transfer_reversed",
          }),
        }),
        expect.anything()
      );
    });

    it("should use 'assessment_cancellation' reason in audit logs", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          newState: expect.objectContaining({
            reason: "assessment_cancellation",
          }),
        }),
        expect.anything()
      );
    });
  });

  describe("return value verification", () => {
    it("should return correct bfxReceiptsDeleted count", async () => {
      // Arrange - 2 source assessments, each with 2 BFX receipts
      mockTx.query.assessments.findFirst
        .mockResolvedValueOnce({ id: "source-1" })
        .mockResolvedValueOnce({ id: "source-2" });

      mockTx.query.payments.findMany
        .mockResolvedValueOnce([
          { id: "bfx-1", referenceNumber: "BFX-001" },
          { id: "bfx-2", referenceNumber: "BFX-002" },
        ])
        .mockResolvedValueOnce([
          { id: "bfx-3", referenceNumber: "BFX-003" },
          { id: "bfx-4", referenceNumber: "BFX-004" },
        ]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-1", amount: "3000.00" },
          { sourceAssessmentId: "source-2", amount: "2000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(4);
    });

    it("should return all restored assessment IDs in order", async () => {
      // Arrange
      mockTx.query.assessments.findFirst
        .mockResolvedValueOnce({ id: "source-alpha" })
        .mockResolvedValueOnce({ id: "source-beta" })
        .mockResolvedValueOnce({ id: "source-gamma" });

      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-alpha", amount: "1000.00" },
          { sourceAssessmentId: "source-beta", amount: "2000.00" },
          { sourceAssessmentId: "source-gamma", amount: "3000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.restoredAssessmentIds).toEqual([
        "source-alpha",
        "source-beta",
        "source-gamma",
      ]);
    });

    it("should calculate totalAmountRestored as sum of all amounts", async () => {
      // Arrange
      mockTx.query.assessments.findFirst
        .mockResolvedValueOnce({ id: "source-1" })
        .mockResolvedValueOnce({ id: "source-2" })
        .mockResolvedValueOnce({ id: "source-3" });

      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-1", amount: "1234.56" },
          { sourceAssessmentId: "source-2", amount: "7890.12" },
          { sourceAssessmentId: "source-3", amount: "345.67" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      // 1234.56 + 7890.12 + 345.67 = 9470.35
      expect(result.totalAmountRestored).toBeCloseTo(9470.35, 2);
    });

    it("should return zeros when no items are processed", async () => {
      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.bfxReceiptsDeleted).toBe(0);
      expect(result.restoredAssessmentIds).toEqual([]);
      expect(result.totalAmountRestored).toBe(0);
    });
  });

  describe("role handling", () => {
    it("should pass finance_officer role to audit logs", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: "finance_officer",
        }),
        expect.anything()
      );
    });

    it("should pass admin role to audit logs", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "admin",
        reason: "assessment_cancellation",
      });

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: "admin",
        }),
        expect.anything()
      );
    });
  });

  describe("audit log ordering", () => {
    it("should create BFX receipt audit log before assessment restoration audit log", async () => {
      // Arrange
      const auditCalls: string[] = [];
      (logAudit as Mock).mockImplementation(async (params) => {
        auditCalls.push(params.action);
      });

      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      // Act
      await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert - BFX deletion audit should come before assessment restoration
      const bfxIndex = auditCalls.indexOf("bfx_receipt_soft_deleted");
      const restorationIndex = auditCalls.indexOf("assessment_transfer_reversed");
      expect(bfxIndex).toBeLessThan(restorationIndex);
    });
  });

  describe("error handling", () => {
    it("should propagate audit log errors with throwOnFail: true", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      (logAudit as Mock).mockRejectedValueOnce(new Error("Audit log failed"));

      // Act & Assert
      await expect(
        reverseBalanceForwardItems({
          tx: mockTx as any,
          balanceForwardItems: [
            { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
          ],
          targetAssessmentId: "target-assessment-789",
          userId: "user-001",
          userRole: "finance_officer",
          reason: "balance_transfer_reversed",
        })
      ).rejects.toThrow("Audit log failed");
    });

    it("should propagate database errors from payment update", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([
        { id: "bfx-1", referenceNumber: "BFX-001" },
      ]);

      updateChain.where.mockRejectedValueOnce(new Error("Database connection lost"));

      // Act & Assert
      await expect(
        reverseBalanceForwardItems({
          tx: mockTx as any,
          balanceForwardItems: [
            { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
          ],
          targetAssessmentId: "target-assessment-789",
          userId: "user-001",
          userRole: "finance_officer",
          reason: "balance_transfer_reversed",
        })
      ).rejects.toThrow("Database connection lost");
    });

    it("should propagate database errors from assessment query", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockRejectedValue(
        new Error("Query timeout")
      );

      // Act & Assert
      await expect(
        reverseBalanceForwardItems({
          tx: mockTx as any,
          balanceForwardItems: [
            { sourceAssessmentId: "source-assessment-123", amount: "5000.00" },
          ],
          targetAssessmentId: "target-assessment-789",
          userId: "user-001",
          userRole: "finance_officer",
          reason: "balance_transfer_reversed",
        })
      ).rejects.toThrow("Query timeout");
    });
  });

  describe("edge cases", () => {
    it("should handle decimal amounts correctly", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "12345.99" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.totalAmountRestored).toBeCloseTo(12345.99, 2);
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: "12345.99",
        })
      );
    });

    it("should handle zero amounts", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "0.00" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.totalAmountRestored).toBe(0);
    });

    it("should handle very large amounts", async () => {
      // Arrange
      mockTx.query.assessments.findFirst.mockResolvedValue({
        id: "source-assessment-123",
      });
      mockTx.query.payments.findMany.mockResolvedValue([]);

      // Act
      const result = await reverseBalanceForwardItems({
        tx: mockTx as any,
        balanceForwardItems: [
          { sourceAssessmentId: "source-assessment-123", amount: "9999999.99" },
        ],
        targetAssessmentId: "target-assessment-789",
        userId: "user-001",
        userRole: "finance_officer",
        reason: "balance_transfer_reversed",
      });

      // Assert
      expect(result.totalAmountRestored).toBeCloseTo(9999999.99, 2);
    });
  });
});
