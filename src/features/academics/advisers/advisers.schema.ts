import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";

// ─── Assign Adviser Schema ───────────────────────────────────────────────────

export const assignAdviserSchema = z.object({
  sectionId: uuidSchema,
  userId: uuidSchema,
  schoolYearId: uuidSchema,
});

export type AssignAdviserInput = z.infer<typeof assignAdviserSchema>;

export type AssignAdviserFormState = BaseFormState<AssignAdviserInput> & {
  adviserId?: string;
};

// ─── Remove Adviser Schema ───────────────────────────────────────────────────

export const removeAdviserSchema = z.object({
  id: uuidSchema,
});

export type RemoveAdviserInput = z.infer<typeof removeAdviserSchema>;

export type RemoveAdviserFormState = BaseFormState<RemoveAdviserInput>;

// ─── View Types ──────────────────────────────────────────────────────────────

/**
 * Adviser assignment view - includes joined section and user data.
 */
export interface AdviserView {
  id: string;
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  gradeLevelOrder: number;
  userId: string;
  userName: string;
  userEmail: string;
  schoolYearId: string;
  schoolYearLabel: string;
  isActiveYear: boolean;
  createdAt: Date;
}

/**
 * Teacher option for dropdown - only teachers can be assigned as advisers.
 */
export interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

/**
 * Section option for dropdown - sections that don't have an adviser yet.
 */
export interface SectionOption {
  id: string;
  name: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
  hasAdviser: boolean;
}
