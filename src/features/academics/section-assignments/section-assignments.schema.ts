import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";

// ─── View Types (Query Results) ───────────────────────────────────────────────

/**
 * Student row for section assignment table.
 * Includes enrollment and current section info.
 */
export interface StudentForSectionAssignment {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  sectionId: string | null;
  sectionName: string | null;
  enrollmentStatus: string;
}

/**
 * Section with enrolled student count.
 * Used for section dropdown and capacity display.
 */
export interface SectionWithCount {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  studentCount: number;
}

/**
 * Simple section option for dropdowns.
 */
export interface SectionOption {
  id: string;
  name: string;
  studentCount: number;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export type SectionStatusFilter = "all" | "unassigned" | string; // string = specific section ID

export interface SectionAssignmentFilters {
  schoolYearId: string;
  gradeLevelId?: string;
  sectionStatus?: SectionStatusFilter;
}

// ─── Assign Students to Section ───────────────────────────────────────────────

export const assignStudentsToSectionSchema = z.object({
  enrollmentIds: z
    .array(uuidSchema)
    .min(1, "Select at least one student to assign."),
  sectionId: uuidSchema,
});

export type AssignStudentsToSectionInput = z.infer<typeof assignStudentsToSectionSchema>;

export type AssignStudentsToSectionFormState = BaseFormState<AssignStudentsToSectionInput> & {
  assignedCount?: number;
};

// ─── Remove from Section ──────────────────────────────────────────────────────

export const removeFromSectionSchema = z.object({
  enrollmentId: uuidSchema,
});

export type RemoveFromSectionInput = z.infer<typeof removeFromSectionSchema>;

export type RemoveFromSectionFormState = BaseFormState<RemoveFromSectionInput>;
