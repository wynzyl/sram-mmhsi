import { describe, it, expect } from "vitest";
import { timingSafeCompare } from "./cron-auth";

describe("timingSafeCompare", () => {
  it("accepts identical secrets", () => {
    expect(timingSafeCompare("s3cr3t-value", "s3cr3t-value")).toBe(true);
  });

  it("rejects different secrets of equal length", () => {
    expect(timingSafeCompare("aaaaaaaa", "aaaaaaab")).toBe(false);
  });

  it("rejects secrets of differing length without throwing", () => {
    // timingSafeEqual throws on length mismatch, so the guard must handle it.
    expect(() => timingSafeCompare("short", "considerably-longer")).not.toThrow();
    expect(timingSafeCompare("short", "considerably-longer")).toBe(false);
  });

  it("rejects an empty provided secret", () => {
    expect(timingSafeCompare("", "configured-secret")).toBe(false);
  });

  it("rejects a prefix of the real secret", () => {
    expect(timingSafeCompare("s3cr3t", "s3cr3t-value")).toBe(false);
  });

  it("compares by bytes, not code units", () => {
    expect(timingSafeCompare("café", "café")).toBe(true);
    expect(timingSafeCompare("café", "cafe")).toBe(false);
  });
});
