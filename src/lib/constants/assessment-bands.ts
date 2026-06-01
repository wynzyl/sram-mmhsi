/**
 * Assessment Band Constants
 *
 * Defines the groupings for fee schedules across grade levels.
 * These are system-level configuration values that map to:
 * - PostgreSQL enum `fee_assessment_band` (defined in schema.ts)
 * - Grade level categorization (stored in grade_levels.assessment_band)
 *
 * **Database Design:**
 * Assessment bands are stored in the `grade_levels` table (normalized).
 * Access via relationship: assessment → enrollment → gradeLevel.assessmentBand
 *
 * **Adding a New Band:**
 * 1. Add value to FEE_ASSESSMENT_BANDS array below
 * 2. Add corresponding label to FEE_ASSESSMENT_BAND_LABELS
 * 3. Generate migration: npm run db:generate
 * 4. Review the migration SQL in drizzle/ directory
 * 5. Apply migration: npm run db:migrate
 * 6. Update grade level data and fee templates as needed
 */

export const FEE_ASSESSMENT_BANDS = [
  "casa",
  "advance_casa",
  "lower_elementary",
  "higher_elementary",
  "junior_high",
  "senior_high",
] as const satisfies readonly [string, ...string[]];

export type FeeAssessmentBand = (typeof FEE_ASSESSMENT_BANDS)[number];

export const FEE_ASSESSMENT_BAND_LABELS: Record<FeeAssessmentBand, string> = {
  casa: "Casa (Junior / Senior)",
  advance_casa: "Advance Casa",
  lower_elementary: "Lower Elementary (Grades 1–3)",
  higher_elementary: "Higher Elementary (Grades 4–6)",
  junior_high: "Junior High School (Grades 7–10)",
  senior_high: "Senior High School (Grades 11–12)",
};
