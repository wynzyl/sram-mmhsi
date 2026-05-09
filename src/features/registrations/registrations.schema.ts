import { z } from "zod";
import { CreateStudentSchema } from "../students/students.schema";
import { intakeDocumentStatusSchema, preprocessIntakeRadio } from "@/lib/validators/intake-documents";

export const registrationIntentEnumSchema = z.enum(["new_student", "transferee"]);

export const CreateStudentWithRegistrationSchema = CreateStudentSchema.extend({
  schoolYearId: z.string().uuid("School year is required."),
  gradeLevelId: z.string().uuid("Grade level is required."),
  registrationIntent: registrationIntentEnumSchema,
  registrationStudentType: registrationIntentEnumSchema,
  intakeForm138: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeBirthCertificatePsa: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeGoodMoralCharacter: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeQualifiedVoucher: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeEscCertificate: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
}).superRefine((data, ctx) => {
  if (data.registrationIntent !== data.registrationStudentType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enrollment type does not match the selected registration flow.",
      path: ["registrationStudentType"],
    });
  }

  if (data.registrationStudentType === "transferee") {
    const ps = data.previousSchool?.trim();
    if (!ps) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Previous school is required for transferees.",
        path: ["previousSchool"],
      });
    }
  }
});

export type CreateStudentWithRegistrationInput = z.infer<typeof CreateStudentWithRegistrationSchema>;
