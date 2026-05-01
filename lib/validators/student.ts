import { z } from "zod";

// ─── Guardian Schema ───────────────────────────────────────────────────────────

export const GuardianSchema = z.object({
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim(),
  relationship: z.string().min(1, "Relationship is required.").trim(),
  address: z.string().min(1, "Address is required.").trim(),
  occupation: z.string().trim().optional(),
  contactNumber: z.string().min(1, "Contact number is required.").trim(),
  email: z.string().trim().email("Invalid email address.").min(1, "Email is required."),
  isPrimary: z.boolean().default(false),
});

export type GuardianInput = z.infer<typeof GuardianSchema>;

// ─── Student Creation Schema ───────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim().toUpperCase(),
  suffix: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  address: z.string().trim().optional(),

  // NEW FIELDS - Contact & Additional Information
  lrn: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[0-9]{12}$/.test(val), {
      message: "LRN must be exactly 12 digits if provided.",
    }),
  mobileNumber: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^(09|\+639)\d{9}$/.test(val), {
      message: "Mobile number must be a valid Philippine number (e.g., 09171234567).",
    }),
  email: z.string().trim().email("Invalid email address.").optional().or(z.literal("")),
  nationality: z.string().trim().max(100, "Nationality too long.").optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], {
      message: "Invalid blood type.",
    })
    .optional(),
  religion: z.string().trim().max(100, "Religion too long.").optional(),
  previousSchool: z.string().trim().max(500, "Too long.").optional(),
  submittedDocumentsNotes: z.string().trim().max(2000, "Too long.").optional(),

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


// ─── Update Student Schema ───────────────────────────────────────────────────

export const UpdateStudentSchema = z.object({
  studentId: z.string().uuid(),
  firstName: z.string().min(1, "First name is required.").trim(),
  middleName: z.string().trim().optional(),
  lastName: z.string().min(1, "Last name is required.").trim().toUpperCase(),
  suffix: z.string().trim().optional(),
  dateOfBirth: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  address: z.string().trim().optional(),

  // NEW FIELDS - Contact & Additional Information
  lrn: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[0-9]{12}$/.test(val), {
      message: "LRN must be exactly 12 digits if provided.",
    }),
  mobileNumber: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^(09|\+639)\d{9}$/.test(val), {
      message: "Mobile number must be a valid Philippine number.",
    }),
  email: z.string().trim().email("Invalid email address.").optional().or(z.literal("")),
  nationality: z.string().trim().max(100, "Nationality too long.").optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], {
      message: "Invalid blood type.",
    })
    .optional(),
  religion: z.string().trim().max(100, "Religion too long.").optional(),
  previousSchool: z.string().trim().max(500, "Too long.").optional(),
  submittedDocumentsNotes: z.string().trim().max(2000, "Too long.").optional(),

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
