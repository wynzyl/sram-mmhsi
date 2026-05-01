import { Metadata } from "next";
import { db } from "@/lib/db";
import { invoices, students } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import InvoiceListTable from "@/components/finance/invoices/InvoiceListTable";
import { desc, eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Invoices | SRAMS",
};

export default async function InvoicesPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:read")) {
    redirect("/admin/dashboard");
  }

  const rawInvoices = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      amountDue: invoices.amountDue,
      status: invoices.status,
      dueDate: invoices.dueDate,
      createdAt: invoices.createdAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .orderBy(desc(invoices.createdAt));

  const formattedInvoices = rawInvoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    studentName: `${inv.studentFirstName} ${inv.studentLastName}`,
    amountDue: Number(inv.amountDue),
    status: inv.status,
    dueDate: inv.dueDate,
    createdAt: inv.createdAt,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
        <p className="page-description">
          Manage and send invoices for student assessments.
        </p>
      </div>

      <div className="content-card">
        <InvoiceListTable invoices={formattedInvoices} />
      </div>
    </div>
  );
}
