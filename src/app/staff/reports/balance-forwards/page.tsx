import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getBfxTransfersReport,
  getBfxSummary,
  getSchoolYearsForBfxReport,
} from "@/features/reports";
import { BfxReportView } from "@/features/reports/components/BfxReportView";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
    page?: string;
  }>;
}

/**
 * Instant navigation - full BFX report skeleton shown while data loads.
 */
export default function BalanceForwardsReportPage({
  searchParams,
}: PageProps) {
  return (
    <Suspense fallback={<BalanceForwardsSkeleton />}>
      <BalanceForwardsContent searchParams={searchParams} />
    </Suspense>
  );
}

function BalanceForwardsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function BalanceForwardsContent({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (!canAccessFinanceReports(session.role)) {
    redirect("/staff/dashboard");
  }

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

  // Note: BFX report filters by SOURCE school year (where balance came from).
  // Don't default to active year - transfers come FROM prior years, not current.
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
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
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
            schoolYearId,
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
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info/10 text-info border border-info/30">
                {periodLabel}
              </span>
            </>
          }
        />
      </section>
    </div>
  );
}
