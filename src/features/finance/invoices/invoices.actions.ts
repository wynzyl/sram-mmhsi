"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, assessments, students } from "@/lib/db/schema";
import { eq, like } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
import {
  GenerateInvoiceSchema,
  SendInvoiceSchema,
} from "./invoices.schema";
import type { InvoiceActionState } from "./invoices.schema";
import type { BaseFormState } from "@/lib/validators/common-schemas";
import { logger } from "@/lib/observability/logger";
import { generateInvoiceNumber } from "@/lib/utils/reference";
import { sendInvoiceEmail } from "@/lib/email/sender";

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

    // Generate Invoice Number
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const invoicesThisYear = await db.query.invoices.findMany({
      where: like(invoices.invoiceNumber, `${prefix}%`),
      columns: { invoiceNumber: true },
    });
    
    let maxSeq = 0;
    for (const inv of invoicesThisYear) {
      const parts = inv.invoiceNumber.split("-");
      if (parts.length === 3) {
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    const invoiceNum = generateInvoiceNumber(year, nextSeq);

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
    });

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

export async function sendInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:send")) {
    return { message: "You do not have permission to send invoices." };
  }

  const invoiceId = formData.get("invoiceId") as string;
  const email = formData.get("email") as string;

  const parsed = SendInvoiceSchema.safeParse({ invoiceId, email });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as InvoiceActionState["errors"] };
  }

  try {
    const [invoice] = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amountDue: invoices.amountDue,
        status: invoices.status,
        studentFirstName: students.firstName,
        studentLastName: students.lastName,
      })
      .from(invoices)
      .innerJoin(students, eq(invoices.studentId, students.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return { message: "Invoice not found." };
    }

    const htmlContent = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #111827; margin-bottom: 24px;">Invoice: ${invoice.invoiceNumber}</h2>
        <p style="color: #374151;">Dear ${invoice.studentFirstName} ${invoice.studentLastName},</p>
        <p style="color: #374151;">Please find your invoice details below:</p>
        <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Amount Due:</strong> ₱${Number(invoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style="margin: 0;"><strong>Status:</strong> ${invoice.status.toUpperCase()}</p>
        </div>
        <p style="color: #374151;">Thank you for your prompt payment.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">This is an automated message from SRAMS. Please do not reply directly to this email.</p>
      </div>
    `;

    await sendInvoiceEmail({
      to: email,
      subject: `Invoice ${invoice.invoiceNumber} from SRAMS`,
      html: htmlContent,
    });

    await db
      .update(invoices)
      .set({
        status: "sent",
        sentAt: new Date(),
        sentBy: session.userId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(invoices.id, invoiceId));

    await logUpdateAction(session, "invoices", invoiceId, {}, {
      sent: true,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: invoice.amountDue,
      studentName: `${invoice.studentFirstName} ${invoice.studentLastName}`,
      // avoid logging raw email; omit or hash if audit policy requires recipient tracing
    });
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
