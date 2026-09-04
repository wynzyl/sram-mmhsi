/**
 * M1: Component Utility Tests
 *
 * Tests for utility functions that support component behavior.
 * These are pure functions that components depend on for calculations,
 * formatting, validation, and state management.
 *
 * Note: Direct component rendering tests require @testing-library/react.
 * These tests focus on the logic layer that components consume.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Assessment utilities
import { computeAssessmentTotals } from "@/features/assessments/assessments.schema";

// Grade entry utilities
import {
  isAcceptableGradeInput,
  resolveGradeCommit,
  GRADE_INPUT_MIN,
  GRADE_INPUT_MAX,
} from "@/features/academics/grades/grade-entry-validation";

// Grade key utilities
import {
  gradeKey,
  parseGradeKey,
  type GradeKey,
} from "@/features/academics/grades/utils/grade-key";

// Portal utilities
import {
  generatePortalPassword,
  formatDateAsPassword,
  isValidDatePassword,
  isStudentReferenceNumber,
} from "@/features/students/students-portal.utils";

// Photo validation utilities
import {
  isValidPhotoType,
  isValidPhotoSize,
  getPhotoValidationError,
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_SIZE_BYTES,
} from "@/features/students/students-photo.schema";

// Booklet formatting utilities
import {
  formatBookletSeriesCanonical,
  normalizeBookletSeriesInput,
} from "@/features/payments/payments.schema";

// ─── Assessment Calculation Tests ────────────────────────────────────────────

describe("computeAssessmentTotals", () => {
  it("should sum regular fee items", () => {
    const items = [
      { amount: 5000, isDiscount: false },
      { amount: 2000, isDiscount: false },
      { amount: 1500, isDiscount: false },
    ];

    const total = computeAssessmentTotals(items);

    expect(total).toBe(8500);
  });

  it("should subtract discount items", () => {
    const items = [
      { amount: 10000, isDiscount: false },
      { amount: 500, isDiscount: true },
    ];

    const total = computeAssessmentTotals(items);

    expect(total).toBe(9500);
  });

  it("should handle mixed items", () => {
    const items = [
      { amount: 10000, isDiscount: false }, // Tuition
      { amount: 1000, isDiscount: false }, // Misc fee
      { amount: 500, isDiscount: true }, // Early bird discount
      { amount: 200, isDiscount: true }, // Sibling discount
    ];

    const total = computeAssessmentTotals(items);

    expect(total).toBe(10300); // 10000 + 1000 - 500 - 200
  });

  it("should return 0 for empty items array", () => {
    const total = computeAssessmentTotals([]);

    expect(total).toBe(0);
  });

  it("should handle all discounts (negative total)", () => {
    const items = [
      { amount: 100, isDiscount: true },
      { amount: 200, isDiscount: true },
    ];

    const total = computeAssessmentTotals(items);

    expect(total).toBe(-300);
  });

  it("should handle decimal amounts", () => {
    const items = [
      { amount: 1000.5, isDiscount: false },
      { amount: 0.5, isDiscount: true },
    ];

    const total = computeAssessmentTotals(items);

    expect(total).toBe(1000);
  });
});

// ─── Grade Entry Validation Tests ────────────────────────────────────────────

describe("Grade Entry Validation", () => {
  describe("Constants", () => {
    it("should have correct grade bounds", () => {
      expect(GRADE_INPUT_MIN).toBe(60);
      expect(GRADE_INPUT_MAX).toBe(100);
    });
  });

  describe("isAcceptableGradeInput", () => {
    it("should accept empty string (allows clearing)", () => {
      expect(isAcceptableGradeInput("")).toBe(true);
    });

    it("should accept single digits", () => {
      expect(isAcceptableGradeInput("1")).toBe(true);
      expect(isAcceptableGradeInput("6")).toBe(true);
      expect(isAcceptableGradeInput("9")).toBe(true);
    });

    it("should accept two digits", () => {
      expect(isAcceptableGradeInput("60")).toBe(true);
      expect(isAcceptableGradeInput("75")).toBe(true);
      expect(isAcceptableGradeInput("99")).toBe(true);
    });

    it("should accept three digits up to max", () => {
      expect(isAcceptableGradeInput("100")).toBe(true);
    });

    it("should reject values above max", () => {
      expect(isAcceptableGradeInput("101")).toBe(false);
      expect(isAcceptableGradeInput("150")).toBe(false);
      expect(isAcceptableGradeInput("999")).toBe(false);
    });

    it("should reject more than 3 digits", () => {
      expect(isAcceptableGradeInput("1000")).toBe(false);
      expect(isAcceptableGradeInput("0000")).toBe(false);
    });

    it("should reject non-numeric input", () => {
      expect(isAcceptableGradeInput("abc")).toBe(false);
      expect(isAcceptableGradeInput("7.5")).toBe(false);
      expect(isAcceptableGradeInput("-5")).toBe(false);
    });

    it("should NOT enforce minimum (allows typing)", () => {
      // User must be able to type "6" before "60"
      expect(isAcceptableGradeInput("5")).toBe(true);
      expect(isAcceptableGradeInput("1")).toBe(true);
    });
  });

  describe("resolveGradeCommit", () => {
    it("should commit empty string (clear grade)", () => {
      const result = resolveGradeCommit("");

      expect(result.action).toBe("commit");
      if (result.action === "commit") {
        expect(result.value).toBe("");
      }
    });

    it("should commit valid grades within range", () => {
      const result60 = resolveGradeCommit("60");
      expect(result60).toEqual({ action: "commit", value: "60" });

      const result75 = resolveGradeCommit("75");
      expect(result75).toEqual({ action: "commit", value: "75" });

      const result100 = resolveGradeCommit("100");
      expect(result100).toEqual({ action: "commit", value: "100" });
    });

    it("should revert grades below minimum", () => {
      const result = resolveGradeCommit("59");
      expect(result.action).toBe("revert");

      const result50 = resolveGradeCommit("50");
      expect(result50.action).toBe("revert");

      const result1 = resolveGradeCommit("1");
      expect(result1.action).toBe("revert");
    });

    it("should revert grades above maximum", () => {
      const result = resolveGradeCommit("101");
      expect(result.action).toBe("revert");

      const result150 = resolveGradeCommit("150");
      expect(result150.action).toBe("revert");
    });

    it("should revert non-numeric input", () => {
      const result = resolveGradeCommit("abc");
      expect(result.action).toBe("revert");
    });
  });
});

// ─── Grade Key Utility Tests ─────────────────────────────────────────────────

describe("Grade Key Utilities", () => {
  describe("gradeKey", () => {
    it("should create key from student and subject IDs", () => {
      const key = gradeKey("student-123", "subject-456");

      expect(key).toBe("student-123:subject-456");
    });

    it("should handle UUID-style IDs", () => {
      const key = gradeKey(
        "550e8400-e29b-41d4-a716-446655440001",
        "550e8400-e29b-41d4-a716-446655440002"
      );

      expect(key).toContain(":");
      expect(key.split(":")).toHaveLength(2);
    });

    it("should be consistent for same inputs", () => {
      const key1 = gradeKey("a", "b");
      const key2 = gradeKey("a", "b");

      expect(key1).toBe(key2);
    });
  });

  describe("parseGradeKey", () => {
    it("should parse key back to components", () => {
      const key: GradeKey = "student-123:subject-456";
      const { studentId, subjectId } = parseGradeKey(key);

      expect(studentId).toBe("student-123");
      expect(subjectId).toBe("subject-456");
    });

    it("should handle UUID-style keys", () => {
      const key: GradeKey = "550e8400-e29b-41d4-a716-446655440001:550e8400-e29b-41d4-a716-446655440002";
      const { studentId, subjectId } = parseGradeKey(key);

      expect(studentId).toBe("550e8400-e29b-41d4-a716-446655440001");
      expect(subjectId).toBe("550e8400-e29b-41d4-a716-446655440002");
    });

    it("should roundtrip correctly", () => {
      const originalStudentId = "student-abc";
      const originalSubjectId = "subject-xyz";

      const key = gradeKey(originalStudentId, originalSubjectId);
      const { studentId, subjectId } = parseGradeKey(key);

      expect(studentId).toBe(originalStudentId);
      expect(subjectId).toBe(originalSubjectId);
    });
  });
});

// ─── Portal Utility Tests ────────────────────────────────────────────────────

describe("Portal Utilities", () => {
  describe("formatDateAsPassword", () => {
    it("should format date as YYYYMMDD", () => {
      const date = new Date(2010, 2, 15); // March 15, 2010
      const password = formatDateAsPassword(date);

      expect(password).toBe("20100315");
    });

    it("should pad single-digit month and day", () => {
      const date = new Date(2015, 0, 5); // January 5, 2015
      const password = formatDateAsPassword(date);

      expect(password).toBe("20150105");
    });

    it("should handle December 31", () => {
      const date = new Date(2020, 11, 31); // December 31, 2020
      const password = formatDateAsPassword(date);

      expect(password).toBe("20201231");
    });
  });

  describe("generatePortalPassword", () => {
    it("should use date of birth when available", () => {
      const dob = new Date(2010, 5, 20); // June 20, 2010
      const password = generatePortalPassword(dob, "0000123");

      expect(password).toBe("20100620");
    });

    it("should use fallback when DOB is null", () => {
      const password = generatePortalPassword(null, "0000123");
      const currentYear = new Date().getFullYear();

      expect(password).toBe(`0000123${currentYear}`);
    });

    it("should use fallback when DOB is undefined", () => {
      const password = generatePortalPassword(undefined, "0000456");
      const currentYear = new Date().getFullYear();

      expect(password).toBe(`0000456${currentYear}`);
    });
  });

  describe("isValidDatePassword", () => {
    it("should accept valid YYYYMMDD format", () => {
      expect(isValidDatePassword("20100315")).toBe(true);
      expect(isValidDatePassword("20201231")).toBe(true);
      expect(isValidDatePassword("19990101")).toBe(true);
    });

    it("should reject wrong length", () => {
      expect(isValidDatePassword("2010315")).toBe(false); // 7 chars
      expect(isValidDatePassword("201003155")).toBe(false); // 9 chars
    });

    it("should reject non-numeric", () => {
      expect(isValidDatePassword("2010O315")).toBe(false); // O not 0
      expect(isValidDatePassword("abcdefgh")).toBe(false);
    });

    it("should reject invalid year", () => {
      expect(isValidDatePassword("18000101")).toBe(false); // Too old
      expect(isValidDatePassword("21500101")).toBe(false); // Too future
    });

    it("should reject invalid month", () => {
      expect(isValidDatePassword("20101301")).toBe(false); // Month 13
      expect(isValidDatePassword("20100001")).toBe(false); // Month 0
    });

    it("should reject invalid day", () => {
      expect(isValidDatePassword("20100132")).toBe(false); // Day 32
      expect(isValidDatePassword("20100100")).toBe(false); // Day 0
    });
  });

  describe("isStudentReferenceNumber", () => {
    it("should accept 7-digit reference", () => {
      expect(isStudentReferenceNumber("0000001")).toBe(true);
      expect(isStudentReferenceNumber("1234567")).toBe(true);
      expect(isStudentReferenceNumber("9999999")).toBe(true);
    });

    it("should reject wrong length", () => {
      expect(isStudentReferenceNumber("000001")).toBe(false); // 6 digits
      expect(isStudentReferenceNumber("00000001")).toBe(false); // 8 digits
    });

    it("should reject non-numeric", () => {
      expect(isStudentReferenceNumber("000000a")).toBe(false);
      expect(isStudentReferenceNumber("abcdefg")).toBe(false);
    });

    it("should reject email-style usernames", () => {
      expect(isStudentReferenceNumber("admin@school.edu")).toBe(false);
      expect(isStudentReferenceNumber("registrar")).toBe(false);
    });
  });
});

// ─── Photo Validation Tests ──────────────────────────────────────────────────

describe("Photo Validation", () => {
  describe("isValidPhotoType", () => {
    it("should accept allowed MIME types", () => {
      expect(isValidPhotoType("image/jpeg")).toBe(true);
      expect(isValidPhotoType("image/png")).toBe(true);
      expect(isValidPhotoType("image/webp")).toBe(true);
    });

    it("should reject disallowed MIME types", () => {
      expect(isValidPhotoType("image/gif")).toBe(false);
      expect(isValidPhotoType("image/svg+xml")).toBe(false);
      expect(isValidPhotoType("application/pdf")).toBe(false);
      expect(isValidPhotoType("text/plain")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isValidPhotoType("")).toBe(false);
    });
  });

  describe("isValidPhotoSize", () => {
    it("should accept sizes within limit", () => {
      expect(isValidPhotoSize(1)).toBe(true);
      expect(isValidPhotoSize(1024)).toBe(true); // 1KB
      expect(isValidPhotoSize(1024 * 1024)).toBe(true); // 1MB
      expect(isValidPhotoSize(MAX_PHOTO_SIZE_BYTES)).toBe(true); // Exactly 2MB
    });

    it("should reject sizes above limit", () => {
      expect(isValidPhotoSize(MAX_PHOTO_SIZE_BYTES + 1)).toBe(false);
      expect(isValidPhotoSize(3 * 1024 * 1024)).toBe(false); // 3MB
    });

    it("should reject zero or negative", () => {
      expect(isValidPhotoSize(0)).toBe(false);
      expect(isValidPhotoSize(-1)).toBe(false);
    });
  });

  describe("getPhotoValidationError", () => {
    it("should return null for valid file", () => {
      const file = new File(["test"], "photo.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 1024 });

      const error = getPhotoValidationError(file);

      expect(error).toBeNull();
    });

    it("should return error for invalid type", () => {
      const file = new File(["test"], "image.gif", { type: "image/gif" });
      Object.defineProperty(file, "size", { value: 1024 });

      const error = getPhotoValidationError(file);

      expect(error).toContain("Invalid file type");
      expect(error).toContain("JPEG");
      expect(error).toContain("PNG");
      expect(error).toContain("WebP");
    });

    it("should return error for file too large", () => {
      const file = new File(["test"], "large.jpg", { type: "image/jpeg" });
      Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });

      const error = getPhotoValidationError(file);

      expect(error).toContain("File too large");
      expect(error).toContain("2MB");
    });

    it("should check type before size", () => {
      // Invalid type AND too large - should report type error first
      const file = new File(["test"], "large.gif", { type: "image/gif" });
      Object.defineProperty(file, "size", { value: 3 * 1024 * 1024 });

      const error = getPhotoValidationError(file);

      expect(error).toContain("Invalid file type");
    });
  });

  describe("Constants", () => {
    it("should have correct allowed types", () => {
      expect(ALLOWED_PHOTO_TYPES).toContain("image/jpeg");
      expect(ALLOWED_PHOTO_TYPES).toContain("image/png");
      expect(ALLOWED_PHOTO_TYPES).toContain("image/webp");
      expect(ALLOWED_PHOTO_TYPES).toHaveLength(3);
    });

    it("should have 2MB max size", () => {
      expect(MAX_PHOTO_SIZE_BYTES).toBe(2 * 1024 * 1024);
    });
  });
});

// ─── Booklet Formatting Tests ────────────────────────────────────────────────

describe("Booklet Formatting", () => {
  describe("formatBookletSeriesCanonical", () => {
    it("should format series with uppercase prefix", () => {
      const series = formatBookletSeriesCanonical("ak", 1, 50);

      expect(series).toBe("AK-00001-00050");
    });

    it("should pad numbers to 5 digits", () => {
      const series = formatBookletSeriesCanonical("BX", 51, 100);

      expect(series).toBe("BX-00051-00100");
    });

    it("should handle large numbers", () => {
      const series = formatBookletSeriesCanonical("ZZ", 99951, 100000);

      expect(series).toBe("ZZ-99951-100000");
    });

    it("should trim prefix whitespace", () => {
      const series = formatBookletSeriesCanonical("  CY  ", 1, 50);

      expect(series).toBe("CY-00001-00050");
    });
  });

  describe("normalizeBookletSeriesInput", () => {
    it("should uppercase and remove extra spaces", () => {
      const normalized = normalizeBookletSeriesInput("ak - 00001 - 00050");

      expect(normalized).toBe("AK-00001-00050");
    });

    it("should normalize whitespace around dashes", () => {
      const normalized = normalizeBookletSeriesInput("BX  -  00051  -  00100");

      expect(normalized).toBe("BX-00051-00100");
    });

    it("should handle no spaces", () => {
      const normalized = normalizeBookletSeriesInput("cy-00001-00050");

      expect(normalized).toBe("CY-00001-00050");
    });

    it("should trim leading/trailing whitespace", () => {
      const normalized = normalizeBookletSeriesInput("  DZ-00001-00050  ");

      expect(normalized).toBe("DZ-00001-00050");
    });
  });

  describe("Series validation integration", () => {
    it("should match canonical format after normalization", () => {
      const userInput = "ak - 00001 - 00050";
      const normalized = normalizeBookletSeriesInput(userInput);
      const canonical = formatBookletSeriesCanonical("AK", 1, 50);

      expect(normalized).toBe(canonical);
    });
  });
});

// ─── Component Props Type Tests ──────────────────────────────────────────────

describe("Component Props Type Patterns", () => {
  describe("Callback Props", () => {
    it("should define numeric keypad callback pattern", () => {
      // Documents the expected callback interface
      const keypadProps = {
        onDigit: (digit: string) => {
          expect(typeof digit).toBe("string");
        },
        onClear: () => {},
        onBackspace: () => {},
      };

      keypadProps.onDigit("5");
      expect(keypadProps.onDigit).toBeDefined();
      expect(keypadProps.onClear).toBeDefined();
      expect(keypadProps.onBackspace).toBeDefined();
    });
  });

  describe("Data Display Props", () => {
    it("should define assessment item shape", () => {
      const assessmentItem = {
        id: "item-123",
        description: "Tuition Fee",
        amount: 10000,
        isDiscount: false,
      };

      expect(assessmentItem.id).toBeDefined();
      expect(typeof assessmentItem.amount).toBe("number");
      expect(typeof assessmentItem.isDiscount).toBe("boolean");
    });

    it("should define payment row shape", () => {
      const paymentRow = {
        id: "pay-123",
        orNumber: "AK 00001",
        amount: 5000,
        paymentMethod: "cash" as const,
        status: "posted" as const,
        postedAt: new Date(),
      };

      expect(paymentRow.orNumber).toMatch(/^[A-Z]{2} \d{5}$/);
      expect(paymentRow.amount).toBeGreaterThan(0);
    });

    it("should define discount request shape", () => {
      const discountRequest = {
        id: "req-123",
        studentName: "John Doe",
        discountTypeName: "Sibling Discount",
        status: "pending" as const,
        defaultValue: "500.00",
        calculationType: "fixed_amount" as const,
      };

      expect(discountRequest.status).toBe("pending");
      expect(["percentage", "fixed_amount"]).toContain(discountRequest.calculationType);
    });
  });
});
