import { db } from "@/lib/db";
import { invoices, students, studentGuardianLinks, parentsGuardians, assessments } from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { eq, and, desc, isNull } from "drizzle-orm";
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
      currentBalance: assessments.balance,
    })
    .from(invoices)
    .innerJoin(students, eq(invoices.studentId, students.id))
    .leftJoin(assessments, eq(invoices.assessmentId, assessments.id))
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

  const [guardianContact] = await db
    .select({ email: parentsGuardians.email })
    .from(studentGuardianLinks)
    .innerJoin(parentsGuardians, eq(studentGuardianLinks.guardianId, parentsGuardians.id))
    .where(
      and(
        eq(studentGuardianLinks.studentId, invoice.studentId),
        isNull(studentGuardianLinks.deletedAt),
      ),
    )
    .orderBy(desc(studentGuardianLinks.isPrimary), studentGuardianLinks.createdAt)
    .limit(1);

  const defaultEmail = guardianContact?.email ?? "";
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
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-7">
        <div className="flex items-center gap-4">
          <Link href={invoicesListPath} className="btn-secondary flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Invoices
          </Link>
          <h1 className="text-xl font-bold text-foreground m-0">
            {invoice.invoiceNumber}
          </h1>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[0.72rem] font-semibold uppercase tracking-wide"
            style={{
              color: status.color,
              background: status.bg,
              border: `1px solid ${status.border}`,
            }}
          >
            {status.label}
          </span>
        </div>
        <div className="flex gap-2">
          <PrintInvoiceButton invoiceId={invoice.id} />
          <SendInvoiceDialog invoiceId={invoice.id} defaultEmail={defaultEmail} />
        </div>
      </div>

      {/* ── INVOICE DOCUMENT ── */}
      <div id="invoice-document" className="bg-card border border-border rounded-lg overflow-hidden shadow-sm max-w-[820px] mx-auto">

        {/* Red accent bar */}
        <div className="h-[5px] bg-[#c70000]" />

        {/* Document body */}
        <div className="p-12">

          {/* LETTERHEAD */}
          <div className="text-center mb-7">
            <div className="text-[1.05rem] font-bold text-[#c70000] tracking-wide uppercase leading-snug">
              Merryland Montesorri and High School Inc.
            </div>
            <div className="text-[0.8rem] text-muted-foreground mt-1">
              San Vicente, Urdaneta, Pangasinan
            </div>
          </div>

          {/* Red rule */}
          <div className="border-b-[1.5px] border-[#c70000] mb-5" />

          {/* INVOICE No. (left) / Date (right) */}
          <div className="flex justify-between items-start mb-6 text-[0.82rem] text-gray-600 dark:text-gray-400">
            <div>
              <span className="text-muted-foreground">Invoice No.&nbsp;</span>
              <strong className="text-foreground tracking-wide">{invoiceDisplay}</strong>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground">Date&nbsp;</span>
              <strong className="text-foreground">{formatDateShort(invoice.createdAt)}</strong>
            </div>
          </div>

          {/* TITLE */}
          <div className="text-center text-[0.9rem] font-bold tracking-widest uppercase text-foreground py-4 border-t border-b border-border mb-7">
            Assessment Invoice
          </div>

          {/* SALUTATION + INTRO */}
          <p className="text-[0.875rem] leading-7 mb-2 text-foreground">
            Dear Parent/Guardian,
          </p>
          <p className="text-[0.875rem] leading-7 mb-6 text-gray-600 dark:text-gray-400">
            This is to inform you that the following student has been assessed for the amount due stated below:
          </p>

          {/* STUDENT DETAILS BOX */}
          <div className="border-l-[3px] border-[#c70000] bg-muted rounded-r-md p-4 pl-5 mb-6">
            <div className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-[0.85rem]">
              <span className="text-muted-foreground font-medium">Student Name</span>
              <span className="text-foreground font-semibold">{studentName}</span>
              <span className="text-muted-foreground font-medium">Student ID</span>
              <span className="text-foreground font-mono text-[0.82rem]">
                {invoice.studentReferenceNumber}
              </span>
              {invoice.assessmentId && (
                <>
                  <span className="text-muted-foreground font-medium">Assessment</span>
                  <Link
                    href={`${assessmentsBasePath}/${invoice.assessmentId}`}
                    className="text-[#c70000] text-[0.82rem] underline"
                  >
                    View Assessment →
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* AMOUNT DUE */}
          <div className="flex flex-col gap-3 mb-7 pb-6 border-b border-dashed border-border">
            <div className="flex items-baseline gap-3">
              <span className="text-[0.85rem] text-muted-foreground font-medium">
                Original Amount Billed
              </span>
              <span className="text-xl font-semibold text-foreground leading-none">
                {formatCurrency(Number(invoice.amountDue))}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[0.85rem] text-muted-foreground font-medium">
                Current Balance
              </span>
              <span
                className="text-[2rem] font-bold leading-none"
                style={{
                  color: invoice.currentBalance && Number(invoice.currentBalance) > 0 ? "#c70000" : "#16a34a",
                }}
              >
                {invoice.currentBalance != null
                  ? formatCurrency(Number(invoice.currentBalance))
                  : formatCurrency(Number(invoice.amountDue))}
              </span>
              {invoice.currentBalance != null && Number(invoice.currentBalance) <= 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.68rem] font-semibold uppercase tracking-wide text-green-600 bg-green-600/10 border border-green-600/30">
                  Fully Paid
                </span>
              )}
            </div>
          </div>

          {/* PAYMENT INSTRUCTION */}
          <p className="text-[0.875rem] leading-7 mb-5 text-gray-600 dark:text-gray-400">
            Please settle the above amount at the cashier&#39;s office. Kindly present this assessment
            invoice upon payment for proper verification and issuance of official receipt.
          </p>

          <p className="text-[0.875rem] leading-7 mb-8 text-gray-600 dark:text-gray-400">
            Thank you.
          </p>

          {/* SIGNATURE */}
          <div className="text-[0.875rem] leading-relaxed text-foreground">
            Respectfully,<br />
            <br />
            <strong>Merryland Montesorri</strong><br />
            <span className="text-muted-foreground text-[0.8rem]">
              Accounting / Cashier Department
            </span>
          </div>
        </div>

        {/* FOOTER STRIP — timeline + meta */}
        <div className="no-print border-t border-border bg-muted px-14 py-5 flex justify-between items-center flex-wrap gap-4">
          {/* Timeline dots */}
          <div className="flex items-center gap-0">
            {timeline.map((step, i) => (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[0.7rem] font-bold shrink-0"
                    style={{
                      background: step.done ? "#c70000" : "var(--border)",
                      color: step.done ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    {step.done ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (i + 1)}
                  </div>
                  <div className="text-center">
                    <div
                      className="text-[0.68rem] font-semibold uppercase tracking-wide"
                      style={{ color: step.done ? "var(--foreground)" : "var(--muted-foreground)" }}
                    >
                      {step.label}
                    </div>
                    {step.date && (
                      <div className="text-[0.65rem] text-muted-foreground mt-px whitespace-nowrap">
                        {formatDate(step.date)}
                      </div>
                    )}
                  </div>
                </div>
                {i < timeline.length - 1 && (
                  <div
                    className="w-12 h-0.5 mx-1.5 shrink-0"
                    style={{
                      background: timeline[i + 1].done ? "#c70000" : "var(--border)",
                      marginBottom: "24px",
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="text-[0.72rem] text-gray-400 text-right">
            SRAMS · Official Assessment Invoice
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-1 bg-[#c70000]" />
      </div>
    </div>
  );
}
