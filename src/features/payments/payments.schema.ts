import { z } from "zod";
import { OR_SEQUENCE_PAD, OR_NUMBER_REGEX } from "@/lib/utils/or-number";
import type { BaseFormState } from "@/lib/validators/common-schemas";

const BOOKLET_RECEIPT_COUNT = 50;
const OR_SEQUENCE_MAX = 99_999;

/** Printed OR prefix: exactly two letters (e.g. AK). */
const BOOKLET_PREFIX_REGEX = /^[A-Za-z]{2}$/;

/** Canonical booklet series line: `AK-00051-00100` (prefix-start-end). */
export function formatBookletSeriesCanonical(
  prefix: string,
  startNumber: number,
  endNumber: number
): string {
  const p = prefix.trim().toUpperCase();
  const a = String(Math.floor(startNumber)).padStart(OR_SEQUENCE_PAD, "0");
  const b = String(Math.floor(endNumber)).padStart(OR_SEQUENCE_PAD, "0");
  return `${p}-${a}-${b}`;
}

export function normalizeBookletSeriesInput(series: string): string {
  return series
    .trim()
    .replace(/\s+/g, "")
    .replace(/\s*-\s*/g, "-")
    .toUpperCase();
}

// ─── Receipt Booklet Validators ───────────────────────────────────────────────

/** Valid booklet usage modes */
export const BOOKLET_USAGE_MODES = ["auto_only", "manual_only"] as const;
export type BookletUsageMode = (typeof BOOKLET_USAGE_MODES)[number];

export const CreateBookletSchema = z
  .object({
    series: z
      .string()
      .trim()
      .min(1, 'Series is required in the form AK-00051-00100.'),
    prefix: z
      .string()
      .trim()
      .regex(BOOKLET_PREFIX_REGEX, "Prefix must be exactly 2 letters (e.g. AK)"),
    startNumber: z.coerce
      .number()
      .int("Start number must be a whole number")
      .min(1, "Start number must be at least 1")
      .max(OR_SEQUENCE_MAX, `Start number must be at most ${OR_SEQUENCE_MAX} (5-digit OR)`),
    endNumber: z.coerce
      .number()
      .int("End number must be a whole number")
      .min(1, "End number must be at least 1")
      .max(OR_SEQUENCE_MAX, `End number must be at most ${OR_SEQUENCE_MAX} (5-digit OR)`),
    usageMode: z.enum(BOOKLET_USAGE_MODES).default("auto_only"),
    /** Optional cashier to assign this booklet as their default */
    assignedCashierId: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.string().uuid("Invalid cashier").optional()
    ),
  })
  .refine((data) => data.endNumber >= data.startNumber, {
    message: "End number must be greater than or equal to start number",
    path: ["endNumber"],
  })
  .refine((data) => data.endNumber - data.startNumber + 1 === BOOKLET_RECEIPT_COUNT, {
    message: `Booklet must contain exactly ${BOOKLET_RECEIPT_COUNT} OR numbers (inclusive range).`,
    path: ["endNumber"],
  })
  .superRefine((data, ctx) => {
    const normalized = normalizeBookletSeriesInput(data.series);
    const canonical = formatBookletSeriesCanonical(data.prefix, data.startNumber, data.endNumber);
    if (normalized !== canonical) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["series"],
        message: `Series must exactly match start, end, and prefix: "${canonical}".`,
      });
    }
  });

export type CreateBookletInput = z.infer<typeof CreateBookletSchema>;

export type BookletFormState = BaseFormState<CreateBookletInput>;

// ─── Payment Posting Validators ───────────────────────────────────────────────

export const PostPaymentSchema = z
  .object({
    studentId: z.string().uuid("Student is required"),
    assessmentId: z.string().uuid("Assessment is required"),
    /** Booklet selection - required for auto-assign mode, ignored for manual entry */
    bookletId: z.preprocess((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      return String(v).trim();
    }, z.string().uuid("Booklet selection is required").optional()),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    paymentMethod: z.enum(["cash", "check", "bank_transfer", "gcash", "other"], {
      message: "Invalid payment method",
    }),
    /** Cash received; required when paymentMethod is cash. Posted amount remains `amount`. */
    amountTendered: z.preprocess((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }, z.number().optional()),
    referenceNumber: z.preprocess((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const s = String(v).trim();
      return s === "" ? undefined : s;
    }, z.string().optional()),
    remarks: z.string().trim().optional(),
    /**
     * Client-generated UUID (one per form mount) making the post idempotent —
     * a retried submit with the same key returns the original payment instead
     * of consuming a second OR. Optional for backward compatibility.
     */
    idempotencyKey: z.preprocess((v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      return v;
    }, z.string().uuid().optional()),

    // ─── Manual Entry Fields ───────────────────────────────────────────────────
    /** Toggle for manual/offline entry mode */
    isManualEntry: z.preprocess(
      (v) => v === "true" || v === true,
      z.boolean().default(false)
    ),
    /** Manual payment date (required when isManualEntry=true) */
    manualPaymentDate: z.preprocess((v) => {
      if (!v || v === "") return undefined;
      return new Date(v as string);
    }, z.date().optional()),
    /** Manual OR number entry (required when isManualEntry=true), format: "XX 00000" */
    manualOrNumber: z.preprocess((v) => {
      if (!v || v === "") return undefined;
      return String(v).trim().toUpperCase();
    }, z.string().optional()),

    // ─── Full Payment Cash Discount ───────────────────────────────────────────
    /** Apply full payment cash discount if eligible */
    applyCashDiscount: z.preprocess(
      (v) => v === "true" || v === true,
      z.boolean().default(false)
    ),
  })
  .superRefine((data, ctx) => {
    // ─── Manual Entry Validation ─────────────────────────────────────────────
    if (data.isManualEntry) {
      // Manual payment date required
      if (!data.manualPaymentDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualPaymentDate"],
          message: "Payment date is required for manual entries.",
        });
      } else if (data.manualPaymentDate > new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualPaymentDate"],
          message: "Payment date cannot be in the future.",
        });
      }

      // Manual OR number required and must match format
      if (!data.manualOrNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualOrNumber"],
          message: "OR number is required for manual entries.",
        });
      } else if (!OR_NUMBER_REGEX.test(data.manualOrNumber)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["manualOrNumber"],
          message: "OR must be format 'XX 00000' (e.g. AK 00050).",
        });
      }
    } else {
      // Auto-assign mode: bookletId required
      if (!data.bookletId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bookletId"],
          message: "Booklet selection is required.",
        });
      }
    }

    // ─── Reference Number Validation ─────────────────────────────────────────
    if (data.paymentMethod === "gcash" || data.paymentMethod === "bank_transfer") {
      if (!data.referenceNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["referenceNumber"],
          message: "Reference number is required for GCash and bank transfer payments.",
        });
      }
    }

    // ─── Cash Tendered Validation ────────────────────────────────────────────
    if (data.paymentMethod !== "cash") return;
    const tendered = data.amountTendered;
    if (tendered === undefined || Number.isNaN(tendered)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountTendered"],
        message: "Enter the cash amount received from the payor.",
      });
      return;
    }
    if (tendered < data.amount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amountTendered"],
        message: "Amount tendered must be equal to or greater than the amount to pay.",
      });
    }
  });

export type PostPaymentInput = z.infer<typeof PostPaymentSchema>;

export type PaymentFormState = BaseFormState<PostPaymentInput>;

// ─── Void Payment Validators ──────────────────────────────────────────────────

export const VoidPaymentSchema = z.object({
  paymentId: z.string().uuid("Payment ID is required"),
  voidReason: z.string().trim().min(3, "Please provide a reason for voiding"),
});

export type VoidPaymentInput = z.infer<typeof VoidPaymentSchema>;

export type VoidPaymentFormState = BaseFormState<VoidPaymentInput>;

// ─── Update Booklet Validators ─────────────────────────────────────────────────

/** Valid booklet statuses that can be set via edit (admin only) */
export const EDITABLE_BOOKLET_STATUSES = ["active", "inactive"] as const;
export type EditableBookletStatus = (typeof EDITABLE_BOOKLET_STATUSES)[number];

export const UpdateBookletSchema = z.object({
  bookletId: z.string().uuid("Booklet ID is required"),
  usageMode: z.enum(BOOKLET_USAGE_MODES, {
    message: "Usage mode must be 'auto_only' or 'manual_only'",
  }),
  assignedCashierId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().uuid("Invalid cashier").nullable()
  ),
  status: z.enum(EDITABLE_BOOKLET_STATUSES, {
    message: "Status must be 'active' or 'inactive'",
  }),
});

export type UpdateBookletInput = z.infer<typeof UpdateBookletSchema>;

export type UpdateBookletFormState = BaseFormState<UpdateBookletInput> & {
  bookletId?: string;
};
