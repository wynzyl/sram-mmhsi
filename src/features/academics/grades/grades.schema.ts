import { z } from "zod";
import { GRADING_PERIODS, type GradingPeriod, type GradeSheetStatus } from "@/lib/constants/grading-periods";
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

// ─── Grade Sheet Workflow (NEW) ─────────────────────────────────────────────

/**
 * Create or get a grade sheet for a section/period.
 */
export const CreateGradeSheetSchema = z.object({
  sectionId: z.string().uuid("Section ID is required."),
  schoolYearId: z.string().uuid("School Year ID is required."),
  gradingPeriod: z.enum(GRADING_PERIODS, { message: "Invalid grading period." }),
});

export type CreateGradeSheetInput = z.infer<typeof CreateGradeSheetSchema>;
export type CreateGradeSheetFormState = BaseFormState<CreateGradeSheetInput> & {
  gradeSheetId?: string;
};

/**
 * Save grade entries to a grade sheet.
 */
export const SaveGradeSheetEntriesSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
  entries: z.array(
    z.object({
      studentId: z.string().uuid("Student ID is required."),
      subjectId: z.string().uuid("Subject ID is required."),
      grade: z.union([
        z.coerce.number().min(60, "Minimum grade is 60").max(100, "Maximum grade is 100"),
        z.literal(""),
        z.null(),
      ]).optional(),
      remarks: z.string().max(500).optional(),
    })
  ),
});

export type SaveGradeSheetEntriesInput = z.infer<typeof SaveGradeSheetEntriesSchema>;
export type SaveGradeSheetEntriesFormState = BaseFormState<SaveGradeSheetEntriesInput>;

/**
 * Submit grade sheet for coordinator review.
 */
export const SubmitGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
});

export type SubmitGradeSheetInput = z.infer<typeof SubmitGradeSheetSchema>;
export type SubmitGradeSheetFormState = BaseFormState<SubmitGradeSheetInput>;

/**
 * Return grade sheet with remarks.
 */
export const ReturnGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
  remarks: z.string().min(1, "Remarks are required when returning a grade sheet.").max(1000),
});

export type ReturnGradeSheetInput = z.infer<typeof ReturnGradeSheetSchema>;
export type ReturnGradeSheetFormState = BaseFormState<ReturnGradeSheetInput>;

/**
 * Approve grade sheet (coordinator or principal level).
 */
export const ApproveGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
});

export type ApproveGradeSheetInput = z.infer<typeof ApproveGradeSheetSchema>;
export type ApproveGradeSheetFormState = BaseFormState<ApproveGradeSheetInput>;

/**
 * Publish grade sheet to student portal.
 */
export const PublishGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
});

export type PublishGradeSheetInput = z.infer<typeof PublishGradeSheetSchema>;
export type PublishGradeSheetFormState = BaseFormState<PublishGradeSheetInput>;

/**
 * Lock grade sheet (immutable).
 */
export const LockGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
});

export type LockGradeSheetInput = z.infer<typeof LockGradeSheetSchema>;
export type LockGradeSheetFormState = BaseFormState<LockGradeSheetInput>;

/**
 * Unlock grade sheet (admin only, requires reason).
 */
export const UnlockGradeSheetSchema = z.object({
  gradeSheetId: z.string().uuid("Grade Sheet ID is required."),
  reason: z.string().min(1, "Reason is required when unlocking grades.").max(1000),
});

export type UnlockGradeSheetInput = z.infer<typeof UnlockGradeSheetSchema>;
export type UnlockGradeSheetFormState = BaseFormState<UnlockGradeSheetInput>;

// ─── View Types ──────────────────────────────────────────────────────────────

/**
 * Grade sheet view with section and adviser info.
 */
export interface GradeSheetView {
  id: string;
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  schoolYearId: string;
  schoolYearLabel: string;
  adviserId: string | null;
  adviserName: string | null;
  gradingPeriod: GradingPeriod;
  status: GradeSheetStatus;
  submittedAt: Date | null;
  coordinatorApprovedAt: Date | null;
  principalApprovedAt: Date | null;
  publishedAt: Date | null;
  lockedAt: Date | null;
  returnedAt: Date | null;
  returnRemarks: string | null;
  createdAt: Date;
}

/**
 * Grade sheet entry view with student and subject info.
 */
export interface GradeSheetEntryView {
  id: string;
  gradeSheetId: string;
  studentId: string;
  studentRef: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  grade: string | null;
  remarks: string | null;
}

/**
 * Grade sheet with all entries for display.
 */
export interface GradeSheetDetailView extends GradeSheetView {
  entries: GradeSheetEntryView[];
}
