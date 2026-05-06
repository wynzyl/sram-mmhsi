import { z } from "zod";
import type { BaseFormState } from "./common-schemas";

// ─── Create School Year Schema ───────────────────────────────────────────────

export const CreateSchoolYearSchema = z
  .object({
    label: z
      .string()
      .min(1, "Label is required.")
      .regex(
        /^\d{4}-\d{4}$/,
        "Label must be in YYYY-YYYY format (e.g., 2024-2025)."
      )
      .trim(),
    startDate: z
      .string()
      .min(1, "Start date is required.")
      .transform((v) => new Date(v)),
    endDate: z
      .string()
      .min(1, "End date is required.")
      .transform((v) => new Date(v)),
    isActive: z.boolean().default(false),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

export type CreateSchoolYearInput = z.infer<typeof CreateSchoolYearSchema>;

export type CreateSchoolYearFormState = BaseFormState<CreateSchoolYearInput> & {
  schoolYearId?: string;
};

// ─── Update School Year Schema ───────────────────────────────────────────────

export const UpdateSchoolYearSchema = z
  .object({
    schoolYearId: z.string().uuid("Invalid school year ID."),
    label: z
      .string()
      .min(1, "Label is required.")
      .regex(
        /^\d{4}-\d{4}$/,
        "Label must be in YYYY-YYYY format (e.g., 2024-2025)."
      )
      .trim(),
    startDate: z
      .string()
      .min(1, "Start date is required.")
      .transform((v) => new Date(v)),
    endDate: z
      .string()
      .min(1, "End date is required.")
      .transform((v) => new Date(v)),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date.",
    path: ["endDate"],
  });

export type UpdateSchoolYearInput = z.infer<typeof UpdateSchoolYearSchema>;

export type UpdateSchoolYearFormState = BaseFormState<UpdateSchoolYearInput>;

// ─── Toggle School Year Status Schema ────────────────────────────────────────

export const ToggleSchoolYearStatusSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID."),
  isActive: z.boolean(),
});

export type ToggleSchoolYearStatusInput = z.infer<
  typeof ToggleSchoolYearStatusSchema
>;

export type ToggleSchoolYearStatusFormState = BaseFormState<ToggleSchoolYearStatusInput>;

// ─── Delete School Year Schema ───────────────────────────────────────────────

export const DeleteSchoolYearSchema = z.object({
  schoolYearId: z.string().uuid("Invalid school year ID."),
});

export type DeleteSchoolYearInput = z.infer<typeof DeleteSchoolYearSchema>;

export type DeleteSchoolYearFormState = BaseFormState<DeleteSchoolYearInput>;
