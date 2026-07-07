import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAccountsReceivableReport,
  getAccountsReceivableSummary,
} from "@/features/reports/accounts-receivable-report.queries";
import { AccountsReceivableFilters } from "@/features/reports/components/AccountsReceivableFilters";
import { AccountsReceivableTable } from "@/features/reports/components/AccountsReceivableTable";
import { AccountsReceivableReportActions } from "@/features/reports/components/AccountsReceivableReportActions";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { TablePagination } from "@/components/ui/TablePagination";

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

  // Only super_admin, admin, and finance_officer can access finance reports
  const FINANCE_REPORT_ROLES: readonly string[] = ["super_admin", "admin", "finance_officer"];
  if (!FINANCE_REPORT_ROLES.includes(session.role)) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;
  const schoolYearId = params.schoolYearId || undefined;
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Accounts Receivable Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outstanding student balances for {schoolYearLabel}
          </p>
        </div>
        <AccountsReceivableReportActions schoolYearId={schoolYearId} />
      </div>

      {/* Filters */}
      <div className="no-print">
        <AccountsReceivableFilters
          schoolYears={schoolYears.map((sy) => ({ id: sy.id, label: sy.label }))}
          defaultSchoolYearId={schoolYearId}
        />
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Total Accounts
          </p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {summary.totalAccounts.toLocaleString()}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Total Outstanding
          </p>
          <CurrencyDisplay
            amount={summary.totalOutstanding}
            className="text-2xl font-bold text-primary mt-1 block"
          />
        </div>
      </div>

      {/* Preview */}
      {rows.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">
            No outstanding balances found for the selected filters.
          </p>
        </div>
      ) : (
        <>
          <AccountsReceivableTable data={rows} />
          <div className="no-print">
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalRecords={totalCount}
              pageSize={PAGE_SIZE}
              baseUrl={`/staff/reports/accounts-receivable${buildPaginationBaseUrl()}`}
              itemLabel="accounts"
            />
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground text-center no-print">
        Export PDF for an official printable copy, or Export Excel for a
        spreadsheet you can sort and total.
      </p>
    </div>
  );
}
