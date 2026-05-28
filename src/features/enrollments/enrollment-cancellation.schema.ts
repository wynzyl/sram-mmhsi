import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import { CANCELLATION_REASONS, isRemarksRequired, type CancellationReason } from "@/lib/constants/cancellation-reasons";

// ─── Cancellation Reason Schema ───────────────────────────────────────────────

export const cancellationReasonSchema = z.enum(CANCELLATION_REASONS, {
  message: "Please select a cancellation reason.",
});

// ─── Request Cancellation Schema ──────────────────────────────────────────────

/**
 * Schema for requesting enrollment cancellation.
 * Used by registrars/admin when submitting a cancellation request for enrolled status.
 * Also used for direct cancellation of pending/assessed enrollments.
 */
export const RequestEnrollmentCancellationSchema = z
  .object({
    enrollmentId: z.string().uuid("Enrollment ID is required."),
    reasonType: cancellationReasonSchema,
    remarks: z.string().trim().max(1000, "Remarks are too long.").optional(),
  })
  .superRefine((data, ctx) => {
    // When reason is "other", remarks are required (min 10 chars)
    if (isRemarksRequired(data.reasonType)) {
      if (!data.remarks || data.remarks.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide details for 'Other' reason (minimum 10 characters).",
          path: ["remarks"],
        });
      }
    }
  });

export type RequestEnrollmentCancellationInput = z.infer<typeof RequestEnrollmentCancellationSchema>;

export type RequestEnrollmentCancellationFormState = BaseFormState<RequestEnrollmentCancellationInput> & {
  requestId?: string;
  /** True if enrollment was directly cancelled (pending/assessed status) */
  directCancellation?: boolean;
};

// ─── Approve Cancellation Schema ──────────────────────────────────────────────

/**
 * Schema for admin approval of cancellation requests.
 */
export const ApproveEnrollmentCancellationSchema = z.object({
  requestId: z.string().uuid("Request ID is required."),
  reviewRemarks: z.string().trim().max(1000, "Review remarks are too long.").optional(),
});

export type ApproveEnrollmentCancellationInput = z.infer<typeof ApproveEnrollmentCancellationSchema>;

export type ApproveEnrollmentCancellationFormState = BaseFormState<ApproveEnrollmentCancellationInput> & {
  /** Refund calculation details for display */
  refundDetails?: {
    isEligibleForRefund: boolean;
    cutoffDate: string;
    refundableAmount: number;
    forfeitedAmount: number;
    totalPaid: number;
  };
  /** Clearance created if there was outstanding balance */
  clearanceId?: string;
};

// ─── Reject Cancellation Schema ───────────────────────────────────────────────

/**
 * Schema for admin rejection of cancellation requests.
 * Rejection reason is required.
 */
export const RejectEnrollmentCancellationSchema = z.object({
  requestId: z.string().uuid("Request ID is required."),
  reviewRemarks: z.string().trim().min(10, "Rejection reason is required (minimum 10 characters).").max(1000, "Review remarks are too long."),
});

export type RejectEnrollmentCancellationInput = z.infer<typeof RejectEnrollmentCancellationSchema>;

export type RejectEnrollmentCancellationFormState = BaseFormState<RejectEnrollmentCancellationInput>;

// ─── Withdraw Cancellation Request Schema ─────────────────────────────────────

/**
 * Schema for withdrawing a pending cancellation request.
 * Only the original requester can withdraw their request.
 */
export const WithdrawCancellationRequestSchema = z.object({
  requestId: z.string().uuid("Request ID is required."),
});

export type WithdrawCancellationRequestInput = z.infer<typeof WithdrawCancellationRequestSchema>;

export type WithdrawCancellationRequestFormState = BaseFormState<WithdrawCancellationRequestInput>;

// ─── Direct Cancellation Schema (for pending/assessed) ────────────────────────

/**
 * Schema for direct cancellation of pending/assessed enrollments.
 * Does not require approval workflow.
 */
export const DirectCancelEnrollmentSchema = z
  .object({
    enrollmentId: z.string().uuid("Enrollment ID is required."),
    reasonType: cancellationReasonSchema,
    remarks: z.string().trim().max(1000, "Remarks are too long.").optional(),
  })
  .superRefine((data, ctx) => {
    if (isRemarksRequired(data.reasonType)) {
      if (!data.remarks || data.remarks.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide details for 'Other' reason (minimum 10 characters).",
          path: ["remarks"],
        });
      }
    }
  });

export type DirectCancelEnrollmentInput = z.infer<typeof DirectCancelEnrollmentSchema>;

export type DirectCancelEnrollmentFormState = BaseFormState<DirectCancelEnrollmentInput> & {
  /** Refund details if payments existed */
  refundDetails?: {
    isEligibleForRefund: boolean;
    cutoffDate: string;
    refundableAmount: number;
    forfeitedAmount: number;
    totalPaid: number;
  };
};

// ─── Helper Types ─────────────────────────────────────────────────────────────

/** Type guard for cancellation reason */
export function isCancellationReason(value: unknown): value is CancellationReason {
  return typeof value === "string" && CANCELLATION_REASONS.includes(value as CancellationReason);
}
