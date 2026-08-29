import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

export const AssessmentScheduleLineSubmissionSchema = z.object({
  feeTemplateItemId: z.string().uuid(),
  amount: z.coerce.number().finite().nonnegative(),
});

export const CreateAssessmentFromEnrollmentSchema = z
  .object({
    enrollmentId: z.string().uuid(),
    remarks: z.string().trim().optional(),
    items: z
      .array(AssessmentScheduleLineSubmissionSchema)
      .min(1, "Select at least one fee from the catalog."),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < data.items.length; i++) {
      const id = data.items[i]!.feeTemplateItemId;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each catalog fee may only be added once.",
          path: ["items", i, "feeTemplateItemId"],
        });
        return;
      }
      seen.add(id);
    }
  });

export type CreateAssessmentFromEnrollmentInput = z.infer<
  typeof CreateAssessmentFromEnrollmentSchema
>;

export type AssessmentFormState = BaseFormState<CreateAssessmentFromEnrollmentInput> & {
  assessmentId?: string;
};

export function computeAssessmentTotals(
  items: { amount: number; isDiscount: boolean }[]
): number {
  return items.reduce(
    (acc, row) => acc + (row.isDiscount ? -row.amount : row.amount),
    0
  );
}

// ─── Cancel Assessment Schema ─────────────────────────────────────────────────

export const CancelAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  remarks: z
    .string()
    .trim()
    .min(1, "Cancellation reason is required.")
    .max(500, "Cancellation reason must be 500 characters or less."),
});

export type CancelAssessmentInput = z.infer<typeof CancelAssessmentSchema>;

export type CancelAssessmentFormState = BaseFormState<CancelAssessmentInput> & {
  assessmentId?: string;
};

// ─── Special Education Fee Schemas ─────────────────────────────────────────────

export const AddSpecialFeeSchema = z.object({
  assessmentId: z.string().uuid(),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero."),
  reason: z.string().trim().max(500, "Reason must be 500 characters or less.").optional(),
});

export type AddSpecialFeeInput = z.infer<typeof AddSpecialFeeSchema>;

export type AddSpecialFeeFormState = BaseFormState<AddSpecialFeeInput> & {
  assessmentItemId?: string;
};

export const RemoveSpecialFeeSchema = z.object({
  assessmentItemId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required for removing special education fee.")
    .max(500, "Reason must be 500 characters or less."),
});

export type RemoveSpecialFeeInput = z.infer<typeof RemoveSpecialFeeSchema>;

export type RemoveSpecialFeeFormState = BaseFormState<RemoveSpecialFeeInput>;
