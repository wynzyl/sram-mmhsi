"use server";

/**
 * Document Requests Server Actions
 *
 * Server actions for document request management.
 */

import { db } from "@/lib/db";
import { documentRequests } from "@/lib/db/schema";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { logPermissionDenied } from "@/lib/errors/audit-failures";
import { CACHE_TAGS, invalidateTag } from "@/lib/cache/cache-tags";
import { and, eq, like, sql } from "drizzle-orm";
import { formatDocumentNumber } from "@/lib/utils/reference";
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
  checkDocumentProcessingEligibility,
  checkDocumentRequestCreationEligibility,
} from "./document-requests.queries";
import { canProgressRequest, canCancelRequest, canReleaseDocument } from "@/lib/constants/document-requests";

// Fixed namespace id for the document-number advisory lock (arbitrary constant,
// distinct from other advisory-lock namespaces in the app).
const DOC_NUMBER_LOCK_NAMESPACE = 84012;

// Sentinel used to roll back a lifecycle transaction when a concurrent operator
// already changed the request's status (compare-and-set found no matching row).
class ConcurrentTransitionError extends Error {}

// Standard message returned when a compare-and-set update matches no row,
// meaning the request was transitioned concurrently by another operator.
const CONCURRENT_TRANSITION_MESSAGE =
  "This request was just updated by someone else. Please refresh and try again.";

// ─── Create Document Request ─────────────────────────────────────────────────

export async function createDocumentRequestAction(
  _prevState: CreateDocumentRequestFormState,
  formData: FormData
): Promise<CreateDocumentRequestFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "documents:create")) {
    await logPermissionDenied(
      session,
      "documents:create",
      "document_requests",
      String(formData.get("studentId") ?? "")
    );
    return { message: "You do not have permission to create document requests." };
  }

  // Check eligibility for document request creation (archived students without valid enrollment)
  const studentIdParam = String(formData.get("studentId") ?? "");
  const eligibility = await checkDocumentRequestCreationEligibility(studentIdParam);
  if (!eligibility.canCreate) {
    return { message: eligibility.reason };
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

  // Invalidate cache tag for document requests (non-blocking)
  // Note: forceUpdateTag/revalidatePath removed as they block the response in production.
  // The client calls router.refresh() after success which handles the page refresh.
  // Use invalidateTag for stale-while-revalidate behavior (non-blocking).
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true, requestId: newRequest.id };
}

// ─── Process Document Request ────────────────────────────────────────────────

export async function processDocumentRequestAction(
  _prevState: ProcessDocumentRequestFormState,
  formData: FormData
): Promise<ProcessDocumentRequestFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    await logPermissionDenied(
      session,
      "documents:process",
      "document_requests",
      String(formData.get("requestId") ?? "")
    );
    return { message: "You do not have permission to process document requests." };
  }

  // Parse and validate input
  const parsed = processDocumentRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    feeAmount: formData.get("feeAmount") ? Number(formData.get("feeAmount")) : undefined,
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { requestId, feeAmount, remarks } = parsed.data;

  // Get current request
  const request = await getDocumentRequestForValidation(requestId);
  if (!request) {
    return { message: "Document request not found." };
  }

  // Validate status transition
  if (request.status !== "requested") {
    return { message: `Cannot process request with status "${request.status}".` };
  }

  // Check processing eligibility (clearances must be resolved)
  const processingEligibility = await checkDocumentProcessingEligibility(
    request.studentId
  );
  if (!processingEligibility.canProcess) {
    return { message: processingEligibility.reason };
  }

  // Atomically allocate the next document number and apply the update in one
  // transaction. A year-keyed advisory lock serializes concurrent allocations
  // so two requests cannot compute the same DOC-YYYY-NNNNN number, and the
  // status is included in the WHERE clause (compare-and-set) so two operators
  // who both read "requested" cannot both transition it — only one update
  // matches a row; the loser aborts before the number is committed.
  const documentNumber = await db.transaction(async (tx) => {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;

    // Transaction-scoped lock keyed by (namespace, year); released on commit.
    // First key is a fixed namespace id for document-number allocation.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${DOC_NUMBER_LOCK_NAMESPACE}, ${year})`);

    const [{ maxSeq }] = await tx
      .select({
        maxSeq: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(${documentRequests.documentNumber}, '-', 3) AS INTEGER)), 0)`,
      })
      .from(documentRequests)
      .where(like(documentRequests.documentNumber, `${prefix}%`));

    const nextNumber = formatDocumentNumber(year, Number(maxSeq) + 1);

    const updated = await tx
      .update(documentRequests)
      .set({
        status: "processing",
        feeAmount: feeAmount?.toString() ?? null,
        documentNumber: nextNumber,
        remarks: remarks ?? null,
        processedBy: session.userId,
        processedAt: new Date(),
      })
      .where(
        and(
          eq(documentRequests.id, requestId),
          eq(documentRequests.status, "requested")
        )
      )
      .returning({ id: documentRequests.id });

    if (updated.length === 0) {
      // Another operator already moved this request out of "requested".
      // Throw to roll back the transaction (reclaiming the allocated number).
      throw new ConcurrentTransitionError();
    }

    return nextNumber;
  }).catch((err) => {
    if (err instanceof ConcurrentTransitionError) return null;
    throw err;
  });

  if (documentNumber === null) {
    return { message: CONCURRENT_TRANSITION_MESSAGE };
  }

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

  // Non-blocking cache invalidation - client handles page refresh
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true };
}

// ─── Mark Document Ready ─────────────────────────────────────────────────────

export async function readyDocumentRequestAction(
  _prevState: ReadyDocumentRequestFormState,
  formData: FormData
): Promise<ReadyDocumentRequestFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    await logPermissionDenied(
      session,
      "documents:process",
      "document_requests",
      String(formData.get("requestId") ?? "")
    );
    return { message: "You do not have permission to process document requests." };
  }

  // Parse and validate input
  const parsed = readyDocumentRequestSchema.safeParse({
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
  if (request.status !== "processing") {
    return { message: `Cannot mark as ready from status "${request.status}".` };
  }

  // Document number should already be set from process stage
  if (!request.documentNumber) {
    return { message: "Document number was not assigned during processing." };
  }

  // Compare-and-set: only transition if still "processing" so two operators
  // cannot both mark the same request ready.
  const readyUpdated = await db
    .update(documentRequests)
    .set({
      status: "ready",
      remarks: remarks ?? null,
    })
    .where(
      and(
        eq(documentRequests.id, requestId),
        eq(documentRequests.status, "processing")
      )
    )
    .returning({ id: documentRequests.id });

  if (readyUpdated.length === 0) {
    return { message: CONCURRENT_TRANSITION_MESSAGE };
  }

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "documents:ready",
    targetEntity: "document_requests",
    targetId: requestId,
    previousState: { status: request.status },
    newState: { status: "ready", documentNumber: request.documentNumber },
  });

  // Non-blocking cache invalidation - client handles page refresh
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true };
}

// ─── Release Document ────────────────────────────────────────────────────────

export async function releaseDocumentRequestAction(
  _prevState: ReleaseDocumentRequestFormState,
  formData: FormData
): Promise<ReleaseDocumentRequestFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "documents:release")) {
    await logPermissionDenied(
      session,
      "documents:release",
      "document_requests",
      String(formData.get("requestId") ?? "")
    );
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

  // Compare-and-set: only release if the request is still in the status we
  // validated, so a concurrent transition cannot be overwritten.
  const releaseUpdated = await db
    .update(documentRequests)
    .set({
      status: "released",
      remarks: remarks ?? null,
      releasedBy: session.userId,
      releasedAt: new Date(),
    })
    .where(
      and(
        eq(documentRequests.id, requestId),
        eq(documentRequests.status, request.status)
      )
    )
    .returning({ id: documentRequests.id });

  if (releaseUpdated.length === 0) {
    return { message: CONCURRENT_TRANSITION_MESSAGE };
  }

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

  // Non-blocking cache invalidation - client handles page refresh
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true };
}

// ─── Reject Document Request ─────────────────────────────────────────────────

export async function rejectDocumentRequestAction(
  _prevState: RejectDocumentRequestFormState,
  formData: FormData
): Promise<RejectDocumentRequestFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "documents:process")) {
    await logPermissionDenied(
      session,
      "documents:process",
      "document_requests",
      String(formData.get("requestId") ?? "")
    );
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

  // Compare-and-set: only reject if the request is still in the status we
  // validated, so a concurrent transition cannot be overwritten.
  const rejectUpdated = await db
    .update(documentRequests)
    .set({
      status: "rejected",
      rejectedReason,
      processedBy: session.userId,
      processedAt: new Date(),
    })
    .where(
      and(
        eq(documentRequests.id, requestId),
        eq(documentRequests.status, request.status)
      )
    )
    .returning({ id: documentRequests.id });

  if (rejectUpdated.length === 0) {
    return { message: CONCURRENT_TRANSITION_MESSAGE };
  }

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

  // Non-blocking cache invalidation - client handles page refresh
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true };
}

// ─── Cancel Document Request ─────────────────────────────────────────────────

export async function cancelDocumentRequestAction(
  _prevState: CancelDocumentRequestFormState,
  formData: FormData
): Promise<CancelDocumentRequestFormState> {
  const session = await requireStaffSession();

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

  // Permission check - either documents:process or the original requester can cancel.
  // Resolved after the lookup so the requester-cancel path is reachable.
  const isOriginalRequester = request.requestedBy === session.userId;
  if (!hasPermission(session.role, "documents:process") && !isOriginalRequester) {
    await logPermissionDenied(
      session,
      "documents:cancel",
      "document_requests",
      request.id
    );
    return { message: "You do not have permission to cancel document requests." };
  }

  // Validate status transition
  if (!canCancelRequest(request.status)) {
    return { message: `Cannot cancel request with status "${request.status}".` };
  }

  // Compare-and-set: only cancel if the request is still in the status we
  // validated, so a concurrent transition cannot be overwritten.
  // (Don't soft-delete - status is sufficient for cancelled state.)
  const cancelUpdated = await db
    .update(documentRequests)
    .set({
      status: "cancelled",
      remarks: remarks ?? null,
    })
    .where(
      and(
        eq(documentRequests.id, requestId),
        eq(documentRequests.status, request.status)
      )
    )
    .returning({ id: documentRequests.id });

  if (cancelUpdated.length === 0) {
    return { message: CONCURRENT_TRANSITION_MESSAGE };
  }

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

  // Non-blocking cache invalidation - client handles page refresh
  invalidateTag(CACHE_TAGS.DOCUMENT_REQUESTS);

  return { success: true };
}
