import { describe, expect, it } from "vitest";
import { assertEnrollmentAllowsPayment } from "./enrollment-payment";

describe("assertEnrollmentAllowsPayment", () => {
  it("no-ops when there is no enrollment link", () => {
    expect(() => assertEnrollmentAllowsPayment(undefined, null, null)).not.toThrow();
  });

  it("allows assessed enrollments aligned with assessment", () => {
    expect(() =>
      assertEnrollmentAllowsPayment("assessed", "e1", "e1")
    ).not.toThrow();
  });

  it("allows enrolled enrollments (follow-on payments toward balance)", () => {
    expect(() =>
      assertEnrollmentAllowsPayment("enrolled", "e1", "e1")
    ).not.toThrow();
  });

  it("throws when enrollment is pending or cancelled", () => {
    expect(() =>
      assertEnrollmentAllowsPayment("pending", "e1", "e1")
    ).toThrow(/assessed or enrolled/i);
    expect(() =>
      assertEnrollmentAllowsPayment("cancelled", "e1", "e1")
    ).toThrow(/assessed or enrolled/i);
  });

  it("throws when assessment enrollment id does not match fetched enrollment", () => {
    expect(() =>
      assertEnrollmentAllowsPayment("assessed", "e1", "e2")
    ).toThrow(/not aligned/i);
  });
});
