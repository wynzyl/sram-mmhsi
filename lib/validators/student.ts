import { z } from "zod";

// ─── Guardian Schema ───────────────────────────────────────────────────────────

export const GuardianSchema = z.object({
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim(),
  relationship: z.string().min(1, "Relationship is required.").trim(),
  contactNumber: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email address.").optional().or(z.literal("")),
  isPrimary: z.boolean().default(false),
});

export type GuardianInput = z.infer<typeof GuardianSchema>;

// ─── Student Creation Schema ───────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim(),
  suffix: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  address: z.string().trim().optional(),
  // Registration fields
  schoolYearId: z.string().uuid("School year is required."),
  gradeLevelId: z.string().uuid("Grade level is required."),
  // Guardians
  guardians: z.array(GuardianSchema).min(1, "At least one guardian is required."),
});

export type CreateStudentInput = z.infer<typeof CreateStudentSchema>;

export type CreateStudentFormState = {
  errors?: Partial<Record<keyof CreateStudentInput | "guardians" | "_form", string[]>>;
  message?: string;
  success?: boolean;
  studentId?: string;
};

// ─── Review Registration Schema ───────────────────────────────────────────────

export const ReviewRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  remarks: z.string().trim().optional(),
});

export type ReviewRegistrationInput = z.infer<typeof ReviewRegistrationSchema>;

export type ReviewFormState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Update Student Schema ───────────────────────────────────────────────────

export const UpdateStudentSchema = z.object({
  studentId: z.string().uuid(),
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim(),
  suffix: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  address: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  // Guardians
  guardians: z.array(GuardianSchema).min(1, "At least one guardian is required."),
});

export type UpdateStudentInput = z.infer<typeof UpdateStudentSchema>;

export type UpdateStudentFormState = {
  errors?: Partial<Record<keyof UpdateStudentInput | "guardians" | "_form", string[]>>;
  message?: string;
  success?: boolean;
};
