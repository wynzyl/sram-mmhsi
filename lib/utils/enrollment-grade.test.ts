import { describe, expect, it } from "vitest";
import { validateGradeProgression } from "./enrollment-grade";

describe("validateGradeProgression", () => {
  const max = 12;

  it("allows any grade when no prior enrollment", () => {
    expect(validateGradeProgression({ priorGradeOrder: null, newGradeOrder: 1, maxCatalogOrder: max })).toEqual({
      ok: true,
    });
  });

  it("rejects repeating the same grade when a higher grade exists in the catalog", () => {
    const r = validateGradeProgression({ priorGradeOrder: 7, newGradeOrder: 7, maxCatalogOrder: max });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/must be higher/i);
  });

  it("allows promoting to the next grade", () => {
    expect(validateGradeProgression({ priorGradeOrder: 7, newGradeOrder: 8, maxCatalogOrder: max })).toEqual({
      ok: true,
    });
  });

  it("rejects selecting a grade below prior", () => {
    const r = validateGradeProgression({ priorGradeOrder: 8, newGradeOrder: 7, maxCatalogOrder: max });
    expect(r.ok).toBe(false);
  });

  it("allows repeating top catalog grade when student was already at max", () => {
    expect(validateGradeProgression({ priorGradeOrder: 12, newGradeOrder: 12, maxCatalogOrder: max })).toEqual({
      ok: true,
    });
  });
});
