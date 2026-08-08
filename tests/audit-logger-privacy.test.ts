import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { anonymizeIpAddressForAuditLog } from "@/lib/utils/audit-logger";

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
});
