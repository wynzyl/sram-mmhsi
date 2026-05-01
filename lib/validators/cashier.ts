import { z } from "zod";

// ─── Receipt Booklet Validators ───────────────────────────────────────────────

export const CreateBookletSchema = z.object({
  series: z.string().trim().min(1, "Series is required (e.g., batch label or booklet code)"),
  prefix: z
    .string()
    .trim()
    .min(1, "Prefix is required (printed before the OR number, e.g. AP)")
    .max(32, "Prefix must be at most 32 characters"),
  startNumber: z.coerce.number().int().min(1, "Start number must be at least 1"),
  endNumber: z.coerce.number().int().min(1, "End number must be at least 1"),
}).refine((data) => data.endNumber > data.startNumber, {
  message: "End number must be greater than start number",
  path: ["endNumber"],
});

export type CreateBookletInput = z.infer<typeof CreateBookletSchema>;

export type BookletFormState = {
  errors?: Partial<Record<keyof CreateBookletInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Payment Posting Validators ───────────────────────────────────────────────

export const PostPaymentSchema = z.object({
  studentId: z.string().uuid("Student is required"),
  assessmentId: z.string().uuid("Assessment is required"),
  bookletId: z.string().uuid("Booklet selection is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "check", "bank_transfer", "gcash", "other"], {
    message: "Invalid payment method",
  }),
  referenceNumber: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export type PostPaymentInput = z.infer<typeof PostPaymentSchema>;

export type PaymentFormState = {
  errors?: Partial<Record<keyof PostPaymentInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Void Payment Validators ──────────────────────────────────────────────────

export const VoidPaymentSchema = z.object({
  paymentId: z.string().uuid("Payment ID is required"),
  voidReason: z.string().trim().min(3, "Please provide a reason for voiding"),
});

export type VoidPaymentInput = z.infer<typeof VoidPaymentSchema>;

export type VoidPaymentFormState = {
  errors?: Partial<Record<keyof VoidPaymentInput | "_form", string[]>>;
  message?: string;
  success?: boolean;
};
