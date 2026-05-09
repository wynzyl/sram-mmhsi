import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

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
