import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateUuid } from "../uuid";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const originalRandomUUID = crypto.randomUUID;

/** Simulate a non-secure browser context (plain-HTTP LAN prod) where
 *  crypto exists but crypto.randomUUID is undefined. */
function removeRandomUUID() {
  Object.defineProperty(crypto, "randomUUID", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

describe("generateUuid", () => {
  afterEach(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: originalRandomUUID,
      configurable: true,
      writable: true,
    });
  });

  it("returns a UUID v4 via crypto.randomUUID when available", () => {
    expect(generateUuid()).toMatch(UUID_V4_REGEX);
  });

  it("falls back to getRandomValues in non-secure contexts (no crypto.randomUUID)", () => {
    removeRandomUUID();
    expect(generateUuid()).toMatch(UUID_V4_REGEX);
  });

  it("fallback output passes the payment schema's z.string().uuid() check", () => {
    removeRandomUUID();
    const schema = z.string().uuid();
    for (let i = 0; i < 20; i++) {
      expect(schema.safeParse(generateUuid()).success).toBe(true);
    }
  });

  it("generates unique values", () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateUuid()));
    expect(seen.size).toBe(100);
  });
});
