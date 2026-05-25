import { describe, it, expect } from "vitest";
import { formatPhoneNumber, formatPhoneInput, stripPhoneFormat } from "./phone";

describe("formatPhoneNumber", () => {
  it("formats a valid 11-digit phone number", () => {
    expect(formatPhoneNumber("09170100098")).toBe("0917-010-0098");
  });

  it("formats phone with +63 prefix", () => {
    expect(formatPhoneNumber("+639170100098")).toBe("0917-010-0098");
  });

  it("handles already formatted phone", () => {
    expect(formatPhoneNumber("0917-010-0098")).toBe("0917-010-0098");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatPhoneNumber(null)).toBe("");
    expect(formatPhoneNumber(undefined)).toBe("");
    expect(formatPhoneNumber("")).toBe("");
  });

  it("returns original value for invalid phone", () => {
    expect(formatPhoneNumber("12345")).toBe("12345");
    expect(formatPhoneNumber("08171234567")).toBe("08171234567");
    expect(formatPhoneNumber("091712345678")).toBe("091712345678");
  });
});

describe("formatPhoneInput", () => {
  it("returns digits only for 4 or fewer characters", () => {
    expect(formatPhoneInput("0")).toBe("0");
    expect(formatPhoneInput("09")).toBe("09");
    expect(formatPhoneInput("091")).toBe("091");
    expect(formatPhoneInput("0917")).toBe("0917");
  });

  it("adds first hyphen after 4 digits", () => {
    expect(formatPhoneInput("09170")).toBe("0917-0");
    expect(formatPhoneInput("091701")).toBe("0917-01");
    expect(formatPhoneInput("0917010")).toBe("0917-010");
  });

  it("adds second hyphen after 7 digits", () => {
    expect(formatPhoneInput("09170100")).toBe("0917-010-0");
    expect(formatPhoneInput("091701000")).toBe("0917-010-00");
    expect(formatPhoneInput("0917010009")).toBe("0917-010-009");
    expect(formatPhoneInput("09170100098")).toBe("0917-010-0098");
  });

  it("limits to 11 digits", () => {
    expect(formatPhoneInput("091701000981234")).toBe("0917-010-0098");
  });

  it("strips non-digit characters from input", () => {
    expect(formatPhoneInput("0917-010-0098")).toBe("0917-010-0098");
    expect(formatPhoneInput("(0917) 010-0098")).toBe("0917-010-0098");
  });
});

describe("stripPhoneFormat", () => {
  it("removes all non-digit characters", () => {
    expect(stripPhoneFormat("0917-010-0098")).toBe("09170100098");
    expect(stripPhoneFormat("+639170100098")).toBe("639170100098");
    expect(stripPhoneFormat("(0917) 010-0098")).toBe("09170100098");
  });

  it("returns empty string for empty input", () => {
    expect(stripPhoneFormat("")).toBe("");
  });

  it("returns digits only from already clean number", () => {
    expect(stripPhoneFormat("09170100098")).toBe("09170100098");
  });
});
