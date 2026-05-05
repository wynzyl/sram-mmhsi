import { z } from "zod";
import { CreateStudentSchema } from "./student";
import { intakeDocumentStatusSchema, preprocessIntakeRadio } from "./intake-documents";

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

  // const blockToFollow = (
  //   value: (typeof data)["intakeForm138"],
  //   path: keyof Pick<
  //     typeof data,
  //     | "intakeForm138"
  //     | "intakeBirthCertificatePsa"
  //     | "intakeGoodMoralCharacter"
  //     | "intakeQualifiedVoucher"
  //     | "intakeEscCertificate"
  //   >,
  //   label: string
  // ) => {
  //   if (value === "to_follow") {
  //     ctx.addIssue({
  //       code: z.ZodIssueCode.custom,
  //       message: `${label}: choose Received or Not applicable before submitting (To follow is for tracking only).`,
  //       path: [path],
  //     });
  //   }
  // };

  // blockToFollow(data.intakeForm138, "intakeForm138", "FORM 138");
  // blockToFollow(data.intakeBirthCertificatePsa, "intakeBirthCertificatePsa", "Birth Certificate (PSA)");
  // blockToFollow(data.intakeGoodMoralCharacter, "intakeGoodMoralCharacter", "Good Moral Character");
  // blockToFollow(data.intakeQualifiedVoucher, "intakeQualifiedVoucher", "Qualified Voucher Certificate");
  // blockToFollow(data.intakeEscCertificate, "intakeEscCertificate", "ESC Certificate");
});

export type CreateStudentWithRegistrationInput = z.infer<typeof CreateStudentWithRegistrationSchema>;
