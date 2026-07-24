import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";
import type { ShsStrandCode } from "@/lib/constants/strands";

// ─── Generate Student Subject Enrollments Schema ──────────────────────────────

export const generateStudentSubjectEnrollmentsSchema = z.object({
  enrollmentId: uuidSchema,
});

export type GenerateStudentSubjectEnrollmentsInput = z.infer<
  typeof generateStudentSubjectEnrollmentsSchema
>;

export type GenerateStudentSubjectEnrollmentsFormState =
  BaseFormState<GenerateStudentSubjectEnrollmentsInput> & {
    createdCount?: number;
    skippedCount?: number;
  };

// ─── Change Strand Schema (SHS Only) ──────────────────────────────────────────

export const changeStudentStrandSchema = z.object({
  enrollmentId: uuidSchema,
  newStrandId: uuidSchema,
});

export type ChangeStudentStrandInput = z.infer<typeof changeStudentStrandSchema>;

export type ChangeStudentStrandFormState = BaseFormState<ChangeStudentStrandInput>;

// ─── Withdraw From Subject Schema ─────────────────────────────────────────────

export const withdrawFromSubjectSchema = z.object({
  studentSubjectEnrollmentId: uuidSchema,
  reason: z.string().trim().min(1, "Withdrawal reason is required").max(500),
});

export type WithdrawFromSubjectInput = z.infer<typeof withdrawFromSubjectSchema>;

export type WithdrawFromSubjectFormState = BaseFormState<WithdrawFromSubjectInput>;

// ─── View Types ───────────────────────────────────────────────────────────────

/**
 * Student subject enrollment view - student's enrolled subjects.
 */
export interface StudentSubjectEnrollmentView {
  id: string;
  enrollmentId: string;
  subjectOfferingId: string;
  studentId: string;
  studentName: string;
  studentRef: string;
  schoolYearId: string;
  schoolYearLabel: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectUnits: string;
  isCore: boolean;
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
  teacherId: string | null;
  teacherName: string | null;
  isActive: boolean;
  withdrawnAt: Date | null;
  withdrawalReason: string | null;
  createdAt: Date;
}

/**
 * Can change strand result.
 */
export interface CanChangeStrandResult {
  canChange: boolean;
  reason?: string;
  gradeCount: number;
  currentStrandId: string | null;
  currentStrandCode: ShsStrandCode | null;
  currentStrandName: string | null;
}

/**
 * Strand change eligibility info for UI display.
 */
export interface StrandChangeInfo {
  canChange: boolean;
  reason?: string;
  gradeCount: number;
}
