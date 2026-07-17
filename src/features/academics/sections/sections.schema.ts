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
