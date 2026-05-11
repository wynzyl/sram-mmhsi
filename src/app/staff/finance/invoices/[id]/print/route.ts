import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, students } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { generateAssessmentLetterHtml } from "@/lib/email/templates/assessment-letter";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:read")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await params;

  const [invoice] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      amountDue: invoices.amountDue,
      createdAt: invoices.createdAt,
      studentFirstName: students.firstName,
      studentMiddleName: students.middleName,
      studentLastName: students.lastName,
      studentReferenceNumber: students.referenceNumber,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
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

  const html = generateAssessmentLetterHtml({
    invoiceNumber: invoice.invoiceNumber,
    studentName,
    studentReferenceNumber: invoice.studentReferenceNumber,
    amountDue: invoice.amountDue,
    date: new Date(invoice.createdAt),
  });

  // Inject auto-print script before </body>
  const printableHtml = html.replace(
    "</body>",
    `<script>window.onload = function() { window.print(); };</script></body>`
  );

  return new NextResponse(printableHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
