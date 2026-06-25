/**
 * Document Requests Schema
 *
 * Zod validation schemas for document request operations.
 */

import { z } from "zod";
import { DOCUMENT_REQUEST_TYPES, DOCUMENT_REQUEST_STATUSES } from "@/lib/constants/document-requests";
import type { DocumentRequestType, DocumentRequestStatus } from "@/lib/constants/document-requests";
import type { BaseFormState } from "@/lib/validators/common-schemas";

// ─── Input Schemas ───────────────────────────────────────────────────────────

/**
 * Schema for creating a new document request
 */
export const createDocumentRequestSchema = z.object({
  studentId: z.string().uuid("Invalid student ID"),
  schoolYearId: z.string().uuid("Invalid school year ID").optional(),
  documentType: z.enum(DOCUMENT_REQUEST_TYPES, {
    message: "Please select a document type",
  }),
  purpose: z
    .string()
    .min(3, "Purpose must be at least 3 characters")
    .max(500, "Purpose must be at most 500 characters")
    .optional(),
  copies: z
    .number()
    .int("Copies must be a whole number")
    .min(1, "Must request at least 1 copy")
    .max(10, "Maximum 10 copies per request")
    .default(1),
  remarks: z.string().max(1000, "Remarks must be at most 1000 characters").optional(),
});

export type CreateDocumentRequestInput = z.infer<typeof createDocumentRequestSchema>;

/**
 * Schema for processing a document request (requested → processing)
 */
export const processDocumentRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  feeAmount: z
    .number()
    .min(0, "Fee amount cannot be negative")
    .max(100000, "Fee amount exceeds maximum")
    .optional(),
  documentNumber: z
    .string()
    .min(1, "Document number is required")
    .max(50, "Document number is too long")
    .optional(),
  remarks: z.string().max(1000, "Remarks must be at most 1000 characters").optional(),
});

export type ProcessDocumentRequestInput = z.infer<typeof processDocumentRequestSchema>;

/**
 * Schema for marking a document as ready (processing → ready)
 */
export const readyDocumentRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  documentNumber: z
    .string()
    .min(1, "Document number is required when marking ready")
    .max(50, "Document number is too long"),
  remarks: z.string().max(1000, "Remarks must be at most 1000 characters").optional(),
});

export type ReadyDocumentRequestInput = z.infer<typeof readyDocumentRequestSchema>;

/**
 * Schema for releasing a document (ready → released)
 * Only allowed if student has no outstanding balance and no pending clearances
 */
export const releaseDocumentRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  remarks: z.string().max(1000, "Remarks must be at most 1000 characters").optional(),
});

export type ReleaseDocumentRequestInput = z.infer<typeof releaseDocumentRequestSchema>;

/**
 * Schema for rejecting a document request
 */
export const rejectDocumentRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  rejectedReason: z
    .string()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(500, "Rejection reason must be at most 500 characters"),
});

export type RejectDocumentRequestInput = z.infer<typeof rejectDocumentRequestSchema>;

/**
 * Schema for cancelling a document request
 */
export const cancelDocumentRequestSchema = z.object({
  requestId: z.string().uuid("Invalid request ID"),
  remarks: z.string().max(500, "Remarks must be at most 500 characters").optional(),
});

export type CancelDocumentRequestInput = z.infer<typeof cancelDocumentRequestSchema>;

// ─── Filter Schema ───────────────────────────────────────────────────────────

/**
 * Schema for filtering document requests list
 */
export const documentRequestFilterSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  status: z.enum(DOCUMENT_REQUEST_STATUSES).optional(),
  documentType: z.enum(DOCUMENT_REQUEST_TYPES).optional(),
  studentId: z.string().uuid().optional(),
  schoolYearId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type DocumentRequestFilterInput = z.infer<typeof documentRequestFilterSchema>;

// ─── Form State Types ────────────────────────────────────────────────────────

export type CreateDocumentRequestFormState = BaseFormState<CreateDocumentRequestInput> & {
  requestId?: string;
};

export type ProcessDocumentRequestFormState = BaseFormState<ProcessDocumentRequestInput>;

export type ReadyDocumentRequestFormState = BaseFormState<ReadyDocumentRequestInput>;

export type ReleaseDocumentRequestFormState = BaseFormState<ReleaseDocumentRequestInput>;

export type RejectDocumentRequestFormState = BaseFormState<RejectDocumentRequestInput>;

export type CancelDocumentRequestFormState = BaseFormState<CancelDocumentRequestInput>;

// ─── Summary Types ───────────────────────────────────────────────────────────

export type DocumentRequestSummary = {
  total: number;
  byStatus: Record<DocumentRequestStatus, number>;
  byDocumentType: Record<DocumentRequestType, number>;
};
