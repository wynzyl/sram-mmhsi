import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Clearance Type Constants ─────────────────────────────────────────────────

export const CLEARANCE_TYPES = [
  "end_of_year",
  "enrollment_cancellation",
  "transfer_out",
  "graduation",
  "other",
] as const;

export type ClearanceType = (typeof CLEARANCE_TYPES)[number];

export const CLEARANCE_TYPE_LABELS: Record<ClearanceType, string> = {
  end_of_year: "End of Year",
  enrollment_cancellation: "Enrollment Cancellation",
  transfer_out: "Transfer Out",
  graduation: "Graduation",
  other: "Other",
};

// ─── Clearance Status Constants ───────────────────────────────────────────────

export const CLEARANCE_STATUSES = ["cleared", "pending", "waived"] as const;

export type ClearanceStatus = (typeof CLEARANCE_STATUSES)[number];

export const CLEARANCE_STATUS_LABELS: Record<ClearanceStatus, string> = {
  cleared: "Cleared",
  pending: "Pending",
  waived: "Waived",
};

// ─── Resolution Type Constants ────────────────────────────────────────────────

export const RESOLUTION_TYPES = ["paid", "waived", "written_off"] as const;

export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

export const RESOLUTION_TYPE_LABELS: Record<ResolutionType, string> = {
  paid: "Paid",
  waived: "Waived",
  written_off: "Written Off",
};

// ─── Generate Clearance Schema ────────────────────────────────────────────────

/**
 * Schema for manually generating a clearance record.
 */
export const GenerateClearanceSchema = z.object({
  studentId: z.string().uuid("Student ID is required."),
  enrollmentId: z.string().uuid("Enrollment ID is required.").optional(),
  schoolYearId: z.string().uuid("School year ID is required.").optional(),
  clearanceType: z.enum(CLEARANCE_TYPES, {
    message: "Please select a clearance type.",
  }),
});

export type GenerateClearanceInput = z.infer<typeof GenerateClearanceSchema>;

export type GenerateClearanceFormState = BaseFormState<GenerateClearanceInput> & {
  clearanceId?: string;
};

// ─── Resolve Clearance Schema ─────────────────────────────────────────────────

/**
 * Schema for resolving a pending clearance.
 */
export const ResolveClearanceSchema = z
  .object({
    clearanceId: z.string().uuid("Clearance ID is required."),
    resolutionType: z.enum(RESOLUTION_TYPES, {
      message: "Please select a resolution type.",
    }),
    resolutionRemarks: z.string().trim().max(500, "Remarks are too long.").optional(),
  })
  .superRefine((data, ctx) => {
    // Waived and written_off require remarks
    if (["waived", "written_off"].includes(data.resolutionType)) {
      if (!data.resolutionRemarks || data.resolutionRemarks.length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please provide a reason for waiving/writing off the balance (minimum 10 characters).",
          path: ["resolutionRemarks"],
        });
      }
    }
  });

export type ResolveClearanceInput = z.infer<typeof ResolveClearanceSchema>;

export type ResolveClearanceFormState = BaseFormState<ResolveClearanceInput>;

// ─── Batch Generate End-of-Year Clearances Schema ─────────────────────────────

/**
 * Schema for batch generating end-of-year clearances for a school year.
 */
export const BatchGenerateEOYClearancesSchema = z.object({
  schoolYearId: z.string().uuid("School year ID is required."),
});

export type BatchGenerateEOYClearancesInput = z.infer<typeof BatchGenerateEOYClearancesSchema>;

export type BatchGenerateEOYClearancesFormState = BaseFormState<BatchGenerateEOYClearancesInput> & {
  generatedCount?: number;
  pendingCount?: number;
  clearedCount?: number;
};
