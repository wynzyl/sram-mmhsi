import { db } from "@/lib/db";
import { invoices, students, studentGuardianLinks, parentsGuardians } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import SendInvoiceDialog from "@/features/finance/components/invoices/SendInvoiceDialog";
import PrintInvoiceButton from "@/features/finance/components/invoices/PrintInvoiceButton";
import { formatCurrency } from "@/lib/utils/currency";

type InvoiceDetailRoute = "/staff/finance/invoices";
type AssessmentsBase = "/staff/assessments";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  draft:    { label: "Draft",    color: "#8a98bc", bg: "rgba(138,152,188,0.12)", border: "rgba(138,152,188,0.3)" },
  sent:     { label: "Sent",     color: "#1d4ed8", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)"  },
  viewed:   { label: "Viewed",   color: "#d97706", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)"  },
  settled:  { label: "Settled",  color: "#16a34a", bg: "rgba(22,163,74,0.12)",  border: "rgba(22,163,74,0.3)"   },
  overdue:  { label: "Overdue",  color: "#c70000", bg: "rgba(199,0,0,0.10)",    border: "rgba(199,0,0,0.3)"     },
};

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

function formatDateShort(d: Date | string | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(d));
}

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
      studentMiddleName: students.middleName,
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
  const status = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft;
  const invoiceDisplay = invoice.invoiceNumber.replace(/^INV-/, "");
  const studentName = [invoice.studentFirstName, invoice.studentMiddleName, invoice.studentLastName]
    .filter(Boolean)
    .join(" ");

  const timeline = [
    { label: "Created",  date: invoice.createdAt, done: true },
    { label: "Sent",     date: invoice.sentAt,    done: !!invoice.sentAt },
    { label: "Settled",  date: invoice.settledAt, done: !!invoice.settledAt },
  ];

  return (
    <div className="page-container">

      {/* ── TOP BAR ── */}
      <div className="no-print" style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1.75rem",
        flexWrap: "wrap",
        gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href={invoicesListPath} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Invoices
          </Link>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
            {invoice.invoiceNumber}
          </h1>
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 10px",
            borderRadius: "999px",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: status.color,
            background: status.bg,
            border: `1px solid ${status.border}`,
          }}>
            {status.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <PrintInvoiceButton invoiceId={invoice.id} />
          <SendInvoiceDialog invoiceId={invoice.id} defaultEmail={defaultEmail} />
        </div>
      </div>

      {/* ── INVOICE DOCUMENT ── */}
      <div id="invoice-document" style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)",
        maxWidth: "820px",
        margin: "0 auto",
      }}>

        {/* Red accent bar */}
        <div style={{ height: "5px", background: "#c70000" }} />

        {/* Document body */}
        <div style={{ padding: "3rem 3.5rem" }}>

          {/* LETTERHEAD */}
          <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
            <div style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#c70000",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              lineHeight: 1.35,
            }}>
              Merryland Montesorri and High School Inc.
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)", marginTop: "4px" }}>
              San Vicente, Urdaneta, Pangasinan
            </div>
          </div>

          {/* Red rule */}
          <div style={{ borderBottom: "1.5px solid #c70000", marginBottom: "1.25rem" }} />

          {/* INVOICE No. (left) / Date (right) */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "1.5rem",
            fontSize: "0.82rem",
            color: "var(--color-text-2)",
          }}>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Invoice No.&nbsp;</span>
              <strong style={{ color: "var(--color-text)", letterSpacing: "0.02em" }}>{invoiceDisplay}</strong>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ color: "var(--color-text-muted)" }}>Date&nbsp;</span>
              <strong style={{ color: "var(--color-text)" }}>{formatDateShort(invoice.createdAt)}</strong>
            </div>
          </div>

          {/* TITLE */}
          <div style={{
            textAlign: "center",
            fontSize: "0.9rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--color-text)",
            padding: "1rem 0",
            borderTop: "1px solid var(--color-border)",
            borderBottom: "1px solid var(--color-border)",
            marginBottom: "1.75rem",
          }}>
            Assessment Invoice
          </div>

          {/* SALUTATION + INTRO */}
          <p style={{ fontSize: "0.875rem", lineHeight: 1.75, marginBottom: "0.5rem", color: "var(--color-text)" }}>
            Dear Parent/Guardian,
          </p>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.75, marginBottom: "1.5rem", color: "var(--color-text-2)" }}>
            This is to inform you that the following student has been assessed for the amount due stated below:
          </p>

          {/* STUDENT DETAILS BOX */}
          <div style={{
            borderLeft: "3px solid #c70000",
            background: "var(--color-surface-2)",
            borderRadius: "0 0.375rem 0.375rem 0",
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "max-content 1fr",
              columnGap: "1.5rem",
              rowGap: "0.4rem",
              fontSize: "0.85rem",
            }}>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>Student Name</span>
              <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{studentName}</span>
              <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>Reference No.</span>
              <span style={{ color: "var(--color-text)", fontFamily: "var(--font-ibm-mono, monospace)", fontSize: "0.82rem" }}>
                {invoice.studentReferenceNumber}
              </span>
              {invoice.assessmentId && (
                <>
                  <span style={{ color: "var(--color-text-muted)", fontWeight: 500 }}>Assessment</span>
                  <Link
                    href={`${assessmentsBasePath}/${invoice.assessmentId}`}
                    style={{ color: "#c70000", fontSize: "0.82rem", textDecoration: "underline" }}
                  >
                    View Assessment →
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* AMOUNT DUE */}
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: "0.75rem",
            marginBottom: "1.75rem",
            paddingBottom: "1.5rem",
            borderBottom: "1px dashed var(--color-border)",
          }}>
            <span style={{ fontSize: "0.85rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
              Amount Due
            </span>
            <span style={{ fontSize: "2rem", fontWeight: 700, color: "#c70000", lineHeight: 1 }}>
              {formatCurrency(Number(invoice.amountDue))}
            </span>
          </div>

          {/* PAYMENT INSTRUCTION */}
          <p style={{ fontSize: "0.875rem", lineHeight: 1.75, marginBottom: "1.25rem", color: "var(--color-text-2)" }}>
            Please settle the above amount at the cashier&#39;s office. Kindly present this assessment
            invoice upon payment for proper verification and issuance of official receipt.
          </p>

          <p style={{ fontSize: "0.875rem", lineHeight: 1.75, marginBottom: "2rem", color: "var(--color-text-2)" }}>
            Thank you.
          </p>

          {/* SIGNATURE */}
          <div style={{ fontSize: "0.875rem", lineHeight: 1.8, color: "var(--color-text)" }}>
            Respectfully,<br />
            <br />
            <strong>Merryland Montesorri</strong><br />
            <span style={{ color: "var(--color-text-muted)", fontSize: "0.8rem" }}>
              Accounting / Cashier Department
            </span>
          </div>
        </div>

        {/* FOOTER STRIP — timeline + meta */}
        <div className="no-print" style={{
          borderTop: "1px solid var(--color-border)",
          background: "var(--color-surface-2)",
          padding: "1.25rem 3.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          {/* Timeline dots */}
          <div style={{ display: "flex", alignItems: "center", gap: "0" }}>
            {timeline.map((step, i) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: step.done ? "#c70000" : "var(--color-border)",
                    color: step.done ? "#fff" : "var(--color-text-subtle)",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {step.done ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (i + 1)}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, color: step.done ? "var(--color-text)" : "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {step.label}
                    </div>
                    {step.date && (
                      <div style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", marginTop: "1px", whiteSpace: "nowrap" }}>
                        {formatDate(step.date)}
                      </div>
                    )}
                  </div>
                </div>
                {i < timeline.length - 1 && (
                  <div style={{
                    width: "48px",
                    height: "2px",
                    background: timeline[i + 1].done ? "#c70000" : "var(--color-border)",
                    margin: "0 6px",
                    marginBottom: "24px",
                    flexShrink: 0,
                  }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: "0.72rem", color: "var(--color-text-subtle)", textAlign: "right" }}>
            SRAMS · Official Assessment Invoice
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{ height: "4px", background: "#c70000" }} />
      </div>
    </div>
  );
}
