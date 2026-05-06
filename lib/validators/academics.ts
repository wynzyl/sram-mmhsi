import { z } from "zod";
import type { BaseFormState } from "./common-schemas";

// ─── Admin: Subject Management ──────────────────────────────────────────────

export const CreateSubjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  code: z.string().min(2, "Code must be at least 2 characters."),
  gradeLevelId: z.string().uuid("Grade level is required."),
});

export type CreateSubjectFormState = BaseFormState<z.infer<typeof CreateSubjectSchema>>;

export const DeleteSubjectSchema = z.object({
  subjectId: z.string().uuid("Subject ID is required."),
});

export type DeleteSubjectFormState = BaseFormState<z.infer<typeof DeleteSubjectSchema>>;

// ─── Admin: Teacher Assignments ─────────────────────────────────────────────

export const AssignTeacherSchema = z.object({
  teacherId: z.string().uuid("Teacher is required."),
  subjectId: z.string().uuid("Subject is required."),
  sectionId: z.string().uuid("Section is required."),
  schoolYearId: z.string().uuid("School year is required."),
});

export type AssignTeacherInput = z.infer<typeof AssignTeacherSchema>;

export type AssignTeacherFormState = BaseFormState<AssignTeacherInput>;

export const RemoveAssignmentSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
});

export type RemoveAssignmentFormState = BaseFormState<z.infer<typeof RemoveAssignmentSchema>>;

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

export type SaveGradesFormState = BaseFormState<SaveGradesInput>;

export const SubmitGradesSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
  gradingPeriod: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export type SubmitGradesFormState = BaseFormState<z.infer<typeof SubmitGradesSchema>>;

// ─── Admin: Grade Locking ───────────────────────────────────────────────────

export const LockGradesSchema = z.object({
  assignmentId: z.string().uuid("Assignment ID is required."),
  gradingPeriod: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

export type LockGradesFormState = BaseFormState<z.infer<typeof LockGradesSchema>>;
