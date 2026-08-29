import { z } from "zod";
import { intakeDocumentStatusSchema, preprocessIntakeRadio, parseIntakeDocumentStatus, type IntakeDocumentStatus } from "@/lib/validators/intake-documents";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// Re-export for convenience
export { parseIntakeDocumentStatus };
export type { IntakeDocumentStatus };

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
    /**
     * Override the student's default SPED status for this enrollment.
     * - undefined/null: Inherit from student.isSpecialEducation
     * - true: Force SPED status for this enrollment
     * - false: Force non-SPED status for this enrollment
     */
    specialEducationOverride: z.boolean().nullable().optional(),
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

export type EnrollmentFormState = BaseFormState<CreateEnrollmentInput> & {
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

export type UpdateEnrollmentFormState = BaseFormState<UpdateEnrollmentStatusInput>;
/**
 * ENROLLMENT CONFIRMATION VALIDATOR
 *
 * Used for the list-first enrollment workflow (Phase 2).
 * This is a simplified schema compared to CreateEnrollmentSchema because
 * most data is already known from the registration or previous enrollment.
 */

// enrollmentStudentTypeEnumSchema is already defined above

// ─── Confirm Enrollment Schema ────────────────────────────────────────────────

/**
 * Schema for confirming enrollment from the Ready to Enroll queue.
 *
 * Simpler than CreateEnrollmentSchema because:
 * - Student is already identified (from queue)
 * - Grade level is already determined (from registration or auto-promotion)
 * - Intake documents already captured in registration (for new/transferee)
 * - School year is always the active school year
 */
export const ConfirmEnrollmentSchema = z.object({
  studentId: z.string().uuid("Student ID is required."),
  schoolYearId: z.string().uuid("School year ID is required."),
  gradeLevelId: z.string().uuid("Grade level ID is required."),
  sectionId: z.string().uuid("Invalid section ID.").optional(),
  studentType: enrollmentStudentTypeEnumSchema,
  registrationId: z.string().uuid("Invalid registration ID.").optional(),
  // For transferees, if previousSchool is not already in student record
  previousSchool: z.string().trim().max(500, "Previous school name is too long.").optional(),
  /** Override the student's default SPED status for this enrollment. */
  specialEducationOverride: z.boolean().nullable().optional(),
});

export type ConfirmEnrollmentInput = z.infer<typeof ConfirmEnrollmentSchema>;

export type ConfirmEnrollmentFormState = BaseFormState<ConfirmEnrollmentInput> & {
  enrollmentId?: string;
};

// ─── Quick Confirm Schema (No Section Assignment) ────────────────────────────

/**
 * Ultra-simplified schema for one-click enrollment confirmation without section assignment.
 * Used when clicking "Enroll" button directly from the table.
 */
export const QuickConfirmEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  schoolYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  studentType: enrollmentStudentTypeEnumSchema,
  registrationId: z.string().uuid().optional(),
  /** Override the student's default SPED status for this enrollment. */
  specialEducationOverride: z.boolean().nullable().optional(),
});

export type QuickConfirmEnrollmentInput = z.infer<typeof QuickConfirmEnrollmentSchema>;

export type QuickConfirmEnrollmentFormState = BaseFormState<QuickConfirmEnrollmentInput> & {
  enrollmentId?: string;
};

// ─── Update Intake Documents Schema ──────────────────────────────────────────

/**
 * Schema for updating intake documents on an existing enrollment.
 * Only applicable for new_student and transferee enrollment types.
 */
export const UpdateIntakeDocumentsSchema = z.object({
  enrollmentId: z.string().uuid("Enrollment ID is required."),
  intakeForm138: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeBirthCertificatePsa: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeGoodMoralCharacter: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeQualifiedVoucher: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
  intakeEscCertificate: z.preprocess(preprocessIntakeRadio, intakeDocumentStatusSchema),
});

export type UpdateIntakeDocumentsInput = z.infer<typeof UpdateIntakeDocumentsSchema>;

export type UpdateIntakeDocumentsFormState = BaseFormState<UpdateIntakeDocumentsInput>;
