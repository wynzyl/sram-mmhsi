import { z } from "zod";
import type { BaseFormState } from "./common-schemas";

// ─── Admin: Teacher Assignments ─────────────────────────────────────────────
// Note: These schemas are kept for backwards compatibility with existing data.
// New teacher-subject-section assignments should use Subject Offerings.

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
