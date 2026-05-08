import { db } from "@/lib/db";
import { invoices, students, studentGuardianLinks, parentsGuardians } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import SendInvoiceDialog from "@/components/finance/invoices/SendInvoiceDialog";

type InvoiceDetailRoute = "/staff/finance/invoices";
type AssessmentsBase = "/staff/assessments";

export async function InternalInvoiceDetailPage(props: {
  invoiceId: string;
  invoicesListPath: InvoiceDetailRoute;
  deniedRedirect: string;
  assessmentsBasePath: AssessmentsBase;
}) {
  const { invoiceId, invoicesListPath, deniedRedirect, assessmentsBasePath } = props;
  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:read")) {
    redirect(deniedRedirect);
  }

  const [invoice] = await db
    .select({
      id: invoices.id,
      studentId: invoices.studentId,
      assessmentId: invoices.assessmentId,
      invoiceNumber: invoices.invoiceNumber,
      amountDue: invoices.amountDue,
      status: invoices.status,
      createdAt: invoices.createdAt,
      sentAt: invoices.sentAt,
      settledAt: invoices.settledAt,
      studentFirstName: students.firstName,
      studentLastName: students.lastName,
      studentReferenceNumber: students.referenceNumber,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">Invoice Not Found</h1>
        </div>
        <div className="content-card">
          <p>The invoice you are looking for does not exist.</p>
          <Link href={invoicesListPath} className="btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  const [primaryGuardianLink] = await db
    .select({ email: parentsGuardians.email })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(and(eq(studentGuardianLinks.studentId, invoice.studentId), eq(studentGuardianLinks.isPrimary, true)))
    .limit(1);

  const defaultEmail = primaryGuardianLink?.email || "";

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-title">{invoice.invoiceNumber}</h1>
          <p className="page-description">
            Status: <span style={{ fontWeight: "bold" }}>{invoice.status.toUpperCase()}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <Link href={invoicesListPath} className="btn-secondary">
            Back to List
          </Link>
          <SendInvoiceDialog invoiceId={invoice.id} defaultEmail={defaultEmail} />
        </div>
      </div>

      <div className="content-card">
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">Student Name</span>
            <span className="detail-value">
              {invoice.studentFirstName} {invoice.studentLastName}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Student Reference</span>
            <span className="detail-value">{invoice.studentReferenceNumber}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Amount Due</span>
            <span className="detail-value" style={{ fontWeight: 600, fontSize: "1.25rem" }}>
              ₱{Number(invoice.amountDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Linked Assessment</span>
            <span className="detail-value">
              {invoice.assessmentId ? (
                <Link href={`${assessmentsBasePath}/${invoice.assessmentId}`} className="table-action-link">
                  View Assessment
                </Link>
              ) : (
                "None"
              )}
            </span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Created At</span>
            <span className="detail-value">{new Date(invoice.createdAt).toLocaleString()}</span>
          </div>
          {invoice.sentAt && (
            <div className="detail-item">
              <span className="detail-label">Sent At</span>
              <span className="detail-value">{new Date(invoice.sentAt).toLocaleString()}</span>
            </div>
          )}
          {invoice.settledAt && (
            <div className="detail-item">
              <span className="detail-label">Settled At</span>
              <span className="detail-value">{new Date(invoice.settledAt).toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
