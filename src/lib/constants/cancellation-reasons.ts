/**
 * Enrollment Cancellation Reason Constants
 *
 * Predefined reasons for enrollment cancellation requests.
 * These are system-level configuration values that map to:
 * - PostgreSQL enum `cancellation_reason_type` (defined in schema.ts)
 * - Cancellation request forms (dropdown selection)
 *
 * **Usage:**
 * - All cancellation requests require selecting a reason from this list
 * - When reason_type = 'other', remarks field is REQUIRED (min 10 chars)
 * - For all other reasons, remarks are optional
 *
 * **Adding a New Reason:**
 * 1. Add value to CANCELLATION_REASONS array below
 * 2. Add corresponding label to CANCELLATION_REASON_LABELS
 * 3. Add description to CANCELLATION_REASON_DESCRIPTIONS
 * 4. Generate migration: npm run db:generate
 * 5. Apply migration: npm run db:migrate
 */

export const CANCELLATION_REASONS = [
  "transfer",
  "financial",
  "medical",
  "relocation",
  "personal",
  "administrative",
  "non_compliance",
  "disciplinary",
  "other",
] as const satisfies readonly [string, ...string[]];

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  transfer: "Transfer to another school",
  financial: "Financial difficulties",
  medical: "Medical/Health reasons",
  relocation: "Relocation",
  personal: "Personal/Family reasons",
  administrative: "Administrative correction",
  non_compliance: "Non-compliance",
  disciplinary: "Disciplinary",
  other: "Other",
};

export const CANCELLATION_REASON_DESCRIPTIONS: Record<CancellationReason, string> = {
  transfer: "Student moving to a different institution",
  financial: "Family unable to continue payments",
  medical: "Health issues preventing attendance",
  relocation: "Family moving to a different area",
  personal: "Private matters (catch-all for family reasons)",
  administrative: "Enrollment created in error",
  non_compliance: "Failed to submit required documents",
  disciplinary: "Behavioral issues (admin-initiated)",
  other: "Other reason - requires explanation in remarks",
};

/**
 * Helper to check if remarks are required for a given reason
 */
export function isRemarksRequired(reason: CancellationReason): boolean {
  return reason === "other";
}
