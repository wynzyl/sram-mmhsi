import { z } from "zod";

// Intake document status schema matching the database type
export const intakeDocumentStatusSchema = z.enum([
  "received",
  "not_applicable",
  "to_follow",
]);

export type IntakeDocumentStatus = z.infer<typeof intakeDocumentStatusSchema>;

// Preprocessor for radio button values (converts "true"/"false" strings to enum values)
export function preprocessIntakeRadio(value: unknown): unknown {
  if (typeof value === "string") {
    // Handle form radio values
    if (value === "received") return "received";
    if (value === "not_applicable") return "not_applicable";
    if (value === "to_follow") return "to_follow";
  }
  return value;
}

// Export function to parse intake document status from unknown input
export function parseIntakeDocumentStatus(
  value: unknown
): IntakeDocumentStatus {
  return intakeDocumentStatusSchema.parse(value);
}
