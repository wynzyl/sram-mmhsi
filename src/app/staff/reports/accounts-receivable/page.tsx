import { Suspense } from "react";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolYears, getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import {
  getAccountsReceivableReport,
  getAccountsReceivableSummary,
} from "@/features/reports/accounts-receivable-report.queries";
import { AccountsReceivableView } from "@/features/reports/components/AccountsReceivableView";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

// Instant navigation enabled - uses Suspense for streaming

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    page?: string;
  }>;
}

/**
 * Instant navigation - full A/R report skeleton shown while data loads.
 */
export default function AccountsReceivableReportPage({
  searchParams,
}: PageProps) {
  return (
    <Suspense fallback={<AccountsReceivableSkeleton />}>
      <AccountsReceivableContent searchParams={searchParams} />
    </Suspense>
  );
}

function AccountsReceivableSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function AccountsReceivableContent({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (!canAccessFinanceReports(session.role)) {
    redirect("/staff/dashboard");
  }
  // Fetch active school year ID for default selection
  const activeSchoolYearId = await getActiveSchoolYearId();
  // Default to active school year if no filter specified
  const schoolYearId = params.schoolYearId ?? activeSchoolYearId ?? undefined;
  const page = parseInt(params.page || "1", 10) || 1;

  const [reportResult, summary, schoolYears] = await Promise.all([
    getAccountsReceivableReport({ schoolYearId, page, pageSize: PAGE_SIZE }),
    getAccountsReceivableSummary({ schoolYearId }),
    getSchoolYears(),
  ]);

  const { rows, totalCount } = reportResult;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const schoolYearLabel = schoolYearId
    ? schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—"
    : "All School Years";

  const buildPaginationBaseUrl = () => {
    const urlParams = new URLSearchParams();
    if (schoolYearId) urlParams.set("schoolYearId", schoolYearId);
    const queryString = urlParams.toString();
    return queryString ? `?${queryString}` : "";
  };

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Accounts Receivable
        </h1>
        <p className="text-sm text-muted-foreground">
          Outstanding student balances for {schoolYearLabel}
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="ar-heading"
      >
        {/* Filters + Table + Pagination - Combined View */}
        <AccountsReceivableView
          data={rows}
          schoolYears={schoolYears}
          defaultSchoolYearId={schoolYearId}
          pagination={{
            currentPage: page,
            totalPages,
            totalCount,
            pageSize: PAGE_SIZE,
            baseUrl: `/staff/reports/accounts-receivable${buildPaginationBaseUrl()}`,
          }}
          headerContent={
            <>
              <h2
                id="ar-heading"
                className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
              >
                Outstanding Balances
              </h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
                {summary.totalAccounts.toLocaleString()} Account{summary.totalAccounts !== 1 ? "s" : ""}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">
                <CurrencyDisplay amount={summary.totalOutstanding} />
              </span>
            </>
          }
        />
      </section>

      <p className="text-xs text-muted-foreground text-center no-print">
        Export PDF for an official printable copy, or Export Excel for a spreadsheet you can sort and total.
      </p>
    </div>
  );
}
