import { z } from "zod";

export const GenerateInvoiceSchema = z.object({
  assessmentId: z.string().uuid("Invalid assessment ID"),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const SendInvoiceSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  email: z.string().email("Please provide a valid email address"),
});

export type SendInvoiceInput = z.infer<typeof SendInvoiceSchema>;

export type InvoiceActionState = {
  errors?: Partial<Record<string, string[]>>;
  message?: string;
  success?: boolean;
};
