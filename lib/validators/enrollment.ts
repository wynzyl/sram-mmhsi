import { z } from "zod";

export const enrollmentStudentTypeEnumSchema = z.enum([
  "new_student",
  "transferee",
  "old_student",
]);

// ─── New Enrollment Schema ────────────────────────────────────────────────────

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().uuid("Student is required."),
  schoolYearId: z.string().uuid("School year is required."),
  gradeLevelId: z.string().uuid("Grade level is required."),
  sectionId: z.string().uuid().optional(),
  registrationId: z.string().uuid().optional(),
  studentType: enrollmentStudentTypeEnumSchema.default("new_student"),
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
