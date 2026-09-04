/**
 * Manual OR Entry Validation Tests
 *
 * Tests for manual OR number entry validation in PostPaymentSchema including:
 * - Manual OR number format validation (prefix + 5-digit sequence)
 * - Manual payment date validation (required, not future)
 * - Toggle between manual and auto-assign modes
 * - Edge cases: boundary values, invalid formats
 *
 * H3 Finding: High-priority test for manual OR entry validation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PostPaymentSchema,
  CreateBookletSchema,
  normalizeBookletSeriesInput,
  formatBookletSeriesCanonical,
} from "../payments.schema";

describe("Manual OR Entry Validation", () => {
  // Base valid payment data for reuse
  const basePaymentData = {
    studentId: "550e8400-e29b-41d4-a716-446655440001",
    assessmentId: "550e8400-e29b-41d4-a716-446655440002",
    amount: 5000,
    paymentMethod: "cash" as const,
    amountTendered: 5000,
    isManualEntry: false,
    bookletId: "550e8400-e29b-41d4-a716-446655440003",
  };

  describe("Manual Entry Toggle", () => {
    it("should require bookletId when isManualEntry is false", () => {
      // Arrange
      const data = {
        ...basePaymentData,
        isManualEntry: false,
        bookletId: undefined, // Missing bookletId
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.bookletId).toBeDefined();
        expect(errors.bookletId).toContain("Booklet selection is required.");
      }
    });

    it("should not require bookletId when isManualEntry is true", () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const data = {
        ...basePaymentData,
        isManualEntry: true,
        bookletId: undefined, // No bookletId needed
        manualOrNumber: "AK 00050",
        manualPaymentDate: yesterday,
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should require manualOrNumber when isManualEntry is true", () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const data = {
        ...basePaymentData,
        isManualEntry: true,
        bookletId: undefined,
        manualOrNumber: undefined, // Missing
        manualPaymentDate: yesterday,
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
        expect(errors.manualOrNumber).toContain("OR number is required for manual entries.");
      }
    });

    it("should require manualPaymentDate when isManualEntry is true", () => {
      // Arrange
      const data = {
        ...basePaymentData,
        isManualEntry: true,
        bookletId: undefined,
        manualOrNumber: "AK 00050",
        manualPaymentDate: undefined, // Missing
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualPaymentDate).toBeDefined();
        expect(errors.manualPaymentDate).toContain("Payment date is required for manual entries.");
      }
    });

    it("should parse string 'true' as boolean true for isManualEntry", () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const data = {
        ...basePaymentData,
        isManualEntry: "true", // String from form
        bookletId: undefined,
        manualOrNumber: "AK 00050",
        manualPaymentDate: yesterday,
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isManualEntry).toBe(true);
      }
    });

    it("should parse string 'false' as boolean false for isManualEntry", () => {
      // Arrange
      const data = {
        ...basePaymentData,
        isManualEntry: "false", // String from form
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isManualEntry).toBe(false);
      }
    });
  });

  describe("Manual OR Number Format Validation", () => {
    const validManualEntryBase = () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        ...basePaymentData,
        isManualEntry: true,
        bookletId: undefined,
        manualPaymentDate: yesterday,
      };
    };

    it("should accept valid OR format 'XX 00000'", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK 00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept OR with lowercase letters (normalized to uppercase)", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "ak 00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.manualOrNumber).toBe("AK 00050");
      }
    });

    it("should accept minimum sequence number 00001", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK 00001" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept maximum sequence number 99999", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "ZZ 99999" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject OR with only one letter prefix", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "A 00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
        expect(errors.manualOrNumber).toContain("OR must be format 'XX 00000' (e.g. AK 00050).");
      }
    });

    it("should reject OR with three letter prefix", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "ABC 00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should reject OR with numeric prefix", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "12 00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should reject OR with only 4 digits", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK 0050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should reject OR with 6 digits", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK 000050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should accept OR with sequence 00000 (format valid, business validation elsewhere)", () => {
      // Arrange - The regex only validates format, not that sequence > 0
      // Business validation for valid range is done at the action level
      const data = { ...validManualEntryBase(), manualOrNumber: "AK 00000" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert - Format is valid per OR_NUMBER_REGEX
      expect(result.success).toBe(true);
    });

    it("should reject OR with no space separator", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should reject OR with dash separator", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "AK-00050" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should reject empty OR number string", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
        expect(errors.manualOrNumber).toContain("OR number is required for manual entries.");
      }
    });

    it("should reject whitespace-only OR number", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "   " };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualOrNumber).toBeDefined();
      }
    });

    it("should trim whitespace from OR number", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualOrNumber: "  AK 00050  " };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.manualOrNumber).toBe("AK 00050");
      }
    });
  });

  describe("Manual Payment Date Validation", () => {
    const validManualEntryBase = () => ({
      ...basePaymentData,
      isManualEntry: true,
      bookletId: undefined,
      manualOrNumber: "AK 00050",
    });

    it("should accept payment date from yesterday", () => {
      // Arrange
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const data = { ...validManualEntryBase(), manualPaymentDate: yesterday };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept payment date from last month", () => {
      // Arrange
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const data = { ...validManualEntryBase(), manualPaymentDate: lastMonth };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept payment date from previous year", () => {
      // Arrange
      const lastYear = new Date();
      lastYear.setFullYear(lastYear.getFullYear() - 1);
      const data = { ...validManualEntryBase(), manualPaymentDate: lastYear };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject future payment date", () => {
      // Arrange
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const data = { ...validManualEntryBase(), manualPaymentDate: tomorrow };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualPaymentDate).toBeDefined();
        expect(errors.manualPaymentDate).toContain("Payment date cannot be in the future.");
      }
    });

    it("should reject date one week in the future", () => {
      // Arrange
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const data = { ...validManualEntryBase(), manualPaymentDate: nextWeek };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualPaymentDate).toBeDefined();
      }
    });

    it("should parse date string to Date object", () => {
      // Arrange
      const dateString = "2024-06-15";
      const data = { ...validManualEntryBase(), manualPaymentDate: dateString };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.manualPaymentDate).toBeInstanceOf(Date);
      }
    });

    it("should handle empty string as undefined", () => {
      // Arrange
      const data = { ...validManualEntryBase(), manualPaymentDate: "" };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.manualPaymentDate).toBeDefined();
        expect(errors.manualPaymentDate).toContain("Payment date is required for manual entries.");
      }
    });
  });

  describe("Auto-Assign Mode (isManualEntry=false)", () => {
    it("should accept valid auto-assign payment without manual fields", () => {
      // Arrange
      const data = {
        ...basePaymentData,
        isManualEntry: false,
        manualOrNumber: undefined,
        manualPaymentDate: undefined,
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should ignore manual fields when isManualEntry is false", () => {
      // Arrange - provide manual fields but isManualEntry=false
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const data = {
        ...basePaymentData,
        isManualEntry: false,
        manualOrNumber: "INVALID", // Invalid format but should be ignored
        manualPaymentDate: tomorrow, // Future date but should be ignored
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert - should succeed because manual fields are ignored
      expect(result.success).toBe(true);
    });

    it("should require valid UUID for bookletId in auto-assign mode", () => {
      // Arrange
      const data = {
        ...basePaymentData,
        isManualEntry: false,
        bookletId: "not-a-uuid",
      };

      // Act
      const result = PostPaymentSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Booklet Schema Validation", () => {
  describe("Prefix Validation", () => {
    const validBookletBase = {
      series: "AK-00051-00100",
      prefix: "AK",
      startNumber: 51,
      endNumber: 100,
      usageMode: "auto_only" as const,
    };

    it("should accept two-letter prefix", () => {
      // Act
      const result = CreateBookletSchema.safeParse(validBookletBase);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept lowercase prefix (will be normalized)", () => {
      // Arrange - lowercase prefix
      const data = {
        ...validBookletBase,
        prefix: "ak",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert - The schema doesn't normalize but the series comparison will catch this
      // Actually the schema validates prefix against BOOKLET_PREFIX_REGEX which is case-insensitive
      expect(result.success).toBe(true);
    });

    it("should reject single-letter prefix", () => {
      // Arrange
      const data = {
        ...validBookletBase,
        series: "A-00051-00100",
        prefix: "A",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.prefix).toBeDefined();
        expect(errors.prefix?.[0]).toContain("Prefix must be exactly 2 letters");
      }
    });

    it("should reject three-letter prefix", () => {
      // Arrange
      const data = {
        ...validBookletBase,
        series: "ABC-00051-00100",
        prefix: "ABC",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.prefix).toBeDefined();
      }
    });

    it("should reject numeric prefix", () => {
      // Arrange
      const data = {
        ...validBookletBase,
        series: "12-00051-00100",
        prefix: "12",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.prefix).toBeDefined();
      }
    });

    it("should reject alphanumeric prefix", () => {
      // Arrange
      const data = {
        ...validBookletBase,
        series: "A1-00051-00100",
        prefix: "A1",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.prefix).toBeDefined();
      }
    });

    it("should reject empty prefix", () => {
      // Arrange
      const data = {
        ...validBookletBase,
        series: "-00051-00100",
        prefix: "",
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("Number Range Validation", () => {
    const validBookletBase = (start: number, end: number) => ({
      series: formatBookletSeriesCanonical("AK", start, end),
      prefix: "AK",
      startNumber: start,
      endNumber: end,
      usageMode: "auto_only" as const,
    });

    it("should accept valid 50-receipt range (51-100)", () => {
      // Arrange
      const data = validBookletBase(51, 100);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept valid 50-receipt range starting from 1", () => {
      // Arrange
      const data = validBookletBase(1, 50);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject range with only 49 receipts", () => {
      // Arrange - 52 to 100 = 49 receipts
      const data = validBookletBase(52, 100);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.endNumber).toBeDefined();
        expect(errors.endNumber?.[0]).toContain("exactly 50 OR numbers");
      }
    });

    it("should reject range with 51 receipts", () => {
      // Arrange - 50 to 100 = 51 receipts
      const data = validBookletBase(50, 100);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.endNumber).toBeDefined();
      }
    });

    it("should reject end number less than start number", () => {
      // Arrange - reversed range
      const data = {
        series: "AK-00100-00051",
        prefix: "AK",
        startNumber: 100,
        endNumber: 51,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.endNumber).toBeDefined();
        expect(errors.endNumber?.[0]).toContain("greater than or equal to start");
      }
    });

    it("should reject start number of 0", () => {
      // Arrange
      const data = validBookletBase(0, 49);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.startNumber).toBeDefined();
        expect(errors.startNumber?.[0]).toContain("at least 1");
      }
    });

    it("should reject start number exceeding max (99999)", () => {
      // Arrange
      const data = {
        series: "AK-100000-100049",
        prefix: "AK",
        startNumber: 100000,
        endNumber: 100049,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.startNumber).toBeDefined();
        expect(errors.startNumber?.[0]).toContain("at most 99999");
      }
    });

    it("should accept range at maximum boundary (99950-99999)", () => {
      // Arrange
      const data = validBookletBase(99950, 99999);

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("Series Canonical Format Validation", () => {
    it("should accept correctly formatted series", () => {
      // Arrange
      const data = {
        series: "AK-00051-00100",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should reject series with mismatched prefix", () => {
      // Arrange - series says BK but prefix says AK
      const data = {
        series: "BK-00051-00100",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.series).toBeDefined();
        expect(errors.series?.[0]).toContain("must exactly match");
      }
    });

    it("should reject series with mismatched start number", () => {
      // Arrange - series says 00001 but startNumber is 51
      const data = {
        series: "AK-00001-00100",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.series).toBeDefined();
      }
    });

    it("should reject series with mismatched end number", () => {
      // Arrange - series says 00200 but endNumber is 100
      const data = {
        series: "AK-00051-00200",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.series).toBeDefined();
      }
    });

    it("should normalize series with extra whitespace", () => {
      // Arrange - series with spaces
      const data = {
        series: "  AK - 00051 - 00100  ",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should normalize series with lowercase", () => {
      // Arrange - lowercase series
      const data = {
        series: "ak-00051-00100",
        prefix: "AK",
        startNumber: 51,
        endNumber: 100,
        usageMode: "auto_only" as const,
      };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("Usage Mode Validation", () => {
    const validBookletBase = {
      series: "AK-00051-00100",
      prefix: "AK",
      startNumber: 51,
      endNumber: 100,
    };

    it("should accept 'auto_only' usage mode", () => {
      // Arrange
      const data = { ...validBookletBase, usageMode: "auto_only" };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usageMode).toBe("auto_only");
      }
    });

    it("should accept 'manual_only' usage mode", () => {
      // Arrange
      const data = { ...validBookletBase, usageMode: "manual_only" };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usageMode).toBe("manual_only");
      }
    });

    it("should default to 'auto_only' when usageMode not provided", () => {
      // Arrange - no usageMode
      const data = validBookletBase;

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.usageMode).toBe("auto_only");
      }
    });

    it("should reject invalid usage mode", () => {
      // Arrange
      const data = { ...validBookletBase, usageMode: "both" };

      // Act
      const result = CreateBookletSchema.safeParse(data);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("Helper Functions", () => {
  describe("formatBookletSeriesCanonical", () => {
    it("should format standard booklet series", () => {
      // Act
      const result = formatBookletSeriesCanonical("AK", 51, 100);

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should pad start and end numbers to 5 digits", () => {
      // Act
      const result = formatBookletSeriesCanonical("AB", 1, 50);

      // Assert
      expect(result).toBe("AB-00001-00050");
    });

    it("should uppercase lowercase prefix", () => {
      // Act
      const result = formatBookletSeriesCanonical("ak", 51, 100);

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should handle maximum numbers", () => {
      // Act
      const result = formatBookletSeriesCanonical("ZZ", 99950, 99999);

      // Assert
      expect(result).toBe("ZZ-99950-99999");
    });

    it("should trim whitespace from prefix", () => {
      // Act
      const result = formatBookletSeriesCanonical("  AK  ", 51, 100);

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should handle decimal numbers by flooring", () => {
      // Act
      const result = formatBookletSeriesCanonical("AK", 51.9, 100.1);

      // Assert
      expect(result).toBe("AK-00051-00100");
    });
  });

  describe("normalizeBookletSeriesInput", () => {
    it("should normalize standard input", () => {
      // Act
      const result = normalizeBookletSeriesInput("AK-00051-00100");

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should uppercase lowercase input", () => {
      // Act
      const result = normalizeBookletSeriesInput("ak-00051-00100");

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should trim leading/trailing whitespace", () => {
      // Act
      const result = normalizeBookletSeriesInput("  AK-00051-00100  ");

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should remove spaces around dashes", () => {
      // Act
      const result = normalizeBookletSeriesInput("AK - 00051 - 00100");

      // Assert
      expect(result).toBe("AK-00051-00100");
    });

    it("should collapse multiple whitespace", () => {
      // Act
      const result = normalizeBookletSeriesInput("AK   -   00051   -   00100");

      // Assert
      expect(result).toBe("AK-00051-00100");
    });
  });
});
