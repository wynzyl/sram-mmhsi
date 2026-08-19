import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { invoices, students, assessments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  isReportExportRateLimited,
  getReportExportResetSeconds,
} from "@/lib/security/rateLimit";
import { InvoiceDocument } from "@/features/finance/invoices/invoice-document";
import { pdfResponse } from "@/features/reports/shared/report-response";
import { logReportExport } from "@/features/reports/shared/audit-report";

/**
 * Official invoice PDF.
 *
 *   GET /staff/finance/invoices/{id}/export?format=pdf
 *
 * Replaces the legacy /print HTML + window.print() route. Served inline so it
 * opens in the browser viewer ready to print or save.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!hasPermission(user.role, "invoices:read")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Rate limit: 10 exports per minute per user
  if (isReportExportRateLimited(user.id)) {
    const resetSeconds = getReportExportResetSeconds(user.id);
    return NextResponse.json(
      { error: `Too many export requests. Try again in ${resetSeconds} seconds.` },
      { status: 429 }
    );
  }

  const { id } = await params;

  const [invoice] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      amountDue: invoices.amountDue,
      createdAt: invoices.createdAt,
      currentBalance: assessments.balance,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentReferenceNumber: students.referenceNumber,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .leftJoin(assessments, eq(invoices.assessmentId, assessments.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const studentName = [
    invoice.studentFirstName,
    invoice.studentMiddleName,
    invoice.studentLastName,
  ]
    .filter(Boolean)
    .join(" ");

  const buffer = await renderToBuffer(
    InvoiceDocument({
      data: {
        invoiceNumber: invoice.invoiceNumber,
        studentName,
        studentReferenceNumber: invoice.studentReferenceNumber,
        amountDue: invoice.amountDue,
        currentBalance: invoice.currentBalance,
        date: new Date(invoice.createdAt),
      },
    }),
  );

  await logReportExport({
    actor: user,
    report: "invoice",
    format: "pdf",
    targetId: id,
    filters: { invoiceNumber: invoice.invoiceNumber },
  });

  const filename = `invoice-${invoice.invoiceNumber.replace(/^INV-/, "")}`;
  return pdfResponse(buffer, filename, { inline: true });
}
