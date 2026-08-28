import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import {
  getInvoiceTabCounts,
  getInvoicesByTab,
  type InvoiceTabKey,
} from "@/features/finance/invoices/invoices.queries";
import InvoiceQueueHeader from "@/features/finance/components/invoices/InvoiceQueueHeader";
import InvoiceQueueTabs from "@/features/finance/components/invoices/InvoiceQueueTabs";
import InvoiceQueueTable from "@/features/finance/components/invoices/InvoiceQueueTable";
import type { PaginationParams } from "@/lib/types/pagination";

type InvoiceListRoute = "/staff/finance/invoices";

type InvoicesIndexPageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    gradeLevel?: string;
    page?: string;
    pageSize?: string;
  }>;
  invoicesListPath: InvoiceListRoute;
  deniedRedirect: string;
};

/**
 * Get the current tab from search params
 */
function getCurrentTabFromParams(tab: string | undefined): InvoiceTabKey {
  if (tab === "draft" || tab === "sent" || tab === "viewed" || tab === "overdue") {
    return tab;
  }
  return "draft"; // default
}

export async function InternalInvoicesListPage(props: InvoicesIndexPageProps) {
  const { searchParams, invoicesListPath, deniedRedirect } = props;

  const session = await requireSession();
  if (!hasPermission(session.role, "invoices:read")) {
    redirect(deniedRedirect);
  }

  const params = await searchParams;
  const currentTab = getCurrentTabFromParams(params.tab);
  const searchQuery = params.search || "";
  const gradeLevelFilter = params.gradeLevel || "";

  // Parse pagination params with defaults
  const page = parseInt(params.page || "1", 10);
  const pageSize = parseInt(params.pageSize || "25", 10);

  const paginationParams: PaginationParams = {
    page: Math.max(1, page),
    pageSize: Math.min(Math.max(10, pageSize), 100),
  };

  // Permissions
  const canSend = hasPermission(session.role, "invoices:send");

  // Fetch active school year
  const activeSchoolYear = await getActiveSchoolYear();

  if (!activeSchoolYear) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">No Active School Year</h2>
          <p className="mt-2 text-sm text-amber-800">
            An active school year must be configured before you can manage invoices. Please contact your
            system administrator or activate a school year in the system settings.
          </p>
        </div>
      </div>
    );
  }

  // Build query filters
  const queryFilters = {
    search: searchQuery || undefined,
    gradeLevelId: gradeLevelFilter && gradeLevelFilter !== "all" ? gradeLevelFilter : undefined,
  };

  // Fetch data in parallel
  const [invoiceData, tabCounts, gradeLevelsData] = await Promise.all([
    getInvoicesByTab(currentTab, activeSchoolYear.id, paginationParams, queryFilters),
    getInvoiceTabCounts(activeSchoolYear.id),
    getGradeLevels(),
  ]);

  // Map grade levels for dropdown
  const allGradeLevels = gradeLevelsData.map((gl) => ({ id: gl.id, name: gl.name }));

  /**
   * Get total count for the current tab
   */
  function getCurrentTabCount(tab: InvoiceTabKey): number {
    return tabCounts[tab];
  }

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Invoices
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeSchoolYear.label} • {getCurrentTabCount(currentTab).toLocaleString()} Invoice{getCurrentTabCount(currentTab) !== 1 ? "s" : ""} in this tab
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header - Inline Controls */}
        <InvoiceQueueHeader
          basePath={invoicesListPath}
          gradeLevels={allGradeLevels}
          totalCount={getCurrentTabCount(currentTab)}
          canSend={canSend}
        />

        {/* Tabs Navigation - Inside Card */}
        <InvoiceQueueTabs
          counts={tabCounts}
          currentTab={currentTab}
          basePath={invoicesListPath}
        />

        {/* Tab Content */}
        <InvoiceQueueTable
          paginatedData={invoiceData}
          basePath={invoicesListPath}
          searchQuery={searchQuery}
          gradeLevelFilter={gradeLevelFilter}
        />
      </section>

      {/* Footer Note */}
      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Need to generate invoices?{" "}
        <Link
          href={`${invoicesListPath}/batch`}
          className="font-medium text-primary hover:underline"
        >
          Batch generate invoices
        </Link>
        . Confidential institutional data.
      </p>
    </div>
  );
}
