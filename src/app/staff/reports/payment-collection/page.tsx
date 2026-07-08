import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessPaymentReports } from "@/lib/rbac/permissions";
import {
  getPaymentCollectionReport,
  getPaymentCollectionSummary,
  getSchoolYearsForPaymentReport,
} from "@/features/reports/payment-collection-report.queries";
import { PaymentCollectionFilters } from "@/features/reports/components/PaymentCollectionFilters";
import { PaymentCollectionReportPreview } from "@/features/reports/components/PaymentCollectionReportPreview";
import { PaymentCollectionReportActions } from "@/features/reports/components/PaymentCollectionReportActions";
import { TablePagination } from "@/components/ui/TablePagination";

const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    page?: string;
  }>;
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
  const page = parseInt(params.page || "1", 10) || 1;

  // Fetch data in parallel
  const [reportResult, summary, schoolYears] = await Promise.all([
    getPaymentCollectionReport({
      startDate,
      endDate,
      schoolYearId,
      paymentMethod,
      paymentStatus,
      page,
      pageSize: PAGE_SIZE,
    }),
    getPaymentCollectionSummary({
      startDate,
      endDate,
      schoolYearId,
      paymentMethod,
      paymentStatus,
    }),
    getSchoolYearsForPaymentReport(),
  ]);

  const { rows: payments, totalCount } = reportResult;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Build base URL for pagination (preserving current filters)
  const buildPaginationBaseUrl = () => {
    const urlParams = new URLSearchParams();
    if (params.startDate) urlParams.set("startDate", params.startDate);
    if (params.endDate) urlParams.set("endDate", params.endDate);
    if (params.schoolYearId) urlParams.set("schoolYearId", params.schoolYearId);
    if (params.paymentMethod) urlParams.set("paymentMethod", params.paymentMethod);
    if (params.paymentStatus) urlParams.set("paymentStatus", params.paymentStatus);
    const queryString = urlParams.toString();
    return queryString ? `?${queryString}` : "";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Payment Collection Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate and print payment collection reports
          </p>
        </div>
        <PaymentCollectionReportActions
          startDate={params.startDate || ""}
          endDate={params.endDate || ""}
          schoolYearId={params.schoolYearId}
          paymentMethod={params.paymentMethod}
          paymentStatus={params.paymentStatus}
        />
      </div>

      {/* Filters */}
      <div className="no-print">
        <PaymentCollectionFilters
          schoolYears={schoolYears}
          defaultStartDate={params.startDate}
          defaultEndDate={params.endDate}
          defaultSchoolYearId={params.schoolYearId}
          defaultPaymentMethod={params.paymentMethod}
          defaultPaymentStatus={params.paymentStatus}
        />
      </div>

      {/* Report Preview */}
      <PaymentCollectionReportPreview rows={payments} summary={summary} />

      {/* Pagination */}
      <div className="no-print">
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          totalRecords={totalCount}
          pageSize={PAGE_SIZE}
          baseUrl={`/staff/reports/payment-collection${buildPaginationBaseUrl()}`}
          itemLabel="payments"
        />
      </div>

      {/* Export note */}
      <p className="text-xs text-muted-foreground text-center no-print">
        Use Export PDF for an official printable copy, or Export Excel for a
        spreadsheet you can sort and total.
      </p>
    </div>
  );
}
