import { z } from "zod";

export const AssessmentScheduleLineSubmissionSchema = z.object({
  feeScheduleItemId: z.string().uuid(),
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
      const id = data.items[i]!.feeScheduleItemId;
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each catalog fee may only be added once.",
          path: ["items", i, "feeScheduleItemId"],
        });
        return;
      }
      seen.add(id);
    }
  });

export type CreateAssessmentFromEnrollmentInput = z.infer<
  typeof CreateAssessmentFromEnrollmentSchema
>;

export type AssessmentFormState = {
  errors?: Record<string, string[]>;
  message?: string;
  success?: boolean;
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
