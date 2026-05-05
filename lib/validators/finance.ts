import { z } from "zod";
import { FEE_ASSESSMENT_BANDS } from "@/lib/fee-schedule/bands";

// ─── Fee Schedule Validators ──────────────────────────────────────────────────

export const feeAssessmentBandSchema = z.enum(FEE_ASSESSMENT_BANDS);

export const FeeScheduleSchema = z.object({
  id: z.string().uuid().optional(),
  schoolYearId: z.string().uuid("School year is required"),
  /** Required when creating a schedule; omitted on update (band is immutable). */
  assessmentBand: feeAssessmentBandSchema.optional(),
  description: z.string().trim().min(3, "Description must be at least 3 characters"),
  isActive: z.boolean().default(true),
});

export type FeeScheduleInput = z.infer<typeof FeeScheduleSchema>;

export type FeeScheduleFormState = {
  errors?: Partial<Record<keyof FeeScheduleInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Fee Schedule Item Validators ─────────────────────────────────────────────

export const FeeScheduleItemSchema = z.object({
  id: z.string().uuid().optional(),
  feeScheduleId: z.string().uuid("Fee schedule is required"),
  description: z.string().trim().min(2, "Description is required"),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  isDiscount: z.boolean().default(false),
  order: z.coerce.number().int().default(0),
});

export type FeeScheduleItemInput = z.infer<typeof FeeScheduleItemSchema>;

export type FeeScheduleItemFormState = {
  errors?: Partial<Record<keyof FeeScheduleItemInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Assessment Item Validators (Manual Adjustments) ──────────────────────────

export const AssessmentItemSchema = z.object({
  assessmentId: z.string().uuid("Assessment ID is required"),
  description: z.string().trim().min(2, "Description is required"),
  amount: z.coerce.number().min(0, "Amount must be a positive number"),
  isDiscount: z.boolean().default(false),
});

export type AssessmentItemInput = z.infer<typeof AssessmentItemSchema>;

export type AssessmentItemFormState = {
  errors?: Partial<Record<keyof AssessmentItemInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};
