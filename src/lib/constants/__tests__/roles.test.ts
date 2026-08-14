import { describe, expect, it } from "vitest";
import { normalizeRole, ROLES } from "../roles";

describe("normalizeRole", () => {
  it("returns canonical roles unchanged", () => {
    expect(normalizeRole(ROLES.FINANCE_OFFICER)).toBe(ROLES.FINANCE_OFFICER);
    expect(normalizeRole(ROLES.PARENT_GUARDIAN)).toBe(ROLES.PARENT_GUARDIAN);
  });

  it("normalizes known camelCase aliases", () => {
    expect(normalizeRole("financeOfficer")).toBe(ROLES.FINANCE_OFFICER);
    expect(normalizeRole("parentGuardian")).toBe(ROLES.PARENT_GUARDIAN);
    expect(normalizeRole("superAdmin")).toBe(ROLES.SUPER_ADMIN);
  });

  it("returns null for unknown roles", () => {
    expect(normalizeRole("unknownRole")).toBeNull();
  });
});
