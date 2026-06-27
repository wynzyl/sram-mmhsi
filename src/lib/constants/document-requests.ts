/**
 * Document Request Constants
 *
 * Defines the types and statuses for document requests from students/alumni.
 *
 * **Document Types:**
 * - form_137 - Permanent Record (School Record)
 * - form_138 - Report Card
 * - good_moral - Certificate of Good Moral Character
 * - cert_enrollment - Certificate of Enrollment
 * - cert_completion - Certificate of Completion
 * - diploma_copy - Copy of Diploma
 * - other - Other documents (requires description in remarks)
 *
 * **Workflow:**
 * requested → processing → ready → released
 * requested → rejected (if invalid request)
 * requested/processing → cancelled (if withdrawn)
 *
 * **Release Gate:**
 * Documents can only be released when:
 * 1. Student has no outstanding balance
 * 2. All clearances are resolved
 */

export const DOCUMENT_REQUEST_TYPES = [
  "form_137",
  "form_138",
  "good_moral",
  "cert_enrollment",
  "cert_completion",
  "diploma_copy",
  "other",
] as const satisfies readonly [string, ...string[]];

export type DocumentRequestType = (typeof DOCUMENT_REQUEST_TYPES)[number];

export const DOCUMENT_REQUEST_TYPE_LABELS: Record<DocumentRequestType, string> = {
  form_137: "Form 137 (Permanent Record)",
  form_138: "Form 138 (Report Card)",
  good_moral: "Certificate of Good Moral Character",
  cert_enrollment: "Certificate of Enrollment",
  cert_completion: "Certificate of Completion",
  diploma_copy: "Copy of Diploma",
  other: "Other Document",
};

export const DOCUMENT_REQUEST_TYPE_DESCRIPTIONS: Record<DocumentRequestType, string> = {
  form_137: "Official permanent school record / transcript",
  form_138: "Report card showing quarterly grades",
  good_moral: "Certificate attesting to good character and conduct",
  cert_enrollment: "Proof of current enrollment status",
  cert_completion: "Certificate for completing a grade level or program",
  diploma_copy: "Certified copy of graduation diploma",
  other: "Other document type - specify in remarks",
};

export const DOCUMENT_REQUEST_STATUSES = [
  "requested",
  "processing",
  "ready",
  "released",
  "rejected",
  "cancelled",
] as const satisfies readonly [string, ...string[]];

export type DocumentRequestStatus = (typeof DOCUMENT_REQUEST_STATUSES)[number];

export const DOCUMENT_REQUEST_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  requested: "Requested",
  processing: "Processing",
  ready: "Ready for Release",
  released: "Released",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const DOCUMENT_REQUEST_STATUS_DESCRIPTIONS: Record<DocumentRequestStatus, string> = {
  requested: "Request submitted, awaiting processing",
  processing: "Document is being prepared",
  ready: "Document ready, pending payment clearance",
  released: "Document has been released to requester",
  rejected: "Request was rejected (see rejection reason)",
  cancelled: "Request was cancelled by requester or staff",
};

/**
 * Check if a document request status allows the document to be released
 */
export function canReleaseDocument(status: DocumentRequestStatus): boolean {
  return status === "ready";
}

/**
 * Check if a document request status can be cancelled
 */
export function canCancelRequest(status: DocumentRequestStatus): boolean {
  return status === "requested" || status === "processing";
}

/**
 * Check if a document request status can be progressed to next step
 */
export function canProgressRequest(status: DocumentRequestStatus): boolean {
  return status === "requested" || status === "processing";
}
