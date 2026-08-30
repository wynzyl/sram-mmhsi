import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { canAccessFinanceReports } from "@/lib/rbac/permissions";
import { getSchoolYears, getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import {
  getAccountsReceivableReport,
  getAccountsReceivableSummary,
} from "@/features/reports/accounts-receivable-report.queries";
import { AccountsReceivableView } from "@/features/reports/components/AccountsReceivableView";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    page?: string;
  }>;
}

export default async function AccountsReceivableReportPage({
  searchParams,
}: PageProps) {
  const session = await requireSession();

  if (!canAccessFinanceReports(session.role)) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;
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
