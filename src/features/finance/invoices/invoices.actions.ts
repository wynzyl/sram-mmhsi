"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { invoices, assessments, students } from "@/lib/db/schema";
import { eq, like } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import {
  GenerateInvoiceSchema,
  SendInvoiceSchema,
} from "./invoices.schema";
import type { InvoiceActionState } from "./invoices.schema";
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

export async function sendInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData
): Promise<InvoiceActionState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:send")) {
    return { message: "You do not have permission to send invoices." };
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
