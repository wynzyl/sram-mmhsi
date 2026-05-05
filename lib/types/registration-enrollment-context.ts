import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";

/** Approved registration snapshot passed into the new-enrollment client form. */
export type RegistrationEnrollmentContext = {
  registrationId: string;
  studentId: string;
  schoolYearId: string;
  gradeLevelId: string;
  studentType: "new_student" | "transferee" | "old_student";
  intakeDocuments: EnrollmentIntakeDocuments | null;
};
