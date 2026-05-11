/** Values must stay in sync with `fee_assessment_band` enum in the database. */
export const FEE_ASSESSMENT_BANDS = [
  "casa",
  "lower_elementary",
  "higher_elementary",
  "junior_high",
  "senior_high",
] as const satisfies readonly [string, ...string[]];

export type FeeAssessmentBand = (typeof FEE_ASSESSMENT_BANDS)[number];

export const FEE_ASSESSMENT_BAND_LABELS: Record<FeeAssessmentBand, string> = {
  casa: "Casa (Junior / Senior / Advance)",
  lower_elementary: "Lower Elementary (Grades 1–3)",
  higher_elementary: "Higher Elementary (Grades 4–6)",
  junior_high: "Junior High School (Grades 7–10)",
  senior_high: "Senior High School (Grades 11–12)",
};
