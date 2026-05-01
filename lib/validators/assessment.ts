import { z } from "zod";

export const AssessmentScheduleLineSubmissionSchema = z.object({
  feeScheduleItemId: z.string().uuid(),
  amount: z.coerce.number().finite().nonnegative(),
});

export const CreateAssessmentFromEnrollmentSchema = z.object({
  enrollmentId: z.string().uuid(),
  remarks: z.string().trim().optional(),
  items: z
    .array(AssessmentScheduleLineSubmissionSchema)
    .min(1, "Fee schedule must contain at least one line."),
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
