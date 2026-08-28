"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, assessments, students, enrollments } from "@/lib/db/schema";
import { eq, sql, inArray, gt, isNull, ne, notExists, and } from "drizzle-orm";
import { requireSession, requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  isEmailSendRateLimited,
  getEmailSendResetSeconds,
  checkEmailBatchCapacity,
  reserveEmailSendCapacity,
  isAdminActionRateLimited,
  getAdminActionResetSeconds,
} from "@/lib/security/rateLimit";
import {
  GenerateInvoiceSchema,
  SendInvoiceSchema,
  BatchGenerateInvoicesSchema,
  BatchSendInvoicesSchema,
} from "./invoices.schema";
import type { InvoiceActionState, BatchInvoiceActionState, BatchSendInvoiceActionState } from "./invoices.schema";
import { getInvoicesForSending } from "./invoices.queries";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import { logger } from "@/lib/observability/logger";
import { generateInvoiceNumber } from "@/lib/utils/reference";
import { sendInvoiceEmail } from "@/lib/email/sender";
import { generateAssessmentLetterHtml } from "@/lib/email/templates/assessment-letter";

export async function generateInvoiceAction(
  assessmentId: string
): Promise<InvoiceActionState & { invoiceId?: string }> {
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:read")) {
    return { message: "You do not have permission to manage invoices." };
  }

  const parsed = GenerateInvoiceSchema.safeParse({ assessmentId });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as InvoiceActionState["errors"] };
  }

  try {
    // Check if assessment exists
    const [assessment] = await db
      .select({
        id: assessments.id,
        studentId: assessments.studentId,
        balance: assessments.balance,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      return { message: "Assessment not found." };
    }

    // Check if invoice already exists for this assessment
    const existingInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.assessmentId, assessmentId),
    });

    if (existingInvoice) {
      return { success: true, message: "Invoice already exists.", invoiceId: existingInvoice.id };
    }

    // Generate Invoice Number using PostgreSQL sequence (prevents race conditions)
    const year = new Date().getFullYear();
    const seqResult = await db.execute<{ nextval: number }>(
      sql`SELECT nextval('invoice_number_seq') AS nextval`
    );
    const invoiceNum = generateInvoiceNumber(year, Number(seqResult[0].nextval));

    const [newInvoice] = await db
      .insert(invoices)
      .values({
        studentId: assessment.studentId,
        assessmentId: assessment.id,
        invoiceNumber: invoiceNum,
        amountDue: assessment.balance,
        status: "draft",
        createdBy: session.userId,
        updatedBy: session.userId,
      })
      .returning({ id: invoices.id });

    await logCreateAction(session, "invoices", newInvoice.id, {
      invoiceNumber: invoiceNum,
      amountDue: assessment.balance,
    }, { throwOnFail: true });

    revalidatePath("/staff/finance/invoices");
    revalidatePath(`/staff/assessments/${assessmentId}`);

    return { success: true, message: "Invoice generated successfully.", invoiceId: newInvoice.id };
  } catch (error) {
    logger.error("[invoices] Failed to generate invoice", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function generateInvoiceConfirmAction(
  _prevState: BaseFormState,
  formData: FormData
): Promise<BaseFormState> {
  const assessmentId = String(formData.get("assessmentId") ?? "");
  const result = await generateInvoiceAction(assessmentId);

  if (result.success && result.invoiceId) {
    redirect(`/staff/finance/invoices/${result.invoiceId}`);
  }

  return {
    success: false,
    errors: result.errors ?? (result.message ? { _form: [result.message] } : undefined),
    message: result.message,
  };
}

// Idempotency window for duplicate send prevention (in seconds)
const INVOICE_SEND_DEDUP_WINDOW_SECONDS = 30;

export async function sendInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const session = await requireStaffSession();
  if (!hasPermission(session.role, "invoices:send")) {
    return { message: "You do not have permission to send invoices." };
  }

  // 1. Rate limit check
  if (isEmailSendRateLimited(session.userId)) {
    const resetSeconds = getEmailSendResetSeconds(session.userId);
    return {
      message: `Too many emails sent. Please wait ${resetSeconds} seconds.`,
    };
  }

  const result = parseFormData(SendInvoiceSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { invoiceId, email } = result.data;

  try {
    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amountDue: invoices.amountDue,
        status: invoices.status,
        lastSentAt: invoices.lastSentAt,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
        studentReferenceNumber: students.referenceNumber,
      })
      .from(invoices)
      .innerJoin(students, eq(invoices.studentId, students.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { message: "Invoice not found." };
    }

    // 2. Idempotency check - prevent duplicate sends within dedup window
    if (invoice.lastSentAt) {
      const secondsSinceLastSend =
        (Date.now() - invoice.lastSentAt.getTime()) / 1000;
      if (secondsSinceLastSend < INVOICE_SEND_DEDUP_WINDOW_SECONDS) {
        return {
          success: true,
          message: "Invoice was already sent recently.",
        };
      }
    }

    const htmlContent = generateAssessmentLetterHtml({
      invoiceNumber: invoice.invoiceNumber,
      studentName: `${invoice.studentFirstName} ${invoice.studentLastName}`,
      studentReferenceNumber: invoice.studentReferenceNumber,
      amountDue: invoice.amountDue,
    });

    await sendInvoiceEmail({
      to: email,
      subject: `Assessment Invoice ${invoice.invoiceNumber} — Merryland Montesorri and High School`,
      html: htmlContent,
    });

    // 3. Update invoice with sent status and increment sentCount
    const now = new Date();
    await db
      .update(invoices)
      .set({
        status: "sent",
        sentAt: invoice.status === "draft" ? now : invoices.sentAt, // Keep original sentAt if already sent before
        lastSentAt: now,
        sentCount: sql`COALESCE(${invoices.sentCount}, 0) + 1`,
        sentBy: session.userId,
        updatedAt: now,
        updatedBy: session.userId,
      })
      .where(eq(invoices.id, invoiceId));

    await logUpdateAction(session, "invoices", invoiceId, {}, {
      sent: true,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: invoice.amountDue,
      studentName: `${invoice.studentFirstName} ${invoice.studentLastName}`,
      // avoid logging raw email; omit or hash if audit policy requires recipient tracing
    }, { throwOnFail: true });
    revalidatePath("/staff/finance/invoices");
    revalidatePath(`/staff/finance/invoices/${invoiceId}`);

    return { success: true, message: "Invoice sent successfully." };
  } catch (error: unknown) {
    logger.error("[invoices] Failed to send invoice", { error });
    return {
      message:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while sending the invoice.",
    };
  }
}

// ─── Batch Invoice Generation ─────────────────────────────────────────────────

/**
 * Generate invoices for multiple assessments in a batch operation.
 * Filters by grade level and optional section.
 * Skips assessments that already have invoices.
 */
export async function batchGenerateInvoicesAction(
  _prevState: BatchInvoiceActionState,
  formData: FormData
): Promise<BatchInvoiceActionState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "invoices:read")) {
    return { message: "You do not have permission to generate invoices." };
  }

  // Rate limit check - batch operations are resource-intensive
  if (isAdminActionRateLimited(session.userId)) {
    const resetSeconds = getAdminActionResetSeconds(session.userId);
    return {
      message: `Too many batch operations. Please wait ${resetSeconds} seconds.`,
    };
  }

  // Parse and validate input
  const parsed = BatchGenerateInvoicesSchema.safeParse({
    gradeLevelId: formData.get("gradeLevelId"),
    sectionId: formData.get("sectionId") || undefined,
    schoolYearId: formData.get("schoolYearId") || undefined,
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as BatchInvoiceActionState["errors"],
    };
  }

  const { gradeLevelId, sectionId, schoolYearId } = parsed.data;

  try {
    // Build dynamic conditions for fetching eligible assessments
    const conditions = [
      eq(enrollments.gradeLevelId, gradeLevelId),
      isNull(assessments.cancelledAt),
      isNull(assessments.transferredAt),
      gt(assessments.balance, "0"),
      isNull(students.deletedAt),
      ne(enrollments.status, "cancelled"),
    ];

    if (sectionId) {
      conditions.push(eq(enrollments.sectionId, sectionId));
    }

    if (schoolYearId) {
      conditions.push(eq(enrollments.schoolYearId, schoolYearId));
    }

    // Fetch eligible assessments that don't have invoices yet
    const eligibleAssessments = await db
      .select({
        assessmentId: assessments.id,
        studentId: assessments.studentId,
        balance: assessments.balance,
      })
      .from(assessments)
      .innerJoin(enrollments, eq(assessments.enrollmentId, enrollments.id))
      .innerJoin(students, eq(assessments.studentId, students.id))
      .where(
        and(
          ...conditions,
          notExists(
            db
              .select({ one: sql`1` })
              .from(invoices)
              .where(eq(invoices.assessmentId, assessments.id))
          )
        )
      );

    if (eligibleAssessments.length === 0) {
      return {
        success: true,
        message: "No eligible assessments found for invoice generation.",
        generatedCount: 0,
        skippedCount: 0,
      };
    }

    // Generate invoices in a transaction for atomicity
    const year = new Date().getFullYear();
    const now = new Date();

    // Execute in transaction to ensure atomicity
    const result = await db.transaction(async (tx) => {
      // Allocate invoice numbers atomically using PostgreSQL sequence
      const seqResult = await tx.execute<{ nextval: number }>(
        sql`SELECT nextval('invoice_number_seq') AS nextval FROM generate_series(1, ${eligibleAssessments.length})`
      );

      const invoicesToCreate = eligibleAssessments.map((assessment, index) => ({
        studentId: assessment.studentId,
        assessmentId: assessment.assessmentId,
        invoiceNumber: generateInvoiceNumber(year, Number(seqResult[index].nextval)),
        amountDue: assessment.balance,
        status: "draft" as const,
        createdAt: now,
        createdBy: session.userId,
        updatedAt: now,
        updatedBy: session.userId,
      }));

      // Bulk insert all invoices
      await tx.insert(invoices).values(invoicesToCreate);

      return invoicesToCreate;
    });

    // Log the batch operation (audit must succeed for financial operations)
    await logCreateAction(
      session,
      "invoices",
      "batch",
      {
        operation: "batch_generate",
        gradeLevelId,
        sectionId: sectionId ?? null,
        schoolYearId: schoolYearId ?? null,
        count: result.length,
        invoiceNumbers: result.map((inv) => inv.invoiceNumber),
      },
      { throwOnFail: true } // Financial operations require audit logging
    );

    revalidatePath("/staff/finance/invoices");

    return {
      success: true,
      message: `Successfully generated ${result.length} invoice(s).`,
      generatedCount: result.length,
      skippedCount: 0,
    };
  } catch (error) {
    logger.error("[invoices] Failed to batch generate invoices", { error });
    return {
      message: "An unexpected error occurred during batch invoice generation.",
    };
  }
}

// ─── Batch Invoice Sending ────────────────────────────────────────────────────

/**
 * Send multiple invoices via email in a batch operation.
 * Uses primary guardian email for each student.
 * Skips invoices without valid email addresses.
 */
export async function batchSendInvoicesAction(
  _prevState: BatchSendInvoiceActionState,
  formData: FormData
): Promise<BatchSendInvoiceActionState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "invoices:send")) {
    return { message: "You do not have permission to send invoices." };
  }

  // Parse invoice IDs from form data
  const invoiceIdsRaw = formData.get("invoiceIds");
  let invoiceIds: string[] = [];

  if (typeof invoiceIdsRaw === "string") {
    try {
      invoiceIds = JSON.parse(invoiceIdsRaw);
    } catch {
      return { errors: { invoiceIds: ["Invalid invoice selection"] } };
    }
  }

  const parsed = BatchSendInvoicesSchema.safeParse({ invoiceIds });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as BatchSendInvoiceActionState["errors"],
    };
  }

  // Pre-flight rate limit check - ensure entire batch can be sent
  // This prevents partial batch sends that would leave users confused
  const batchCapacity = checkEmailBatchCapacity(session.userId, parsed.data.invoiceIds.length);
  if (batchCapacity.blocked) {
    return {
      message: `Cannot send ${parsed.data.invoiceIds.length} invoices. Only ${batchCapacity.remainingCapacity} emails remaining in this window. Please wait ${batchCapacity.resetSeconds} seconds or reduce batch size.`,
    };
  }

  try {
    // Fetch invoice details with guardian emails
    const invoicesToSend = await getInvoicesForSending(parsed.data.invoiceIds);

    if (invoicesToSend.length === 0) {
      return {
        success: false,
        message: "No valid invoices found to send.",
        sentCount: 0,
        failedCount: 0,
      };
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const failures: Array<{ invoiceNumber: string; reason: string }> = [];

    // Idempotency check: Skip invoices that were sent recently (within dedup window)
    // This prevents duplicate emails from accidental double-submits
    const recentlySent = invoicesToSend.filter((inv) => {
      if (!inv.lastSentAt) return false;
      const secondsSinceLastSend = (now.getTime() - inv.lastSentAt.getTime()) / 1000;
      return secondsSinceLastSend < INVOICE_SEND_DEDUP_WINDOW_SECONDS;
    });

    // Add recently sent invoices to failures with clear message
    for (const inv of recentlySent) {
      failures.push({
        invoiceNumber: inv.invoiceNumber,
        reason: "Already sent recently (duplicate prevention)",
      });
    }

    // Filter out recently sent invoices from the batch
    const invoicesNotRecentlySent = invoicesToSend.filter((inv) => {
      if (!inv.lastSentAt) return true;
      const secondsSinceLastSend = (now.getTime() - inv.lastSentAt.getTime()) / 1000;
      return secondsSinceLastSend >= INVOICE_SEND_DEDUP_WINDOW_SECONDS;
    });

    // Pre-flight: Separate invoices with and without guardian emails
    const invoicesWithEmail = invoicesNotRecentlySent.filter((inv) => inv.guardianEmail);
    const invoicesWithoutEmail = invoicesNotRecentlySent.filter((inv) => !inv.guardianEmail);

    // Add all missing-email invoices to failures
    for (const inv of invoicesWithoutEmail) {
      failures.push({
        invoiceNumber: inv.invoiceNumber,
        reason: "No guardian email on file",
      });
    }

    if (invoicesWithEmail.length === 0) {
      return {
        success: false,
        message: "No invoices with valid guardian emails to send.",
        sentCount: 0,
        failedCount: failures.length,
        failures: failures.length > 0 ? failures : undefined,
      };
    }

    // Reserve capacity before sending to prevent concurrent operations from exceeding limit
    reserveEmailSendCapacity(session.userId, invoicesWithEmail.length);

    // Send emails in parallel using Promise.allSettled (performance optimization)
    const emailResults = await Promise.allSettled(
      invoicesWithEmail.map(async (invoice) => {
        const htmlContent = generateAssessmentLetterHtml({
          invoiceNumber: invoice.invoiceNumber,
          studentName: invoice.studentName,
          studentReferenceNumber: invoice.studentRef,
          amountDue: invoice.amountDue,
        });

        await sendInvoiceEmail({
          to: invoice.guardianEmail!,
          subject: `Assessment Invoice ${invoice.invoiceNumber} — Merryland Montesorri and High School`,
          html: htmlContent,
        });

        return invoice;
      })
    );

    // Collect successful and failed sends
    const successfulInvoices: typeof invoicesWithEmail = [];

    for (let i = 0; i < emailResults.length; i++) {
      const result = emailResults[i];
      const invoice = invoicesWithEmail[i];

      if (result.status === "fulfilled") {
        successfulInvoices.push(invoice);
      } else {
        logger.error("[invoices] Failed to send invoice in batch", {
          invoiceId: invoice.invoiceId,
          invoiceNumber: invoice.invoiceNumber,
          error: result.reason,
        });
        failures.push({
          invoiceNumber: invoice.invoiceNumber,
          reason: result.reason instanceof Error ? result.reason.message : "Email sending failed",
        });
      }
    }

    // Batch update all successfully sent invoices in a single query
    if (successfulInvoices.length > 0) {
      const successfulIds = successfulInvoices.map((inv) => inv.invoiceId);

      await db
        .update(invoices)
        .set({
          status: "sent",
          sentAt: sql`COALESCE(${invoices.sentAt}, ${nowIso}::timestamp)`,
          lastSentAt: now,
          sentCount: sql`COALESCE(${invoices.sentCount}, 0) + 1`,
          sentBy: session.userId,
          updatedAt: now,
          updatedBy: session.userId,
        })
        .where(inArray(invoices.id, successfulIds));
    }

    const sentCount = successfulInvoices.length;

    // Log the batch operation (audit must succeed for financial operations)
    await logUpdateAction(
      session,
      "invoices",
      "batch",
      {},
      {
        operation: "batch_send",
        requestedCount: invoicesToSend.length,
        sentCount,
        failedCount: failures.length,
        skippedDuplicateCount: recentlySent.length,
        invoiceNumbers: invoicesToSend.map((inv) => inv.invoiceNumber),
        sentInvoiceNumbers: successfulInvoices.map((inv) => inv.invoiceNumber),
      },
      { throwOnFail: true } // Financial operations require audit logging
    );

    revalidatePath("/staff/finance/invoices");

    // Build result message
    let message = `Successfully sent ${sentCount} invoice(s).`;
    if (failures.length > 0) {
      message += ` ${failures.length} failed.`;
    }

    return {
      success: sentCount > 0,
      message,
      sentCount,
      failedCount: failures.length,
      failures: failures.length > 0 ? failures : undefined,
    };
  } catch (error) {
    logger.error("[invoices] Failed to batch send invoices", { error });
    return {
      message: "An unexpected error occurred during batch email sending.",
    };
  }
}
