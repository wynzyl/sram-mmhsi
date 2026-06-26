/**
 * Archive Schemas
 *
 * Zod validation schemas for archive-related actions.
 */

import { z } from "zod";
import {
  STUDENT_STATUSES,
  ARCHIVED_STUDENT_STATUSES,
  type StudentStatus,
} from "@/lib/constants/student-status";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Archive Student Schema ─────────────────────────────────────────────────

export const archiveStudentSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  status: z.enum(ARCHIVED_STUDENT_STATUSES, {
    message: "Please select an archive status",
  }),
  archiveReason: z
    .string()
    .trim()
    .min(10, "Archive reason must be at least 10 characters")
    .max(500, "Archive reason must be at most 500 characters"),
  schoolYearId: z.string().uuid("Invalid school year ID").optional(),
});

export type ArchiveStudentInput = z.infer<typeof archiveStudentSchema>;

export type ArchiveStudentFormState = BaseFormState<ArchiveStudentInput> & {
  studentId?: string;
};

// ─── Unarchive Student Schema ───────────────────────────────────────────────

export const unarchiveStudentSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be at most 500 characters")
    .optional(),
});

export type UnarchiveStudentInput = z.infer<typeof unarchiveStudentSchema>;

export type UnarchiveStudentFormState = BaseFormState<UnarchiveStudentInput> & {
  studentId?: string;
};

// ─── Batch Archive Graduates Schema ─────────────────────────────────────────

export const batchArchiveGraduatesSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID"),
  gradeLevelId: z
    .string()
    .uuid("Invalid grade level ID")
    .optional()
    .describe("Optional: specific grade level (defaults to Grade 12 / SHS)"),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be at most 500 characters")
    .optional(),
});

export type BatchArchiveGraduatesInput = z.infer<
  typeof batchArchiveGraduatesSchema
>;

export type BatchArchiveGraduatesFormState =
  BaseFormState<BatchArchiveGraduatesInput> & {
    archivedCount?: number;
    studentIds?: string[];
  };

// ─── Batch Cancel No-Show Schema ────────────────────────────────────────────

export const batchCancelNoShowSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID"),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be at most 500 characters")
    .optional(),
});

export type BatchCancelNoShowInput = z.infer<typeof batchCancelNoShowSchema>;

export type BatchCancelNoShowFormState =
  BaseFormState<BatchCancelNoShowInput> & {
    cancelledCount?: number;
    enrollmentIds?: string[];
  };

// ─── Batch Archive Non-Returning Schema ─────────────────────────────────────

/**
 * Schema for archiving students who were enrolled in a previous school year
 * but did not return (no enrollment) in the current school year.
 */
export const batchArchiveNonReturningSchema = z.object({
  previousSchoolYearId: z.string().uuid("Invalid previous school year ID"),
  currentSchoolYearId: z.string().uuid("Invalid current school year ID"),
  status: z.enum(ARCHIVED_STUDENT_STATUSES, {
    message: "Please select an archive status",
  }),
  remarks: z
    .string()
    .trim()
    .max(500, "Remarks must be at most 500 characters")
    .optional(),
});

export type BatchArchiveNonReturningInput = z.infer<
  typeof batchArchiveNonReturningSchema
>;

export type BatchArchiveNonReturningFormState =
  BaseFormState<BatchArchiveNonReturningInput> & {
    archivedCount?: number;
    studentIds?: string[];
  };

// ─── Archive Filter Schema ──────────────────────────────────────────────────

export const archiveFilterSchema = z.object({
  status: z.enum(STUDENT_STATUSES).optional(),
  schoolYearId: z.string().uuid().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ArchiveFilterInput = z.infer<typeof archiveFilterSchema>;

// ─── Archive Summary Type ───────────────────────────────────────────────────

export type ArchiveSummary = {
  total: number;
  byStatus: Record<StudentStatus, number>;
  bySchoolYear: Array<{
    schoolYearId: string;
    schoolYearLabel: string;
    count: number;
  }>;
};
