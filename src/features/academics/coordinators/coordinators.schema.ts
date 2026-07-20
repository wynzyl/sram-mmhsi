import { z } from "zod";
import { uuidSchema, type BaseFormState } from "@/lib/validators/common-schemas";
import { GRADE_GROUPS, type GradeGroup } from "@/lib/constants/grade-groups";

// ─── Assign Coordinator Schema ───────────────────────────────────────────────

export const assignCoordinatorSchema = z.object({
  userId: uuidSchema,
  gradeGroup: z.enum(GRADE_GROUPS, { message: "Invalid grade group." }),
  schoolYearId: uuidSchema,
});

export type AssignCoordinatorInput = z.infer<typeof assignCoordinatorSchema>;

export type AssignCoordinatorFormState = BaseFormState<AssignCoordinatorInput> & {
  coordinatorId?: string;
};

// ─── Remove Coordinator Schema ───────────────────────────────────────────────

export const removeCoordinatorSchema = z.object({
  id: uuidSchema,
});

export type RemoveCoordinatorInput = z.infer<typeof removeCoordinatorSchema>;

export type RemoveCoordinatorFormState = BaseFormState<RemoveCoordinatorInput>;

// ─── View Types ──────────────────────────────────────────────────────────────

/**
 * Coordinator assignment view - includes user and school year data.
 */
export interface CoordinatorView {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  gradeGroup: GradeGroup;
  gradeGroupLabel: string;
  schoolYearId: string;
  schoolYearLabel: string;
  isActiveYear: boolean;
  createdAt: Date;
}

/**
 * User option for coordinator assignment dropdown.
 * Only coordinators can be assigned.
 */
export interface CoordinatorUserOption {
  id: string;
  name: string;
  email: string;
}
