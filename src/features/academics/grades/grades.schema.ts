import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

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
