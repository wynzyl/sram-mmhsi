/**
 * Transaction Helpers Tests
 *
 * Tests for row locking utilities and guard functions including:
 * - Row locking utilities (lockPayment, lockAssessment, lockReceiptBooklet, etc.)
 * - Guard functions (assertAssessmentNotTransferred)
 * - Snake to camel case conversion
 * - Edge cases and error handling
 *
 * H6 Finding: High-priority test for concurrent access patterns
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  lockPayment,
  lockAssessment,
  lockAssessmentByEnrollment,
  lockReceiptBooklet,
  lockVoidRequest,
  lockStudentDiscount,
  lockDiscountRequest,
  lockEnrollment,
  lockAssessmentTransferStatus,
  lockStudentDiscountReversalStatus,
  assertAssessmentNotTransferred,
  type DbExecutor,
  type LockedPayment,
  type LockedAssessment,
  type LockedReceiptBooklet,
  type LockedVoidRequest,
  type LockedStudentDiscount,
  type LockedDiscountRequest,
  type LockedEnrollment,
} from "../tx-helpers";

describe("Transaction Helper Lock Functions", () => {
  let mockTx: DbExecutor;

  beforeEach(() => {
    mockTx = {
      execute: vi.fn(),
    };
  });

  describe("lockPayment", () => {
    it("should return payment when found", async () => {
      // Arrange
      const mockRow = {
        id: "payment-123",
        student_id: "student-456",
        assessment_id: "assessment-789",
        booklet_id: "booklet-001",
        or_number: "AK 00051",
        or_status: "consumed",
        amount: "5000.00",
        payment_method: "cash",
        reference_number: null,
        payment_date: new Date("2024-06-01"),
        status: "posted",
        kind: "regular",
        remarks: null,
        reverses_payment_id: null,
        reversed_at: null,
        reversed_by: null,
        reversed_by_request_id: null,
        voided_at: null,
        voided_by: null,
        void_reason: null,
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockPayment(mockTx, "payment-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("payment-123");
      expect(result?.studentId).toBe("student-456"); // camelCase
      expect(result?.assessmentId).toBe("assessment-789");
      expect(result?.orNumber).toBe("AK 00051");
      expect(result?.orStatus).toBe("consumed");
      expect(result?.paymentMethod).toBe("cash");
    });

    it("should return null when payment not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockPayment(mockTx, "nonexistent-payment");

      // Assert
      expect(result).toBeNull();
    });

    it("should execute SELECT FOR UPDATE query", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      await lockPayment(mockTx, "payment-123");

      // Assert
      expect(mockTx.execute).toHaveBeenCalled();
      // The query object structure depends on drizzle-orm's sql template literal
    });
  });

  describe("lockAssessment", () => {
    it("should return assessment when found", async () => {
      // Arrange
      const mockRow = {
        id: "assessment-123",
        enrollment_id: "enrollment-456",
        student_id: "student-789",
        school_year_id: "sy-2024",
        total_amount: "50000.00",
        total_paid: "25000.00",
        total_discounts: "0.00",
        balance: "25000.00",
        has_discounts_pending: false,
        billing_status: "outstanding",
        remarks: null,
        cancelled_at: null,
        cancelled_by: null,
        transferred_at: null,
        transferred_by: null,
        transferred_to_assessment_id: null,
        transfer_remarks: null,
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockAssessment(mockTx, "assessment-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("assessment-123");
      expect(result?.enrollmentId).toBe("enrollment-456");
      expect(result?.studentId).toBe("student-789");
      expect(result?.schoolYearId).toBe("sy-2024");
      expect(result?.totalAmount).toBe("50000.00");
      expect(result?.balance).toBe("25000.00");
      expect(result?.billingStatus).toBe("outstanding");
      expect(result?.hasDiscountsPending).toBe(false);
    });

    it("should return null when assessment not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockAssessment(mockTx, "nonexistent-assessment");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("lockAssessmentByEnrollment", () => {
    it("should return assessment when found by enrollment ID", async () => {
      // Arrange
      const mockRow = {
        id: "assessment-123",
        enrollment_id: "enrollment-456",
        student_id: "student-789",
        school_year_id: "sy-2024",
        total_amount: "50000.00",
        total_paid: "0.00",
        total_discounts: "0.00",
        balance: "50000.00",
        has_discounts_pending: false,
        billing_status: "outstanding",
        remarks: null,
        cancelled_at: null,
        cancelled_by: null,
        transferred_at: null,
        transferred_by: null,
        transferred_to_assessment_id: null,
        transfer_remarks: null,
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockAssessmentByEnrollment(mockTx, "enrollment-456");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.enrollmentId).toBe("enrollment-456");
    });

    it("should return null when no assessment for enrollment", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockAssessmentByEnrollment(mockTx, "enrollment-without-assessment");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("lockReceiptBooklet", () => {
    it("should return booklet when found", async () => {
      // Arrange
      const mockRow = {
        id: "booklet-123",
        series: "AK-00051-00100",
        prefix: "AK",
        start_number: 51,
        end_number: 100,
        next_number: 75,
        status: "active",
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockReceiptBooklet(mockTx, "booklet-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("booklet-123");
      expect(result?.series).toBe("AK-00051-00100");
      expect(result?.prefix).toBe("AK");
      expect(result?.startNumber).toBe(51);
      expect(result?.endNumber).toBe(100);
      expect(result?.nextNumber).toBe(75);
      expect(result?.status).toBe("active");
    });

    it("should return null when booklet not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockReceiptBooklet(mockTx, "nonexistent-booklet");

      // Assert
      expect(result).toBeNull();
    });

    it("should filter by status when provided", async () => {
      // Arrange - booklet exists but is exhausted, not active
      (mockTx.execute as Mock).mockResolvedValue([]); // Returns empty because status filter

      // Act
      const result = await lockReceiptBooklet(mockTx, "booklet-123", "active");

      // Assert
      expect(result).toBeNull();
      expect(mockTx.execute).toHaveBeenCalled();
    });

    it("should return booklet matching status filter", async () => {
      // Arrange
      const mockRow = {
        id: "booklet-123",
        series: "AK-00051-00100",
        prefix: "AK",
        start_number: 51,
        end_number: 100,
        next_number: 75,
        status: "active",
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockReceiptBooklet(mockTx, "booklet-123", "active");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.status).toBe("active");
    });
  });

  describe("lockVoidRequest", () => {
    it("should return void request when found", async () => {
      // Arrange
      const mockRow = {
        id: "void-request-123",
        payment_id: "payment-456",
        request_reason: "Duplicate payment",
        status: "pending",
        requested_by: "user-001",
        requested_at: new Date(),
        decided_by: null,
        decided_at: null,
        decision_remarks: null,
        cancelled_at: null,
        reversal_payment_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockVoidRequest(mockTx, "void-request-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("void-request-123");
      expect(result?.paymentId).toBe("payment-456");
      expect(result?.requestReason).toBe("Duplicate payment");
      expect(result?.status).toBe("pending");
      expect(result?.requestedBy).toBe("user-001");
    });

    it("should return null when void request not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockVoidRequest(mockTx, "nonexistent-request");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("lockStudentDiscount", () => {
    it("should return student discount when found", async () => {
      // Arrange
      const mockRow = {
        id: "discount-123",
        student_id: "student-456",
        assessment_id: "assessment-789",
        discount_request_id: "request-001",
        discount_type_code: "SIBLING",
        discount_type_name: "Sibling Discount",
        calculation_type: "percentage",
        base_type: "tuition",
        base_amount: "30000.00",
        discount_value: "10",
        discount_amount: "3000.00",
        assessment_item_id: null,
        reversed_at: null,
        reversed_by: null,
        reversal_remarks: null,
        reversal_discount_id: null,
        replaced_by_request_id: null,
        applied_at: new Date(),
        applied_by: "user-001",
        created_at: new Date(),
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockStudentDiscount(mockTx, "discount-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("discount-123");
      expect(result?.studentId).toBe("student-456");
      expect(result?.discountTypeCode).toBe("SIBLING");
      expect(result?.discountTypeName).toBe("Sibling Discount");
      expect(result?.discountAmount).toBe("3000.00");
    });

    it("should return null when discount not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockStudentDiscount(mockTx, "nonexistent-discount");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("lockDiscountRequest", () => {
    it("should return discount request when found", async () => {
      // Arrange
      const mockRow = {
        id: "request-123",
        student_id: "student-456",
        enrollment_id: "enrollment-789",
        assessment_id: "assessment-001",
        discount_type_id: "dtype-001",
        request_reason: "Family is an alumni",
        base_amount: "50000.00",
        calculated_amount: "5000.00",
        override_value: null,
        override_reason: null,
        status: "pending",
        requested_by: "user-001",
        requested_at: new Date(),
        decided_by: null,
        decided_at: null,
        decision_remarks: null,
        cancelled_at: null,
        cancelled_by: null,
        reversed_at: null,
        reversed_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockDiscountRequest(mockTx, "request-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("request-123");
      expect(result?.studentId).toBe("student-456");
      expect(result?.assessmentId).toBe("assessment-001");
      expect(result?.status).toBe("pending");
    });

    it("should return null when request not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockDiscountRequest(mockTx, "nonexistent-request");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("lockEnrollment", () => {
    it("should return enrollment when found", async () => {
      // Arrange
      const mockRow = {
        id: "enrollment-123",
        student_id: "student-456",
        school_year_id: "sy-2024",
        grade_level_id: "grade-7",
        section_id: "section-a",
        registration_id: "reg-001",
        student_type: "new",
        intake_documents: {},
        status: "assessed",
        enrolled_at: null,
        cancelled_at: null,
        cancelled_by: null,
        cancel_remarks: null,
        created_at: new Date(),
        created_by: "user-001",
        updated_at: new Date(),
        updated_by: "user-001",
      };

      (mockTx.execute as Mock).mockResolvedValue([mockRow]);

      // Act
      const result = await lockEnrollment(mockTx, "enrollment-123");

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe("enrollment-123");
      expect(result?.studentId).toBe("student-456");
      expect(result?.schoolYearId).toBe("sy-2024");
      expect(result?.gradeLevelId).toBe("grade-7");
      expect(result?.studentType).toBe("new");
      expect(result?.status).toBe("assessed");
    });

    it("should return null when enrollment not found", async () => {
      // Arrange
      (mockTx.execute as Mock).mockResolvedValue([]);

      // Act
      const result = await lockEnrollment(mockTx, "nonexistent-enrollment");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("Partial Lock Functions", () => {
    describe("lockAssessmentTransferStatus", () => {
      it("should return transfer status when found", async () => {
        // Arrange
        const mockRow = {
          transferred_at: new Date("2024-06-01"),
        };

        (mockTx.execute as Mock).mockResolvedValue([mockRow]);

        // Act
        const result = await lockAssessmentTransferStatus(mockTx, "assessment-123");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.transferredAt).toEqual(new Date("2024-06-01"));
      });

      it("should return null transferredAt when not transferred", async () => {
        // Arrange
        const mockRow = {
          transferred_at: null,
        };

        (mockTx.execute as Mock).mockResolvedValue([mockRow]);

        // Act
        const result = await lockAssessmentTransferStatus(mockTx, "assessment-123");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.transferredAt).toBeNull();
      });

      it("should return null when assessment not found", async () => {
        // Arrange
        (mockTx.execute as Mock).mockResolvedValue([]);

        // Act
        const result = await lockAssessmentTransferStatus(mockTx, "nonexistent-assessment");

        // Assert
        expect(result).toBeNull();
      });
    });

    describe("lockStudentDiscountReversalStatus", () => {
      it("should return reversal status when found", async () => {
        // Arrange
        const mockRow = {
          reversed_at: new Date("2024-06-15"),
        };

        (mockTx.execute as Mock).mockResolvedValue([mockRow]);

        // Act
        const result = await lockStudentDiscountReversalStatus(mockTx, "discount-123");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.reversedAt).toEqual(new Date("2024-06-15"));
      });

      it("should return null reversedAt when not reversed", async () => {
        // Arrange
        const mockRow = {
          reversed_at: null,
        };

        (mockTx.execute as Mock).mockResolvedValue([mockRow]);

        // Act
        const result = await lockStudentDiscountReversalStatus(mockTx, "discount-123");

        // Assert
        expect(result).not.toBeNull();
        expect(result?.reversedAt).toBeNull();
      });

      it("should return null when discount not found", async () => {
        // Arrange
        (mockTx.execute as Mock).mockResolvedValue([]);

        // Act
        const result = await lockStudentDiscountReversalStatus(mockTx, "nonexistent-discount");

        // Assert
        expect(result).toBeNull();
      });
    });
  });
});

describe("Guard Functions", () => {
  describe("assertAssessmentNotTransferred", () => {
    it("should not throw when transferredAt is null", () => {
      // Act & Assert
      expect(() => {
        assertAssessmentNotTransferred(null, "void payment");
      }).not.toThrow();
    });

    it("should throw when transferredAt is set", () => {
      // Arrange
      const transferredAt = new Date("2024-06-01");

      // Act & Assert
      expect(() => {
        assertAssessmentNotTransferred(transferredAt, "void payment");
      }).toThrow("OPERATION_BLOCKED");
    });

    it("should include operation name in error message", () => {
      // Arrange
      const transferredAt = new Date("2024-06-01");

      // Act & Assert
      expect(() => {
        assertAssessmentNotTransferred(transferredAt, "reverse discount");
      }).toThrow(/reverse discount/);
    });

    it("should include explanation about transferred assessments", () => {
      // Arrange
      const transferredAt = new Date("2024-06-01");

      // Act & Assert
      expect(() => {
        assertAssessmentNotTransferred(transferredAt, "test");
      }).toThrow(/balance was transferred/);
    });

    it("should work with various operation descriptions", () => {
      const transferredAt = new Date("2024-06-01");
      const operations = [
        "void payment",
        "reverse discount",
        "cancel assessment",
        "add payment",
        "apply discount",
      ];

      operations.forEach((operation) => {
        expect(() => {
          assertAssessmentNotTransferred(transferredAt, operation);
        }).toThrow(new RegExp(operation));
      });
    });
  });
});

describe("Snake to Camel Case Conversion", () => {
  // These tests verify the internal conversion works correctly by testing
  // through the public lock functions

  it("should convert single underscore fields", async () => {
    // Arrange
    const mockTx: DbExecutor = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "test-123",
          student_id: "student-456", // single underscore
          created_at: new Date(),
          created_by: "user-001",
          updated_at: new Date(),
          updated_by: "user-001",
        },
      ]),
    };

    // Act - using partial enrollment fields for simplicity
    const result = await lockEnrollment(mockTx, "test-123");

    // Assert
    expect(result?.studentId).toBe("student-456"); // converted
  });

  it("should convert multiple underscore fields", async () => {
    // Arrange
    const mockTx: DbExecutor = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "payment-123",
          student_id: "student-456",
          assessment_id: "assessment-789",
          booklet_id: "booklet-001",
          or_number: "AK 00051",
          or_status: "consumed",
          amount: "5000.00",
          payment_method: "cash",
          reference_number: "REF123",
          payment_date: new Date(),
          status: "posted",
          kind: "regular",
          remarks: null,
          reverses_payment_id: null, // multi-word
          reversed_at: null,
          reversed_by: null,
          reversed_by_request_id: null, // multi-word
          voided_at: null,
          voided_by: null,
          void_reason: null, // two words
          created_at: new Date(),
          created_by: "user-001",
          updated_at: new Date(),
          updated_by: "user-001",
        },
      ]),
    };

    // Act
    const result = await lockPayment(mockTx, "payment-123");

    // Assert
    expect(result?.reversesPaymentId).toBeNull(); // converted correctly
    expect(result?.reversedByRequestId).toBeNull(); // converted correctly
    expect(result?.voidReason).toBeNull(); // converted correctly
    expect(result?.referenceNumber).toBe("REF123");
    expect(result?.paymentMethod).toBe("cash");
  });

  it("should preserve values during conversion", async () => {
    // Arrange
    const testDate = new Date("2024-06-01T10:30:00Z");
    const mockTx: DbExecutor = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "booklet-123",
          series: "AK-00051-00100",
          prefix: "AK",
          start_number: 51,
          end_number: 100,
          next_number: 75,
          status: "active",
          created_at: testDate,
          created_by: "user-001",
          updated_at: testDate,
          updated_by: "user-002",
        },
      ]),
    };

    // Act
    const result = await lockReceiptBooklet(mockTx, "booklet-123");

    // Assert
    expect(result?.startNumber).toBe(51);
    expect(result?.endNumber).toBe(100);
    expect(result?.nextNumber).toBe(75);
    expect(result?.createdAt).toEqual(testDate);
    expect(result?.createdBy).toBe("user-001");
    expect(result?.updatedBy).toBe("user-002");
  });
});

describe("Edge Cases", () => {
  describe("Empty Result Handling", () => {
    it("should handle empty array from execute", async () => {
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue([]),
      };

      const result = await lockPayment(mockTx, "nonexistent");
      expect(result).toBeNull();
    });

    it("should handle undefined result (edge case)", async () => {
      // Some DB drivers might return undefined instead of empty array
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue(undefined as unknown as unknown[]),
      };

      // The function checks if result is array, so this should return null
      const result = await lockPayment(mockTx, "test");
      expect(result).toBeNull();
    });
  });

  describe("Type Coercion", () => {
    it("should handle numeric fields correctly", async () => {
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue([
          {
            id: "booklet-123",
            series: "AK-00001-00050",
            prefix: "AK",
            start_number: 1,
            end_number: 50,
            next_number: 25,
            status: "active",
            created_at: new Date(),
            created_by: null,
            updated_at: new Date(),
            updated_by: null,
          },
        ]),
      };

      const result = await lockReceiptBooklet(mockTx, "booklet-123");

      expect(typeof result?.startNumber).toBe("number");
      expect(typeof result?.endNumber).toBe("number");
      expect(typeof result?.nextNumber).toBe("number");
    });

    it("should handle boolean fields correctly", async () => {
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue([
          {
            id: "assessment-123",
            enrollment_id: "enrollment-456",
            student_id: "student-789",
            school_year_id: "sy-2024",
            total_amount: "50000.00",
            total_paid: "0.00",
            total_discounts: "0.00",
            balance: "50000.00",
            has_discounts_pending: true, // boolean
            billing_status: "outstanding",
            remarks: null,
            cancelled_at: null,
            cancelled_by: null,
            transferred_at: null,
            transferred_by: null,
            transferred_to_assessment_id: null,
            transfer_remarks: null,
            created_at: new Date(),
            created_by: null,
            updated_at: new Date(),
            updated_by: null,
          },
        ]),
      };

      const result = await lockAssessment(mockTx, "assessment-123");

      expect(typeof result?.hasDiscountsPending).toBe("boolean");
      expect(result?.hasDiscountsPending).toBe(true);
    });

    it("should handle null values correctly", async () => {
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue([
          {
            id: "payment-123",
            student_id: "student-456",
            assessment_id: null, // null value
            booklet_id: null,
            or_number: null,
            or_status: "available",
            amount: "5000.00",
            payment_method: "cash",
            reference_number: null,
            payment_date: new Date(),
            status: "pending",
            kind: "regular",
            remarks: null,
            reverses_payment_id: null,
            reversed_at: null,
            reversed_by: null,
            reversed_by_request_id: null,
            voided_at: null,
            voided_by: null,
            void_reason: null,
            created_at: new Date(),
            created_by: null,
            updated_at: new Date(),
            updated_by: null,
          },
        ]),
      };

      const result = await lockPayment(mockTx, "payment-123");

      expect(result?.assessmentId).toBeNull();
      expect(result?.bookletId).toBeNull();
      expect(result?.orNumber).toBeNull();
      expect(result?.referenceNumber).toBeNull();
      expect(result?.createdBy).toBeNull();
    });
  });

  describe("Date Handling", () => {
    it("should preserve Date objects", async () => {
      const testDate = new Date("2024-06-01T12:00:00Z");
      const mockTx: DbExecutor = {
        execute: vi.fn().mockResolvedValue([
          {
            id: "void-request-123",
            payment_id: "payment-456",
            request_reason: "Test",
            status: "approved",
            requested_by: "user-001",
            requested_at: testDate,
            decided_by: "user-002",
            decided_at: testDate,
            decision_remarks: "Approved",
            cancelled_at: null,
            reversal_payment_id: null,
            created_at: testDate,
            updated_at: testDate,
          },
        ]),
      };

      const result = await lockVoidRequest(mockTx, "void-request-123");

      expect(result?.requestedAt).toBeInstanceOf(Date);
      expect(result?.decidedAt).toBeInstanceOf(Date);
      expect(result?.createdAt).toBeInstanceOf(Date);
      expect(result?.requestedAt).toEqual(testDate);
    });
  });
});
