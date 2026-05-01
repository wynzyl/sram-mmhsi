import { z } from "zod";

// ─── Admin: Subject Management ──────────────────────────────────────────────

export const CreateSubjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  code: z.string().min(2, "Code must be at least 2 characters."),
  gradeLevelId: z.string().uuid("Grade level is required."),
});

export type CreateSubjectFormState = {
  errors?: Partial<Record<keyof z.infer<typeof CreateSubjectSchema> | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

export const DeleteSubjectSchema = z.object({
  subjectId: z.string().uuid("Subject ID is required."),
});

export type DeleteSubjectFormState = {
  errors?: Partial<Record<keyof z.infer<typeof DeleteSubjectSchema> | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Admin: Teacher Assignments ─────────────────────────────────────────────

export const AssignTeacherSchema = z.object({
  teacherId: z.string().uuid("Teacher is required."),
  subjectId: z.string().uuid("Subject is required."),
  sectionId: z.string().uuid("Section is required."),
  schoolYearId: z.string().uuid("School year is required."),
});

export type AssignTeacherInput = z.infer<typeof AssignTeacherSchema>;

export type AssignTeacherFormState = {
  errors?: Partial<Record<keyof AssignTeacherInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

export const RemoveAssignmentSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
});

export type RemoveAssignmentFormState = {
  errors?: Partial<Record<keyof z.infer<typeof RemoveAssignmentSchema> | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Teacher: Grade Encoding ────────────────────────────────────────────────

export const GradeEntrySchema = z.object({
  studentId: z.string().uuid(),
  gradingPeriod: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  grade: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional().nullable(),
});

export const SaveGradesSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
  schoolYearId: z.string().uuid("School Year ID is required."),
  grades: z.array(GradeEntrySchema),
});

export type SaveGradesInput = z.infer<typeof SaveGradesSchema>;

export type SaveGradesFormState = {
  errors?: Partial<Record<keyof SaveGradesInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

export const SubmitGradesSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
  gradingPeriod: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export type SubmitGradesFormState = {
  errors?: Partial<Record<keyof z.infer<typeof SubmitGradesSchema> | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Admin: Grade Locking ───────────────────────────────────────────────────

export const LockGradesSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
  gradingPeriod: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export type LockGradesFormState = {
  errors?: Partial<Record<keyof z.infer<typeof LockGradesSchema> | "_form", string[]>>;
  message?: string;
  success?: boolean;
};
