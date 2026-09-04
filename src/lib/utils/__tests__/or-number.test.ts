import { describe, it, expect } from "vitest";
import {
  OR_SEQUENCE_PAD,
  OR_NUMBER_REGEX,
  orNumberPadWidth,
  formatStoredOrNumber,
  parseOrNumber,
} from "../or-number";

/**
 * OR Number Utilities Tests (H1 - High Finding)
 *
 * Tests for Official Receipt number formatting and parsing utilities.
 * OR format: "{prefix} {paddedSequence}" (e.g. "AK 00050")
 * - Prefix: exactly 2 uppercase letters
 * - Sequence: exactly 5 digits (00001-99999)
 *
 * These utilities are critical for:
 * - Receipt tracking integrity
 * - Booklet management
 * - Payment posting
 */

// ─────────────────────────────────────────────────────────────────
// Constants Tests
// ─────────────────────────────────────────────────────────────────

describe("OR Number Constants", () => {
  describe("OR_SEQUENCE_PAD", () => {
    it("should be 5 digits", () => {
      expect(OR_SEQUENCE_PAD).toBe(5);
    });

    it("should match the expected OR number format width", () => {
      // OR numbers are 5 digits: 00001 to 99999
      expect(OR_SEQUENCE_PAD).toBeGreaterThanOrEqual(5);
    });
  });

  describe("OR_NUMBER_REGEX", () => {
    it("should match valid OR number format", () => {
      expect(OR_NUMBER_REGEX.test("AK 00050")).toBe(true);
      expect(OR_NUMBER_REGEX.test("ZZ 99999")).toBe(true);
      expect(OR_NUMBER_REGEX.test("AB 00001")).toBe(true);
    });

    it("should match lowercase prefix", () => {
      expect(OR_NUMBER_REGEX.test("ak 00050")).toBe(true);
      expect(OR_NUMBER_REGEX.test("Ab 12345")).toBe(true);
    });

    it("should reject invalid formats", () => {
      // Missing space
      expect(OR_NUMBER_REGEX.test("AK00050")).toBe(false);
      // Wrong number of digits
      expect(OR_NUMBER_REGEX.test("AK 0050")).toBe(false);
      expect(OR_NUMBER_REGEX.test("AK 000050")).toBe(false);
      // Wrong prefix length
      expect(OR_NUMBER_REGEX.test("A 00050")).toBe(false);
      expect(OR_NUMBER_REGEX.test("ABC 00050")).toBe(false);
      // Numbers in prefix
      expect(OR_NUMBER_REGEX.test("A1 00050")).toBe(false);
      // Letters in sequence
      expect(OR_NUMBER_REGEX.test("AK 0005A")).toBe(false);
      // Empty string
      expect(OR_NUMBER_REGEX.test("")).toBe(false);
      // Multiple spaces
      expect(OR_NUMBER_REGEX.test("AK  00050")).toBe(false);
    });

    it("should reject leading/trailing whitespace", () => {
      expect(OR_NUMBER_REGEX.test(" AK 00050")).toBe(false);
      expect(OR_NUMBER_REGEX.test("AK 00050 ")).toBe(false);
      expect(OR_NUMBER_REGEX.test(" AK 00050 ")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// orNumberPadWidth Tests
// ─────────────────────────────────────────────────────────────────

describe("orNumberPadWidth", () => {
  it("should return the sequence padding width", () => {
    expect(orNumberPadWidth()).toBe(5);
  });

  it("should match OR_SEQUENCE_PAD constant", () => {
    expect(orNumberPadWidth()).toBe(OR_SEQUENCE_PAD);
  });
});

// ─────────────────────────────────────────────────────────────────
// formatStoredOrNumber Tests
// ─────────────────────────────────────────────────────────────────

describe("formatStoredOrNumber", () => {
  describe("Basic Formatting", () => {
    it("should format OR number with proper padding", () => {
      expect(formatStoredOrNumber("AK", 50)).toBe("AK 00050");
    });

    it("should format single digit sequences", () => {
      expect(formatStoredOrNumber("AK", 1)).toBe("AK 00001");
      expect(formatStoredOrNumber("AK", 9)).toBe("AK 00009");
    });

    it("should format double digit sequences", () => {
      expect(formatStoredOrNumber("AK", 10)).toBe("AK 00010");
      expect(formatStoredOrNumber("AK", 99)).toBe("AK 00099");
    });

    it("should format triple digit sequences", () => {
      expect(formatStoredOrNumber("AK", 100)).toBe("AK 00100");
      expect(formatStoredOrNumber("AK", 999)).toBe("AK 00999");
    });

    it("should format four digit sequences", () => {
      expect(formatStoredOrNumber("AK", 1000)).toBe("AK 01000");
      expect(formatStoredOrNumber("AK", 9999)).toBe("AK 09999");
    });

    it("should format five digit sequences without extra padding", () => {
      expect(formatStoredOrNumber("AK", 10000)).toBe("AK 10000");
      expect(formatStoredOrNumber("AK", 99999)).toBe("AK 99999");
    });
  });

  describe("Prefix Handling", () => {
    it("should preserve prefix case", () => {
      expect(formatStoredOrNumber("AK", 50)).toBe("AK 00050");
      expect(formatStoredOrNumber("ak", 50)).toBe("ak 00050");
      expect(formatStoredOrNumber("Ak", 50)).toBe("Ak 00050");
    });

    it("should handle different prefixes", () => {
      expect(formatStoredOrNumber("AB", 1)).toBe("AB 00001");
      expect(formatStoredOrNumber("ZZ", 99999)).toBe("ZZ 99999");
      expect(formatStoredOrNumber("XY", 12345)).toBe("XY 12345");
    });

    it("should trim whitespace from prefix", () => {
      expect(formatStoredOrNumber(" AK", 50)).toBe("AK 00050");
      expect(formatStoredOrNumber("AK ", 50)).toBe("AK 00050");
      expect(formatStoredOrNumber(" AK ", 50)).toBe("AK 00050");
    });
  });

  describe("Sequence Edge Cases", () => {
    it("should handle zero sequence", () => {
      expect(formatStoredOrNumber("AK", 0)).toBe("AK 00000");
    });

    it("should floor decimal sequences", () => {
      expect(formatStoredOrNumber("AK", 50.9)).toBe("AK 00050");
      expect(formatStoredOrNumber("AK", 50.1)).toBe("AK 00050");
      expect(formatStoredOrNumber("AK", 50.5)).toBe("AK 00050");
    });

    it("should handle maximum valid sequence", () => {
      expect(formatStoredOrNumber("AK", 99999)).toBe("AK 99999");
    });

    it("should handle sequences exceeding 5 digits (no truncation)", () => {
      // Note: This is technically invalid but the function doesn't validate
      expect(formatStoredOrNumber("AK", 100000)).toBe("AK 100000");
    });
  });

  describe("Negative Sequences", () => {
    it("should handle negative sequences (implementation detail)", () => {
      // Math.floor of negative numbers rounds down
      // The function doesn't validate, so this tests current behavior
      const result = formatStoredOrNumber("AK", -1);
      expect(result).toBe("AK 000-1");
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// parseOrNumber Tests
// ─────────────────────────────────────────────────────────────────

describe("parseOrNumber", () => {
  describe("Valid OR Numbers", () => {
    it("should parse standard OR number", () => {
      const result = parseOrNumber("AK 00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should parse OR number with minimum sequence", () => {
      const result = parseOrNumber("AB 00001");
      expect(result).toEqual({ prefix: "AB", sequence: 1 });
    });

    it("should parse OR number with maximum sequence", () => {
      const result = parseOrNumber("ZZ 99999");
      expect(result).toEqual({ prefix: "ZZ", sequence: 99999 });
    });

    it("should parse OR number with zero sequence", () => {
      const result = parseOrNumber("AK 00000");
      expect(result).toEqual({ prefix: "AK", sequence: 0 });
    });

    it("should parse various valid sequences", () => {
      expect(parseOrNumber("AK 00001")).toEqual({ prefix: "AK", sequence: 1 });
      expect(parseOrNumber("AK 00010")).toEqual({ prefix: "AK", sequence: 10 });
      expect(parseOrNumber("AK 00100")).toEqual({ prefix: "AK", sequence: 100 });
      expect(parseOrNumber("AK 01000")).toEqual({ prefix: "AK", sequence: 1000 });
      expect(parseOrNumber("AK 10000")).toEqual({ prefix: "AK", sequence: 10000 });
    });
  });

  describe("Case Handling", () => {
    it("should normalize lowercase prefix to uppercase", () => {
      const result = parseOrNumber("ak 00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should normalize mixed case prefix to uppercase", () => {
      const result = parseOrNumber("Ak 00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });
  });

  describe("Whitespace Handling", () => {
    it("should trim leading whitespace", () => {
      const result = parseOrNumber("  AK 00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should trim trailing whitespace", () => {
      const result = parseOrNumber("AK 00050  ");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should trim both leading and trailing whitespace", () => {
      const result = parseOrNumber("  AK 00050  ");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });
  });

  describe("Invalid OR Numbers", () => {
    it("should return null for missing space", () => {
      expect(parseOrNumber("AK00050")).toBeNull();
    });

    it("should return null for wrong digit count", () => {
      expect(parseOrNumber("AK 0050")).toBeNull();   // 4 digits
      expect(parseOrNumber("AK 000050")).toBeNull(); // 6 digits
    });

    it("should return null for wrong prefix length", () => {
      expect(parseOrNumber("A 00050")).toBeNull();   // 1 letter
      expect(parseOrNumber("ABC 00050")).toBeNull(); // 3 letters
    });

    it("should return null for numbers in prefix", () => {
      expect(parseOrNumber("A1 00050")).toBeNull();
      expect(parseOrNumber("1K 00050")).toBeNull();
      expect(parseOrNumber("12 00050")).toBeNull();
    });

    it("should return null for letters in sequence", () => {
      expect(parseOrNumber("AK 0005A")).toBeNull();
      expect(parseOrNumber("AK ABCDE")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseOrNumber("")).toBeNull();
    });

    it("should return null for whitespace only", () => {
      expect(parseOrNumber("   ")).toBeNull();
    });

    it("should return null for multiple spaces between prefix and sequence", () => {
      expect(parseOrNumber("AK  00050")).toBeNull();
      expect(parseOrNumber("AK   00050")).toBeNull();
    });

    it("should return null for special characters in prefix", () => {
      expect(parseOrNumber("A@ 00050")).toBeNull();
      expect(parseOrNumber("A- 00050")).toBeNull();
      expect(parseOrNumber("A_ 00050")).toBeNull();
    });

    it("should return null for special characters in sequence", () => {
      expect(parseOrNumber("AK 0005-")).toBeNull();
      expect(parseOrNumber("AK 00.50")).toBeNull();
    });
  });

  describe("Edge Cases", () => {
    it("should accept tab as whitespace separator (regex uses \\s)", () => {
      // The implementation uses \s which matches any whitespace
      const result = parseOrNumber("AK\t00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should accept newline as whitespace separator (regex uses \\s)", () => {
      // The implementation uses \s which matches any whitespace
      const result = parseOrNumber("AK\n00050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });

    it("should accept non-breaking space as whitespace separator (regex uses \\s)", () => {
      // Non-breaking space (U+00A0) - matches \s
      const result = parseOrNumber("AK\u00A000050");
      expect(result).toEqual({ prefix: "AK", sequence: 50 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// Round-trip Tests (format then parse)
// ─────────────────────────────────────────────────────────────────

describe("Round-trip: format and parse", () => {
  it("should parse what it formats for standard values", () => {
    const formatted = formatStoredOrNumber("AK", 50);
    const parsed = parseOrNumber(formatted);
    expect(parsed).toEqual({ prefix: "AK", sequence: 50 });
  });

  it("should round-trip minimum sequence", () => {
    const formatted = formatStoredOrNumber("AB", 1);
    const parsed = parseOrNumber(formatted);
    expect(parsed).toEqual({ prefix: "AB", sequence: 1 });
  });

  it("should round-trip maximum sequence", () => {
    const formatted = formatStoredOrNumber("ZZ", 99999);
    const parsed = parseOrNumber(formatted);
    expect(parsed).toEqual({ prefix: "ZZ", sequence: 99999 });
  });

  it("should round-trip zero sequence", () => {
    const formatted = formatStoredOrNumber("AK", 0);
    const parsed = parseOrNumber(formatted);
    expect(parsed).toEqual({ prefix: "AK", sequence: 0 });
  });

  it("should round-trip various prefixes", () => {
    const prefixes = ["AA", "AK", "BB", "XY", "ZZ"];
    const sequence = 12345;

    for (const prefix of prefixes) {
      const formatted = formatStoredOrNumber(prefix, sequence);
      const parsed = parseOrNumber(formatted);
      expect(parsed).toEqual({ prefix, sequence });
    }
  });

  it("should round-trip various sequences", () => {
    const sequences = [1, 10, 100, 1000, 10000, 50000, 99999];
    const prefix = "AK";

    for (const sequence of sequences) {
      const formatted = formatStoredOrNumber(prefix, sequence);
      const parsed = parseOrNumber(formatted);
      expect(parsed).toEqual({ prefix, sequence });
    }
  });

  it("should handle case normalization in round-trip", () => {
    // Format with lowercase, parse should return uppercase
    const formatted = formatStoredOrNumber("ak", 50);
    const parsed = parseOrNumber(formatted);
    // Note: formatStoredOrNumber preserves case, but parseOrNumber normalizes to uppercase
    expect(parsed).toEqual({ prefix: "AK", sequence: 50 });
  });
});

// ─────────────────────────────────────────────────────────────────
// Booklet Range Tests (practical use cases)
// ─────────────────────────────────────────────────────────────────

describe("Booklet Range Scenarios", () => {
  it("should correctly format and parse booklet start number", () => {
    // Booklet AK-00051-00100
    const startOrNumber = formatStoredOrNumber("AK", 51);
    expect(startOrNumber).toBe("AK 00051");
    expect(parseOrNumber(startOrNumber)).toEqual({ prefix: "AK", sequence: 51 });
  });

  it("should correctly format and parse booklet end number", () => {
    // Booklet AK-00051-00100
    const endOrNumber = formatStoredOrNumber("AK", 100);
    expect(endOrNumber).toBe("AK 00100");
    expect(parseOrNumber(endOrNumber)).toEqual({ prefix: "AK", sequence: 100 });
  });

  it("should handle standard 50-receipt booklet range", () => {
    const prefix = "AK";
    const startNumber = 51;
    const endNumber = 100;

    // Format all OR numbers in range
    const orNumbers = [];
    for (let i = startNumber; i <= endNumber; i++) {
      orNumbers.push(formatStoredOrNumber(prefix, i));
    }

    // Should have exactly 50 OR numbers
    expect(orNumbers).toHaveLength(50);

    // First and last should be correct
    expect(orNumbers[0]).toBe("AK 00051");
    expect(orNumbers[49]).toBe("AK 00100");

    // All should parse correctly
    for (let i = 0; i < orNumbers.length; i++) {
      const parsed = parseOrNumber(orNumbers[i]);
      expect(parsed).toEqual({ prefix: "AK", sequence: startNumber + i });
    }
  });

  it("should handle multiple booklet series", () => {
    const booklets = [
      { prefix: "AA", start: 1, end: 50 },
      { prefix: "AB", start: 51, end: 100 },
      { prefix: "AC", start: 101, end: 150 },
    ];

    for (const booklet of booklets) {
      const firstOr = formatStoredOrNumber(booklet.prefix, booklet.start);
      const lastOr = formatStoredOrNumber(booklet.prefix, booklet.end);

      const parsedFirst = parseOrNumber(firstOr);
      const parsedLast = parseOrNumber(lastOr);

      expect(parsedFirst?.prefix).toBe(booklet.prefix);
      expect(parsedFirst?.sequence).toBe(booklet.start);
      expect(parsedLast?.prefix).toBe(booklet.prefix);
      expect(parsedLast?.sequence).toBe(booklet.end);
    }
  });
});
