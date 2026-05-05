import { z } from "zod";

/** Matches `EnrollmentIntakeDocuments` field values in `lib/db/schema.ts`. */
export const intakeDocumentStatusSchema = z.enum([
  "received",
  "not_applicable",
  "to_follow",
]);

export type IntakeDocumentStatus = z.infer<typeof intakeDocumentStatusSchema>;

export function parseIntakeDocumentStatus(
  raw: FormDataEntryValue | null
): IntakeDocumentStatus | undefined {
  if (typeof raw !== "string") return undefined;
  const r = intakeDocumentStatusSchema.safeParse(raw);
  return r.success ? r.data : undefined;
}

/** FormData → zod preprocess helper for intake radio groups. */
export function preprocessIntakeRadio(raw: unknown): IntakeDocumentStatus | undefined {
  if (raw === "received" || raw === "not_applicable" || raw === "to_follow") return raw;
  return undefined;
}
