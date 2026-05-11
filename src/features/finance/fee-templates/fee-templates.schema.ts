/**
 * Fee Templates Schema Definitions
 *
 * Validation schemas for managing reusable fee templates and their assignments.
 */

import { z } from "zod";
import { FEE_ASSESSMENT_BANDS } from "@/lib/fee-schedule/bands";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Template CRUD ────────────────────────────────────────────────────────

export const CreateFeeTemplateSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  assessmentBand: z.enum(FEE_ASSESSMENT_BANDS),
  description: z.string().optional(),
});

export const UpdateFeeTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3, "Name must be at least 3 characters").optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

// ─── Template Items ───────────────────────────────────────────────────────

export const AddFeeTemplateItemSchema = z.object({
  feeTemplateId: z.string().uuid(),
  feeItemTypeId: z.string().uuid(),
  defaultAmount: z.coerce.number().min(0, "Amount must be positive"),
  order: z.coerce.number().int().min(0).default(0),
});

export const UpdateFeeTemplateItemSchema = z.object({
  id: z.string().uuid(),
  defaultAmount: z.coerce.number().min(0, "Amount must be positive").optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const RemoveFeeTemplateItemSchema = z.object({
  id: z.string().uuid(),
});

// ─── Template Assignment ──────────────────────────────────────────────────

export const AssignTemplateToSchoolYearSchema = z.object({
  schoolYearId: z.string().uuid(),
  assessmentBand: z.enum(FEE_ASSESSMENT_BANDS),
  feeTemplateId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  expiryDate: z.coerce.date().nullable().optional(),
});

export const DeactivateScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
});

// ─── Overrides ────────────────────────────────────────────────────────────

export const CreateFeeOverrideSchema = z.object({
  scheduleId: z.string().uuid(),
  feeTemplateItemId: z.string().uuid(),
  overrideAmount: z.coerce.number().min(0, "Amount must be positive"),
  reason: z.string().optional(),
});

export const UpdateFeeOverrideSchema = z.object({
  id: z.string().uuid(),
  overrideAmount: z.coerce.number().min(0, "Amount must be positive").optional(),
  reason: z.string().optional(),
});

export const RemoveFeeOverrideSchema = z.object({
  id: z.string().uuid(),
});

// ─── Form States ──────────────────────────────────────────────────────────

export type CreateFeeTemplateFormState = BaseFormState<z.infer<typeof CreateFeeTemplateSchema>> & {
  templateId?: string;
};

export type AddFeeTemplateItemFormState = BaseFormState<z.infer<typeof AddFeeTemplateItemSchema>> & {
  itemId?: string;
};

export type AssignTemplateFormState = BaseFormState<z.infer<typeof AssignTemplateToSchoolYearSchema>> & {
  scheduleId?: string;
};

export type CreateFeeOverrideFormState = BaseFormState<z.infer<typeof CreateFeeOverrideSchema>> & {
  overrideId?: string;
};
