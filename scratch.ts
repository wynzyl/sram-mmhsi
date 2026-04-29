import { z } from "zod";

const CreateEnrollmentSchema = z.object({
  studentId: z.string().uuid("Student is required."),
  schoolYearId: z.string().uuid("School year is required."),
  gradeLevelId: z.string().uuid("Grade level is required."),
  sectionId: z.string().uuid().optional(),
  registrationId: z.string().uuid().optional(),
});

console.log(CreateEnrollmentSchema.safeParse({
  studentId: "999f3178-81bf-4ce7-870e-e796d057eee5",
  schoolYearId: "80873fe6-9c97-45d1-a9f6-f14b6a957f30",
  gradeLevelId: "0b0f1e56-cfdf-4843-a63e-0e5183538ce0",
  sectionId: "" || undefined,
  registrationId: "8fdfb1e6-4d5b-498f-a696-57c19f9a2187" || undefined,
}));
