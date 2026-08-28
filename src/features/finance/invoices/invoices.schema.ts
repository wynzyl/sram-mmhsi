import { z } from "zod";

export const GenerateInvoiceSchema = z.object({
  assessmentId: z.string().uuid("Invalid assessment ID"),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const SendInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  email: z.string().email("Please provide a valid email address"),
  idempotencyKey: z.string().min(1).optional(), // Unique key per form submission (not UUID)
});

export type SendInvoiceInput = z.infer<typeof SendInvoiceSchema>;

export type InvoiceActionState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};

// ─── Batch Invoice Generation ─────────────────────────────────────────────────

export const BatchGenerateInvoicesSchema = z.object({
  gradeLevelId: z.string().uuid("Invalid grade level"),
  sectionId: z.string().uuid("Invalid section").optional(),
  schoolYearId: z.string().uuid("Invalid school year").optional(),
});

export type BatchGenerateInvoicesInput = z.infer<typeof BatchGenerateInvoicesSchema>;

export type BatchInvoiceActionState = {
  success?: boolean;
  message?: string;
  errors?: Partial<Record<keyof BatchGenerateInvoicesInput | "_form", string[]>>;
  generatedCount?: number;
  skippedCount?: number;
};

// ─── Batch Invoice Sending ────────────────────────────────────────────────────

export const BatchSendInvoicesSchema = z.object({
  invoiceIds: z.array(z.string().uuid("Invalid invoice ID")).min(1, "Select at least one invoice"),
});

export type BatchSendInvoicesInput = z.infer<typeof BatchSendInvoicesSchema>;

export type BatchSendInvoiceActionState = {
  success?: boolean;
  message?: string;
  errors?: Partial<Record<keyof BatchSendInvoicesInput | "_form", string[]>>;
  sentCount?: number;
  failedCount?: number;
  /** Details of failures for user feedback */
  failures?: Array<{ invoiceNumber: string; reason: string }>;
};
