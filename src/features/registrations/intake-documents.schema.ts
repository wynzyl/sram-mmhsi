import { z } from "zod";

// Intake document status schema matching the database type
export const intakeDocumentStatusSchema = z.enum(
  ["received", "not_applicable", "to_follow"],
  {
    errorMap: () => ({
      message: "Please select a status (Received, Not applicable, or To follow)",
    }),
  }
);

export type IntakeDocumentStatus = z.infer<typeof intakeDocumentStatusSchema>;

// Preprocessor for radio button values (converts "true"/"false" strings to enum values)
export function preprocessIntakeRadio(value: unknown): unknown {
  if (typeof value === "string") {
    // Handle empty strings (no selection) - return undefined to trigger validation error
    const trimmed = value.trim();
    if (trimmed === "") return undefined;

    // Handle form radio values
    if (trimmed === "received") return "received";
    if (trimmed === "not_applicable") return "not_applicable";
    if (trimmed === "to_follow") return "to_follow";
  }
  return value;
}

// Export function to parse intake document status from unknown input
export function parseIntakeDocumentStatus(
  value: unknown
): IntakeDocumentStatus {
  return intakeDocumentStatusSchema.parse(value);
}
