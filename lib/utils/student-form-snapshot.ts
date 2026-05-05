import type { CreateStudentFormFieldSnapshot, GuardianInput } from "@/lib/validators/student";
import { parseIntakeDocumentStatus } from "@/lib/validators/intake-documents";

/** Echo submitted registration form data when validation fails so the client can restore fields. */
export function buildCreateStudentFormSnapshot(
  formData: FormData,
  guardians: unknown[]
): CreateStudentFormFieldSnapshot {
  const guardiansSafe: GuardianInput[] = Array.isArray(guardians)
    ? (guardians as GuardianInput[])
    : [];

  const snap = (name: string) => parseIntakeDocumentStatus(formData.get(name)) ?? "";

  return {
    firstName: String(formData.get("firstName") ?? ""),
    middleName: String(formData.get("middleName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    suffix: String(formData.get("suffix") ?? ""),
    dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
    gender: String(formData.get("gender") ?? ""),
    address: String(formData.get("address") ?? ""),
    lrn: String(formData.get("lrn") ?? ""),
    mobileNumber: String(formData.get("mobileNumber") ?? ""),
    email: String(formData.get("email") ?? ""),
    nationality: String(formData.get("nationality") ?? ""),
    bloodType: String(formData.get("bloodType") ?? ""),
    religion: String(formData.get("religion") ?? ""),
    previousSchool: String(formData.get("previousSchool") ?? ""),
    submittedDocumentsNotes: String(formData.get("submittedDocumentsNotes") ?? ""),
    gradeLevelId: String(formData.get("gradeLevelId") ?? ""),
    intakeForm138: snap("intakeForm138"),
    intakeBirthCertificatePsa: snap("intakeBirthCertificatePsa"),
    intakeGoodMoralCharacter: snap("intakeGoodMoralCharacter"),
    intakeQualifiedVoucher: snap("intakeQualifiedVoucher"),
    intakeEscCertificate: snap("intakeEscCertificate"),
    guardians: guardiansSafe,
  };
}
