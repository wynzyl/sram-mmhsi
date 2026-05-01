import { describe, expect, it } from "vitest";
import {
  computeAssessmentTotals,
  CreateAssessmentFromEnrollmentSchema,
} from "./assessment";

describe("computeAssessmentTotals", () => {
  it("subtracts discount lines", () => {
    const total = computeAssessmentTotals([
      { amount: 1000, isDiscount: false },
      { amount: 100, isDiscount: true },
    ]);
    expect(total).toBe(900);
  });
});

describe("CreateAssessmentFromEnrollmentSchema", () => {
  it("accepts schedule-item ids with amounts", () => {
    const r = CreateAssessmentFromEnrollmentSchema.safeParse({
      enrollmentId: "00000000-0000-4000-8000-000000000001",
      items: [
        {
          feeScheduleItemId: "00000000-0000-4000-8000-000000000002",
          amount: 5000,
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});
