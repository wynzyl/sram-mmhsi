import { z } from "zod";
import type { BaseFormState } from "./common-schemas";

/**
 * ENROLLMENT CONFIRMATION VALIDATOR
 *
 * Used for the list-first enrollment workflow (Phase 2).
 * This is a simplified schema compared to CreateEnrollmentSchema because
 * most data is already known from the registration or previous enrollment.
 */

export const enrollmentStudentTypeEnumSchema = z.enum([
  "new_student",
  "transferee",
  "old_student",
]);

// ─── Confirm Enrollment Schema ────────────────────────────────────────────────

/**
 * Schema for confirming enrollment from the Ready to Enroll queue.
 *
 * Simpler than CreateEnrollmentSchema because:
 * - Student is already identified (from queue)
 * - Grade level is already determined (from registration or auto-promotion)
 * - Intake documents already captured in registration (for new/transferee)
 * - School year is always the active school year
 */
export const ConfirmEnrollmentSchema = z.object({
  studentId: z.string().uuid("Student ID is required."),
  schoolYearId: z.string().uuid("School year ID is required."),
  gradeLevelId: z.string().uuid("Grade level ID is required."),
  sectionId: z.string().uuid("Invalid section ID.").optional(),
  studentType: enrollmentStudentTypeEnumSchema,
  registrationId: z.string().uuid("Invalid registration ID.").optional(),
  // For transferees, if previousSchool is not already in student record
  previousSchool: z.string().trim().max(500, "Previous school name is too long.").optional(),
});

export type ConfirmEnrollmentInput = z.infer<typeof ConfirmEnrollmentSchema>;

export type ConfirmEnrollmentFormState = BaseFormState<ConfirmEnrollmentInput> & {
  enrollmentId?: string;
};

// ─── Quick Confirm Schema (No Section Assignment) ────────────────────────────

/**
 * Ultra-simplified schema for one-click enrollment confirmation without section assignment.
 * Used when clicking "Enroll" button directly from the table.
 */
export const QuickConfirmEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  schoolYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  studentType: enrollmentStudentTypeEnumSchema,
  registrationId: z.string().uuid().optional(),
});

export type QuickConfirmEnrollmentInput = z.infer<typeof QuickConfirmEnrollmentSchema>;

export type QuickConfirmEnrollmentFormState = BaseFormState<QuickConfirmEnrollmentInput> & {
  enrollmentId?: string;
};
