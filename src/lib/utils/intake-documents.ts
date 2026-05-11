import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import type { IntakeDocumentStatus } from "@/lib/validators/intake-documents";

/** Form radio defaults for `IntakeRequirementsFieldset`. */
export type IntakePreserved = {
  intakeForm138: IntakeDocumentStatus | "";
  intakeBirthCertificatePsa: IntakeDocumentStatus | "";
  intakeGoodMoralCharacter: IntakeDocumentStatus | "";
  intakeQualifiedVoucher: IntakeDocumentStatus | "";
  intakeEscCertificate: IntakeDocumentStatus | "";
};

/** Normalize legacy JSON (booleans / mixed) for display logic. */
function intakeFieldResolved(
  raw: EnrollmentIntakeDocuments[keyof EnrollmentIntakeDocuments] | unknown
): "received" | "not_applicable" | "to_follow" | undefined {
  if (raw === true) return "received";
  if (raw === false) return "to_follow";
  if (raw === "received" || raw === "not_applicable" || raw === "to_follow") return raw;
  return undefined;
}

/** Map stored enrollment/registration intake JSON to form field defaults (legacy booleans supported). */
export function enrollmentIntakeDocumentsToPreserved(
  doc: EnrollmentIntakeDocuments
): IntakePreserved {
  const pick = (
    raw: EnrollmentIntakeDocuments[keyof EnrollmentIntakeDocuments]
  ): IntakeDocumentStatus | "" => intakeFieldResolved(raw) ?? "";

  return {
    intakeForm138: pick(doc.form138),
    intakeBirthCertificatePsa: pick(doc.birthCertificatePsa),
    intakeGoodMoralCharacter: pick(doc.goodMoralCharacter),
    intakeQualifiedVoucher: pick(doc.qualifiedVoucher),
    intakeEscCertificate: pick(doc.escCertificate),
  };
}

type IntakeBadgeVariant = "success" | "secondary" | "warning";

/** Human label + badge variant for a single intake field (supports legacy booleans). */
export function intakeFieldStatusDisplay(
  raw: EnrollmentIntakeDocuments[keyof EnrollmentIntakeDocuments] | unknown
): { label: string; variant: IntakeBadgeVariant } {
  const v = intakeFieldResolved(raw);
  if (v === "received") return { label: "Received", variant: "success" };
  if (v === "not_applicable") return { label: "Not applicable", variant: "secondary" };
  if (v === "to_follow") return { label: "To follow", variant: "warning" };
  return { label: "—", variant: "secondary" };
}

/** True when every item is Received or Not applicable (nothing left To follow). */
export function isIntakeDocumentsComplete(d: EnrollmentIntakeDocuments | null | undefined): boolean {
  if (!d) return false;
  const keys: (keyof EnrollmentIntakeDocuments)[] = [
    "form138",
    "birthCertificatePsa",
    "goodMoralCharacter",
    "qualifiedVoucher",
    "escCertificate",
  ];
  return keys.every((k) => {
    const v = intakeFieldResolved(d[k]);
    return v === "received" || v === "not_applicable" ;
  });
}

export function registrationStudentTypeLabel(
  t: "new_student" | "transferee" | "old_student" | string
): string {
  if (t === "new_student") return "New";
  if (t === "transferee") return "Transferee";
  if (t === "old_student") return "Returning";
  return t;
}
