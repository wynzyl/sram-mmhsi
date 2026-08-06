import { z } from "zod";
import {
  nameSchema,
  uuidSchema,
  type BaseFormState,
} from "@/lib/validators/common-schemas";

// ─── Create Section Schema ────────────────────────────────────────────────────

export const createSectionSchema = z.object({
  name: nameSchema.pipe(z.string().max(100, "Section name must be 100 characters or less")),
  gradeLevelId: uuidSchema,
  schoolYearId: uuidSchema,
});

export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export type CreateSectionFormState = BaseFormState<CreateSectionInput> & {
  sectionId?: string;
};

// ─── Update Section Schema ────────────────────────────────────────────────────

export const updateSectionSchema = createSectionSchema.extend({
  id: uuidSchema,
});

export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export type UpdateSectionFormState = BaseFormState<UpdateSectionInput>;

// ─── Delete Section Schema ────────────────────────────────────────────────────

export const deleteSectionSchema = z.object({
  id: uuidSchema,
});

// ─── View Type (Query Result) ─────────────────────────────────────────────────

export interface SectionView {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  schoolYearId: string;
  schoolYearLabel: string;
  isActiveYear: boolean;
  createdAt: Date;
  enrollmentCount: number;
  assignmentCount: number;
}

// ─── Dependency Counts ────────────────────────────────────────────────────────

export interface SectionDependencyCounts {
  enrollmentCount: number;
  assignmentCount: number;
}

// ─── Copy Sections Schema ────────────────────────────────────────────────────

export const copySectionsSchema = z.object({
  sourceSchoolYearId: uuidSchema,
  targetSchoolYearId: uuidSchema,
});

export type CopySectionsInput = z.infer<typeof copySectionsSchema>;

export type CopySectionsFormState = BaseFormState<CopySectionsInput> & {
  copied?: number;
  skipped?: number;
};

// ─── Students in Section (for Grade Entry) ───────────────────────────────────

/**
 * Student enrolled in a section - used for grade entry screens.
 * Only includes students with "enrolled" status.
 */
export interface StudentInSection {
  studentId: string;
  studentRef: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  enrollmentId: string;
  enrollmentStatus: string;
  /** SHS strand ID (null for non-SHS students) */
  strandId: string | null;
  /** SHS strand code (e.g., STEM, ABM, HUMSS) */
  strandCode: string | null;
  /** SHS strand name */
  strandName: string | null;
  /** Number of subjects student is enrolled in (strand-aware: core + strand-specific) */
  subjectCount: number;
  /** Total subjects available for student's strand (core + strand-specific) */
  subjectTotal: number;
}
