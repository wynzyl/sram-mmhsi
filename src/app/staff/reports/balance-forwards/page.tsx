import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import {
  getBfxTransfersReport,
  getBfxSummary,
  getSchoolYearsForBfxReport,
} from "@/features/reports";
import { BfxReportTable } from "@/features/reports/components/BfxReportTable";
import { ReportFilters } from "@/components/shared/ReportFilters";
import { ReportExportActions } from "@/components/shared/ReportExportActions";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
    page?: string;
  }>;
}

export default async function BalanceForwardsReportPage({
  searchParams,
}: PageProps) {
  const session = await requireSession();

  if (!canAccessFinanceReports(session.role)) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

  // Parse date filters with defaults (last 30 days)
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const parsedStartDate = params.startDate
    ? new Date(params.startDate)
    : null;
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
  const page = parseInt(params.page || "1", 10) || 1;

  // Fetch data
  const [transfersResult, summary, schoolYears] = await Promise.all([
    getBfxTransfersReport({ startDate, endDate, schoolYearId, page, pageSize: 50 }),
    getBfxSummary({ startDate, endDate, schoolYearId }),
    getSchoolYearsForBfxReport(),
  ]);

  const { rows: transfers, totalCount } = transfersResult;
  const totalPages = Math.ceil(totalCount / 50);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Balance Forward Transfers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            BFX receipts showing balance transfers from prior school years
          </p>
        </div>
        <ReportExportActions
          exportPath="/staff/reports/balance-forwards/export"
          filters={{
            startDate: params.startDate,
            endDate: params.endDate,
            schoolYearId: params.schoolYearId,
          }}
        />
      </div>

      {/* Filters */}
      <ReportFilters
        basePath="/staff/reports/balance-forwards"
        config={{
          dateRange: true,
          schoolYears: schoolYears,
          schoolYearLabel: "Source School Year",
        }}
        defaults={{
          startDate: params.startDate,
          endDate: params.endDate,
          schoolYearId: params.schoolYearId,
        }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">
            Total Transfers
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {summary.totalTransfers}
          </p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">Total Amount</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            <CurrencyDisplay amount={summary.totalAmount} />
          </p>
        </div>
        <div className="p-4 bg-card border border-border rounded-lg">
          <p className="text-sm text-muted-foreground">Period</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {formatDate(startDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            -{" "}
            {formatDate(endDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Data Table */}
      {transfers.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">
            No balance forward transfers found for the selected period.
          </p>
        </div>
      ) : (
        <>
          <BfxReportTable data={transfers} />
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 50 + 1} - {Math.min(page * 50, totalCount)} of {totalCount} transfers
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?startDate=${params.startDate || ""}&endDate=${params.endDate || ""}&schoolYearId=${params.schoolYearId || ""}&page=${page - 1}`}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?startDate=${params.startDate || ""}&endDate=${params.endDate || ""}&schoolYearId=${params.schoolYearId || ""}&page=${page + 1}`}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
