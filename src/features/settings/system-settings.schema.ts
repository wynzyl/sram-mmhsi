import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Refund Cutoff Settings Schema ────────────────────────────────────────────

export const RefundCutoffSettingsSchema = z.object({
  refundCutoffStartDate: z
    .string()
    .min(1, "Start date is required")
    .refine((val) => !isNaN(Date.parse(val)), "Invalid date format"),
  refundCutoffDays: z.coerce
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(365, "Cannot exceed 365 days"),
});

export type RefundCutoffSettingsInput = z.infer<typeof RefundCutoffSettingsSchema>;

export type RefundCutoffSettingsFormState = BaseFormState<RefundCutoffSettingsInput> & {
  savedAt?: string;
};

// ─── System Setting Keys ──────────────────────────────────────────────────────

export const SYSTEM_SETTING_KEYS = {
  REFUND_CUTOFF_START_DATE: "refund_cutoff_start_date",
  REFUND_CUTOFF_DAYS: "refund_cutoff_days",
} as const;
