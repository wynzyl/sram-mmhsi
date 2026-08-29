import { z } from "zod";
import type { IntakeDocumentStatus } from "@/lib/validators/intake-documents";
import type { CreateStudentWithRegistrationInput } from "@/features/registrations/registrations.schema";
import {
  nameSchema,
  emailSchema,
  emailRequiredSchema,
  phoneSchema,
  lrnSchema,
  bloodTypeSchema,
  genderOptionalSchema,
  type BaseFormState,
} from "@/lib/validators/common-schemas";

// ─── Guardian Schema ───────────────────────────────────────────────────────────

export const GuardianSchema = z.object({
  firstName: nameSchema,
  middleName: z.string().trim().optional(),
  lastName: nameSchema,
  relationship: z.string().min(1, "Relationship is required.").trim(),
  address: z.string().min(1, "Address is required.").trim(),
  occupation: z.string().trim().optional(),
  contactNumber: z.string().min(1, "Contact number is required.").trim(),
  email: emailRequiredSchema,
  isPrimary: z.boolean().default(false),
});

export type GuardianInput = z.infer<typeof GuardianSchema>;

// Date of birth validator (required)
const dateOfBirthRequired = z
  .string()
  .trim()
  .min(1, "Date of birth is required.")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date of birth." });

// ─── Student Creation Schema ───────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  firstName: nameSchema,
  middleName: z.string().trim().optional(),
  lastName: nameSchema.toUpperCase(),
  suffix: z.string().trim().optional(),
  dateOfBirth: dateOfBirthRequired,
  gender: genderOptionalSchema,
  address: z.string().trim().optional(),

  // NEW FIELDS - Contact & Additional Information
  lrn: lrnSchema,
  mobileNumber: phoneSchema,
  email: emailSchema,
  nationality: z.string().trim().max(100, "Nationality too long.").optional(),
  bloodType: bloodTypeSchema,
  religion: z.string().trim().max(100, "Religion too long.").optional(),
  previousSchool: z.string().trim().max(500, "Too long.").optional(),
  submittedDocumentsNotes: z.string().trim().max(2000, "Too long.").optional(),

  // Special Education
  isSpecialEducation: z.boolean().default(false),

  // Guardians
  guardians: z.array(GuardianSchema).min(1, "At least one guardian is required."),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

/** Submitted field snapshot returned on validation/business-rule errors so the registration form can restore input. */
export type CreateStudentFormFieldSnapshot = {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  lrn: string;
  mobileNumber: string;
  email: string;
  nationality: string;
  bloodType: string;
  religion: string;
  previousSchool: string;
  submittedDocumentsNotes: string;
  isSpecialEducation: boolean;
  gradeLevelId: string;
  intakeForm138: IntakeDocumentStatus | "";
  intakeBirthCertificatePsa: IntakeDocumentStatus | "";
  intakeGoodMoralCharacter: IntakeDocumentStatus | "";
  intakeQualifiedVoucher: IntakeDocumentStatus | "";
  intakeEscCertificate: IntakeDocumentStatus | "";
  guardians: GuardianInput[];
};

export type CreateStudentFormState = BaseFormState<CreateStudentWithRegistrationInput> & {
  /** Present when submission failed — rehydrate controlled fields from this object. */
  fieldValues?: CreateStudentFormFieldSnapshot;
  studentId?: string;
};


// ─── Update Student Schema ───────────────────────────────────────────────────

export const UpdateStudentSchema = z.object({
  studentId: z.string().uuid(),
  firstName: nameSchema,
  middleName: z.string().trim().optional(),
  lastName: nameSchema.toUpperCase(),
  suffix: z.string().trim().optional(),
  dateOfBirth: dateOfBirthRequired,
  gender: genderOptionalSchema,
  address: z.string().trim().optional(),

  // NEW FIELDS - Contact & Additional Information
  lrn: lrnSchema,
  mobileNumber: phoneSchema,
  email: emailSchema,
  nationality: z.string().trim().max(100, "Nationality too long.").optional(),
  bloodType: bloodTypeSchema,
  religion: z.string().trim().max(100, "Religion too long.").optional(),
  previousSchool: z.string().trim().max(500, "Too long.").optional(),
  submittedDocumentsNotes: z.string().trim().max(2000, "Too long.").optional(),

  isActive: z.boolean().optional(),
  // Special Education
  isSpecialEducation: z.boolean().optional(),
  // Guardians
  guardians: z.array(GuardianSchema).min(1, "At least one guardian is required."),
});

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

export type UpdateStudentFormState = BaseFormState<UpdateStudentInput>;
