import { z } from "zod";
import { intakeDocumentStatusSchema, preprocessIntakeRadio } from "./intake-documents";

export const enrollmentStudentTypeEnumSchema = z.enum([
  "new_student",
  "transferee",
  "old_student",
]);

// ─── New Enrollment Schema ────────────────────────────────────────────────────

function preprocessOptionalTrimmedString(val: unknown): string | undefined {
  if (val == null) return undefined;
  if (typeof val !== "string") return undefined;
  const t = val.trim();
  return t === "" ? undefined : t;
}

export const CreateEnrollmentSchema = z
  .object({
    studentId: z.string().uuid("Student is required."),
    schoolYearId: z.string().uuid("School year is required."),
    gradeLevelId: z.string().uuid("Grade level is required."),
    sectionId: z.string().uuid().optional(),
    registrationId: z.string().uuid().optional(),
    studentType: enrollmentStudentTypeEnumSchema.default("new_student"),
    previousSchool: z.preprocess(
      preprocessOptionalTrimmedString,
      z.string().max(500, "Too long.").optional()
    ),
    intakeForm138: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema.optional()),
    intakeBirthCertificatePsa: z.preprocess(
      preprocessIntakeRadio,
      intakeDocumentStatusSchema.optional()
    ),
    intakeGoodMoralCharacter: z.preprocess(
      preprocessIntakeRadio,
      intakeDocumentStatusSchema.optional()
    ),
    intakeQualifiedVoucher: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema.optional()),
    intakeEscCertificate: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema.optional()),
  })
  .superRefine((data, ctx) => {
    if (data.studentType === "transferee") {
      if (!data.previousSchool) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Previous school is required for transferees.",
          path: ["previousSchool"],
        });
      }
    }

    if (data.studentType !== "new_student" && data.studentType !== "transferee") return;

    const block = (
      value: string | undefined,
      path:
        | "intakeForm138"
        | "intakeBirthCertificatePsa"
        | "intakeGoodMoralCharacter"
        | "intakeQualifiedVoucher"
        | "intakeEscCertificate",
      label: string
    ) => {
      if (value !== "received" && value !== "not_applicable" && value !== "to_follow") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Select a status for ${label}.`,
          path: [path],
        });
      }
    };

    block(data.intakeForm138, "intakeForm138", "FORM 138");
    block(data.intakeBirthCertificatePsa, "intakeBirthCertificatePsa", "Birth Certificate (PSA)");
    block(data.intakeGoodMoralCharacter, "intakeGoodMoralCharacter", "Good Moral Character");
    block(data.intakeQualifiedVoucher, "intakeQualifiedVoucher", "Qualified Voucher Certificate");
    block(data.intakeEscCertificate, "intakeEscCertificate", "ESC Certificate");
  });

export type CreateEnrollmentInput = z.infer<typeof CreateEnrollmentSchema>;

export type EnrollmentFormState = {
  errors?: Partial<Record<keyof CreateEnrollmentInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
  enrollmentId?: string;
};

// ─── Update Enrollment Status Schema ─────────────────────────────────────────

/** Registrar: cancel only. Admin: cancel + bypass payment to Enrolled after Assessed. */
export const UpdateEnrollmentStatusSchema = z.object({
  enrollmentId: z.string().uuid(),
  action: z.enum(["cancel", "override_enroll"]),
  sectionId: z.string().uuid().optional(),
  cancelRemarks: z.string().trim().optional(),
});

export type UpdateEnrollmentStatusInput = z.infer<typeof UpdateEnrollmentStatusSchema>;

export type UpdateEnrollmentFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};
