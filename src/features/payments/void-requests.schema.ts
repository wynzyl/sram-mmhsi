import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Request Void (Cashier/Registrar initiates) ────────────────────────────────

export const RequestVoidSchema = z.object({
  paymentId: z.string().uuid("Payment ID is required"),
  requestReason: z
    .string()
    .trim()
    .min(3, "Reason must be at least 3 characters")
    .max(500, "Reason must be at most 500 characters"),
});

export type RequestVoidInput = z.infer<typeof RequestVoidSchema>;
export type RequestVoidFormState = BaseFormState<RequestVoidInput>;

// ─── Approve Void Request (Admin decides) ──────────────────────────────────────

export const ApproveVoidRequestSchema = z.object({
  requestId: z.string().uuid("Request ID is required"),
});

export type ApproveVoidRequestInput = z.infer<typeof ApproveVoidRequestSchema>;
export type ApproveVoidRequestFormState = BaseFormState<ApproveVoidRequestInput>;

// ─── Reject Void Request (Admin decides) ───────────────────────────────────────

export const RejectVoidRequestSchema = z.object({
  requestId: z.string().uuid("Request ID is required"),
  decisionRemarks: z
    .string()
    .trim()
    .min(3, "Decision remarks must be at least 3 characters")
    .max(500, "Decision remarks must be at most 500 characters"),
});

export type RejectVoidRequestInput = z.infer<typeof RejectVoidRequestSchema>;
export type RejectVoidRequestFormState = BaseFormState<RejectVoidRequestInput>;

// ─── Cancel Void Request (Requester cancels own request) ───────────────────────

export const CancelVoidRequestSchema = z.object({
  requestId: z.string().uuid("Request ID is required"),
});

export type CancelVoidRequestInput = z.infer<typeof CancelVoidRequestSchema>;
export type CancelVoidRequestFormState = BaseFormState<CancelVoidRequestInput>;
