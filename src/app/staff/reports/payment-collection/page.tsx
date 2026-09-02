import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessPaymentReports } from "@/lib/rbac/permissions";
import { ROLES } from "@/lib/constants/roles";
import {
  getPaymentCollectionReport,
  getPaymentCollectionSummary,
  getUsersWhoProcessedPayments,
  getBookletsForPaymentFilter,
} from "@/features/reports/payment-collection-report.queries";
import { PaymentCollectionReportView } from "@/features/reports/components/PaymentCollectionReportView";
import { formatDate } from "@/lib/utils/date";

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    usageMode?: string;
    processedBy?: string;
    bookletId?: string;
    page?: string;
  }>;
}

/** Format amount as number without currency symbol */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format period label for subtitle */
function formatPeriodLabel(startDate: Date, endDate: Date): string {
  const start = formatDate(startDate, { month: "short", day: "numeric" });
  const end = formatDate(endDate, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

export default async function PaymentCollectionReportPage({
  searchParams,
}: PageProps) {
  const session = await requireSession();

  if (!canAccessPaymentReports(session.role)) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

  // Parse date filters with defaults (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const parsedStartDate = params.startDate ? new Date(params.startDate) : null;
  const startDate =
    parsedStartDate && !isNaN(parsedStartDate.getTime())
      ? parsedStartDate
      : thirtyDaysAgo;
  startDate.setHours(0, 0, 0, 0);

  const parsedEndDate = params.endDate ? new Date(params.endDate) : null;
  const endDate =
    parsedEndDate && !isNaN(parsedEndDate.getTime()) ? parsedEndDate : today;
  endDate.setHours(23, 59, 59, 999);

  const schoolYearId = params.schoolYearId || undefined;
  const paymentMethod = params.paymentMethod || undefined;
  const paymentStatus = params.paymentStatus || undefined;
  const usageMode = params.usageMode || undefined;
  const bookletId = params.bookletId || undefined;
  const page = parseInt(params.page || "1", 10) || 1;

  // Role-based filtering: admin roles can view all, non-admin roles see only their own
  const isAdmin =
    session.role === ROLES.SUPER_ADMIN || session.role === ROLES.ADMIN;
  const processedByUserId = isAdmin
    ? params.processedBy || undefined // Admin: use URL param or all
    : session.userId; // Non-admin: force own ID

  // Fetch data in parallel
  const [reportResult, summary, processedByUsers, booklets] = await Promise.all(
    [
      getPaymentCollectionReport({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
        usageMode,
        processedByUserId,
        bookletId,
        page,
        pageSize: PAGE_SIZE,
      }),
      getPaymentCollectionSummary({
        startDate,
        endDate,
        schoolYearId,
        paymentMethod,
        paymentStatus,
        usageMode,
        processedByUserId,
        bookletId,
      }),
      isAdmin ? getUsersWhoProcessedPayments() : Promise.resolve([]),
      getBookletsForPaymentFilter({ startDate, endDate }),
    ]
  );

  const { rows: payments, totalCount } = reportResult;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header */}
      <div className="space-y-1 no-print">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Payment Collection Report
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatPeriodLabel(startDate, endDate)} • ₱
          {formatAmount(summary.totalAmount)} Total Collected
        </p>
      </div>

      {/* Single Report Card with all controls embedded */}
      <PaymentCollectionReportView
        rows={payments}
        summary={summary}
        totalCount={totalCount}
        totalPages={totalPages}
        currentPage={page}
        pageSize={PAGE_SIZE}
        currentFilters={{
          startDate: params.startDate,
          endDate: params.endDate,
          schoolYearId: params.schoolYearId,
          paymentMethod: params.paymentMethod,
          paymentStatus: params.paymentStatus,
          usageMode: params.usageMode,
          processedBy: params.processedBy,
          bookletId: params.bookletId,
        }}
        isAdmin={isAdmin}
        processedByUsers={processedByUsers}
        booklets={booklets}
        exportPath="/staff/reports/payment-collection/export"
      />

      <p className="text-center text-[0.7rem] text-muted-foreground pb-2 no-print">
        Use Export PDF for printable copy, Export Excel for spreadsheet.
      </p>
    </div>
  );
}
