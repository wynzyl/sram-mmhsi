"use server";

/**
 * Document Requests Server Actions
 *
 * Server actions for document request management.
 */

import { db } from "@/lib/db";
import { documentRequests } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import {
  createDocumentRequestSchema,
  processDocumentRequestSchema,
  readyDocumentRequestSchema,
  releaseDocumentRequestSchema,
  rejectDocumentRequestSchema,
  cancelDocumentRequestSchema,
  type CreateDocumentRequestFormState,
  type ProcessDocumentRequestFormState,
  type ReadyDocumentRequestFormState,
  type ReleaseDocumentRequestFormState,
  type RejectDocumentRequestFormState,
  type CancelDocumentRequestFormState,
} from "./document-requests.schema";
import {
  getDocumentRequestForValidation,
  checkDocumentReleaseEligibility,
} from "./document-requests.queries";
import { canProgressRequest, canCancelRequest, canReleaseDocument } from "@/lib/constants/document-requests";

// ─── Create Document Request ─────────────────────────────────────────────────

export async function createDocumentRequestAction(
  _prevState: CreateDocumentRequestFormState,
  formData: FormData
): Promise<CreateDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:create")) {
    return { message: "You do not have permission to create document requests." };
  }

  // Parse and validate input
  const parsed = createDocumentRequestSchema.safeParse({
    studentId: formData.get("studentId"),
    schoolYearId: formData.get("schoolYearId") || undefined,
    documentType: formData.get("documentType"),
    purpose: formData.get("purpose") || undefined,
    copies: Number(formData.get("copies") || 1),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { studentId, schoolYearId, documentType, purpose, copies, remarks } = parsed.data;

  // Create the document request
  const [newRequest] = await db
    .insert(documentRequests)
    .values({
      studentId,
      schoolYearId: schoolYearId ?? null,
      documentType,
      purpose: purpose ?? null,
      copies,
      remarks: remarks ?? null,
      status: "requested",
      requestedBy: session.userId,
      requestedAt: new Date(),
    })
    .returning({ id: documentRequests.id });

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:create",
    targetEntity: "document_requests",
    targetId: newRequest.id,
    newState: { studentId, documentType, copies },
  });

  revalidatePath("/staff/archive/documents");
  revalidatePath(`/staff/archive/${studentId}`);

  return { success: true, requestId: newRequest.id };
}

// ─── Process Document Request ────────────────────────────────────────────────

export async function processDocumentRequestAction(
  _prevState: ProcessDocumentRequestFormState,
  formData: FormData
): Promise<ProcessDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    return { message: "You do not have permission to process document requests." };
  }

  // Parse and validate input
  const parsed = processDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    feeAmount: formData.get("feeAmount") ? Number(formData.get("feeAmount")) : undefined,
    documentNumber: formData.get("documentNumber") || undefined,
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, feeAmount, documentNumber, remarks } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (request.status !== "requested") {
    return { message: `Cannot process request with status "${request.status}".` };
  }

  // Update the request
  await db
    .update(documentRequests)
    .set({
      status: "processing",
      feeAmount: feeAmount?.toString() ?? null,
      documentNumber: documentNumber ?? null,
      remarks: remarks ?? null,
      processedBy: session.userId,
      processedAt: new Date(),
    })
    .where(eq(documentRequests.id, requestId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:process",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "processing", feeAmount, documentNumber },
  });

  revalidatePath("/staff/archive/documents");

  return { success: true };
}

// ─── Mark Document Ready ─────────────────────────────────────────────────────

export async function readyDocumentRequestAction(
  _prevState: ReadyDocumentRequestFormState,
  formData: FormData
): Promise<ReadyDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    return { message: "You do not have permission to process document requests." };
  }

  // Parse and validate input
  const parsed = readyDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    documentNumber: formData.get("documentNumber"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, documentNumber, remarks } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (request.status !== "processing") {
    return { message: `Cannot mark as ready from status "${request.status}".` };
  }

  // Update the request
  await db
    .update(documentRequests)
    .set({
      status: "ready",
      documentNumber,
      remarks: remarks ?? null,
    })
    .where(eq(documentRequests.id, requestId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:ready",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "ready", documentNumber },
  });

  revalidatePath("/staff/archive/documents");

  return { success: true };
}

// ─── Release Document ────────────────────────────────────────────────────────

export async function releaseDocumentRequestAction(
  _prevState: ReleaseDocumentRequestFormState,
  formData: FormData
): Promise<ReleaseDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:release")) {
    return { message: "You do not have permission to release documents." };
  }

  // Parse and validate input
  const parsed = releaseDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, remarks } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (!canReleaseDocument(request.status)) {
    return { message: `Cannot release document with status "${request.status}".` };
  }

  // Check release eligibility (balance + clearances)
  const eligibility = await checkDocumentReleaseEligibility(request.studentId);
  if (!eligibility.canRelease) {
    return { message: eligibility.reason };
  }

  // Update the request
  await db
    .update(documentRequests)
    .set({
      status: "released",
      remarks: remarks ?? null,
      releasedBy: session.userId,
      releasedAt: new Date(),
    })
    .where(eq(documentRequests.id, requestId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:release",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "released" },
  });

  revalidatePath("/staff/archive/documents");

  return { success: true };
}

// ─── Reject Document Request ─────────────────────────────────────────────────

export async function rejectDocumentRequestAction(
  _prevState: RejectDocumentRequestFormState,
  formData: FormData
): Promise<RejectDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    return { message: "You do not have permission to reject document requests." };
  }

  // Parse and validate input
  const parsed = rejectDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    rejectedReason: formData.get("rejectedReason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, rejectedReason } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (!canProgressRequest(request.status)) {
    return { message: `Cannot reject request with status "${request.status}".` };
  }

  // Update the request
  await db
    .update(documentRequests)
    .set({
      status: "rejected",
      rejectedReason,
      processedBy: session.userId,
      processedAt: new Date(),
    })
    .where(eq(documentRequests.id, requestId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:reject",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "rejected", rejectedReason },
  });

  revalidatePath("/staff/archive/documents");

  return { success: true };
}

// ─── Cancel Document Request ─────────────────────────────────────────────────

export async function cancelDocumentRequestAction(
  _prevState: CancelDocumentRequestFormState,
  formData: FormData
): Promise<CancelDocumentRequestFormState> {
  const session = await requireSession();

  // Permission check - either documents:process or the original requester can cancel
  if (!hasPermission(session.role, "documents:process")) {
    return { message: "You do not have permission to cancel document requests." };
  }

  // Parse and validate input
  const parsed = cancelDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, remarks } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (!canCancelRequest(request.status)) {
    return { message: `Cannot cancel request with status "${request.status}".` };
  }

  // Update the request
  await db
    .update(documentRequests)
    .set({
      status: "cancelled",
      remarks: remarks ?? null,
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(eq(documentRequests.id, requestId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:cancel",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "cancelled" },
  });

  revalidatePath("/staff/archive/documents");

  return { success: true };
}
