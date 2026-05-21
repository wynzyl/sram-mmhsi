import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import {
  getBfxTransfersReport,
  getBfxSummary,
  getSchoolYearsForBfxReport,
} from "@/features/reports";
import { BfxReportFilters } from "@/features/reports/components/BfxReportFilters";
import { BfxReportTable } from "@/features/reports/components/BfxReportTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

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

  // Permission check - finance_officer, admin, or super_admin
  if (!hasPermission(session.role, "reports:view")) {
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
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">
          Balance Forward Transfers
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          BFX receipts showing balance transfers from prior school years
        </p>
      </div>

      {/* Filters */}
      <BfxReportFilters
        schoolYears={schoolYears}
        defaultStartDate={params.startDate}
        defaultEndDate={params.endDate}
        defaultSchoolYearId={params.schoolYearId}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-text-muted)]">
            Total Transfers
          </p>
          <p className="text-2xl font-semibold text-[var(--color-text)] mt-1">
            {summary.totalTransfers}
          </p>
        </div>
        <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-text-muted)]">Total Amount</p>
          <p className="text-2xl font-semibold text-[var(--color-text)] mt-1">
            <CurrencyDisplay amount={summary.totalAmount} />
          </p>
        </div>
        <div className="p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <p className="text-sm text-[var(--color-text-muted)]">Period</p>
          <p className="text-sm font-medium text-[var(--color-text)] mt-1">
            {startDate.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}{" "}
            -{" "}
            {endDate.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Data Table */}
      {transfers.length === 0 ? (
        <div className="p-8 text-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
          <p className="text-[var(--color-text-muted)]">
            No balance forward transfers found for the selected period.
          </p>
        </div>
      ) : (
        <>
          <BfxReportTable data={transfers} />
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
              <p className="text-sm text-[var(--color-text-muted)]">
                Showing {(page - 1) * 50 + 1} - {Math.min(page * 50, totalCount)} of {totalCount} transfers
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={`?startDate=${params.startDate || ""}&endDate=${params.endDate || ""}&schoolYearId=${params.schoolYearId || ""}&page=${page - 1}`}
                    className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-2)]"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?startDate=${params.startDate || ""}&endDate=${params.endDate || ""}&schoolYearId=${params.schoolYearId || ""}&page=${page + 1}`}
                    className="px-3 py-1 text-sm border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-2)]"
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
