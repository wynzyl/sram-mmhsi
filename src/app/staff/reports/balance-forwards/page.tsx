import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import {
  getBfxTransfersReport,
  getBfxSummary,
  getSchoolYearsForBfxReport,
} from "@/features/reports";
import { BfxReportView } from "@/features/reports/components/BfxReportView";
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

  // Format period for display
  const periodLabel = `${formatDate(startDate, { month: "short", day: "numeric" })} - ${formatDate(endDate, { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Balance Forward Transfers
        </h1>
        <p className="text-sm text-muted-foreground">
          BFX receipts showing balance transfers from prior school years
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="bfx-heading"
      >
        {/* Filters + Table + Pagination - Combined View */}
        <BfxReportView
          data={transfers}
          schoolYears={schoolYears}
          defaults={{
            startDate: params.startDate,
            endDate: params.endDate,
            schoolYearId: params.schoolYearId,
          }}
          pagination={{
            currentPage: page,
            totalPages,
            totalCount,
            pageSize: 50,
          }}
          headerContent={
            <>
              <h2
                id="bfx-heading"
                className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
              >
                Transfer Report
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
                {summary.totalTransfers} Transfer{summary.totalTransfers !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                <CurrencyDisplay amount={summary.totalAmount} />
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {periodLabel}
              </span>
            </>
          }
        />
      </section>
    </div>
  );
}
