import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import {
  getPendingDiscountRequests,
  getDiscountRequestCounts,
  getApprovedUnappliedDiscountRequests,
  getDiscountRequestsHistory,
} from "@/features/discounts";
import DiscountRequestsTable from "@/features/discounts/components/DiscountRequestsTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/TablePagination";

type TabType = "pending" | "approved" | "rejected";

function isValidTab(tab: string | undefined): tab is TabType {
  return tab === "pending" || tab === "approved" || tab === "rejected";
}

/**
 * Discount Requests queue — extracted verbatim from the former
 * `/staff/finance/discount-requests` page so it can render as the "Discount"
 * section of the Approvals hub. Only the inner tab links were repointed to
 * `/staff/approvals?section=discount`.
 */
export default async function DiscountRequestsView({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    schoolYearId?: string;
    gradeLevelId?: string;
    search?: string;
  }>;
}) {
  const session = await requireSession();

  if (!hasPermission(session.role, "discounts:review")) {
    redirect("/staff/finance");
  }

  const params = await searchParams;
  const activeSchoolYearId = await getActiveSchoolYearId();
  const tab: TabType = isValidTab(params.tab) ? params.tab : "pending";
  const pageNumber = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const counts = await getDiscountRequestCounts(activeSchoolYearId ?? undefined);

  let pendingResult: Awaited<ReturnType<typeof getPendingDiscountRequests>> | null = null;
  let approvedResult: Awaited<ReturnType<typeof getDiscountRequestsHistory>> | null = null;
  let rejectedResult: Awaited<ReturnType<typeof getDiscountRequestsHistory>> | null = null;
  let approvedUnapplied: Awaited<ReturnType<typeof getApprovedUnappliedDiscountRequests>> = [];

  if (tab === "pending") {
    [pendingResult, approvedUnapplied] = await Promise.all([
      getPendingDiscountRequests({
        page: pageNumber,
        pageSize: 20,
        schoolYearId: activeSchoolYearId ?? params.schoolYearId,
        gradeLevelId: params.gradeLevelId,
        searchQuery: params.search,
      }),
      getApprovedUnappliedDiscountRequests(),
    ]);
  } else if (tab === "approved") {
    approvedResult = await getDiscountRequestsHistory({
      page: pageNumber,
      pageSize: 20,
      status: "approved",
      schoolYearId: activeSchoolYearId ?? params.schoolYearId,
    });
  } else if (tab === "rejected") {
    rejectedResult = await getDiscountRequestsHistory({
      page: pageNumber,
      pageSize: 20,
      status: "rejected",
      schoolYearId: activeSchoolYearId ?? params.schoolYearId,
    });
  }

  const tabClass = (isActive: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
      isActive
        ? "border-primary text-primary"
        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Discount Requests</h2>
        <p className="text-sm text-muted-foreground">
          Review and approve discount requests from registrars
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={counts.pending > 0 ? "border-amber-500" : ""}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{counts.pending}</div>
            <p className="text-xs text-muted-foreground">Pending Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{counts.approved}</div>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{counts.rejected}</div>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <nav className="flex gap-1 border-b border-border" aria-label="Discount request tabs">
          <Link href="/staff/approvals?section=discount&tab=pending" className={tabClass(tab === "pending")}>
            Pending
            {counts.pending > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800">
                {counts.pending}
              </span>
            )}
          </Link>
          <Link href="/staff/approvals?section=discount&tab=approved" className={tabClass(tab === "approved")}>
            Approved
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800">
              {counts.approved}
            </span>
          </Link>
          <Link href="/staff/approvals?section=discount&tab=rejected" className={tabClass(tab === "rejected")}>
            Rejected
            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-gray-100 text-gray-800">
              {counts.rejected}
            </span>
          </Link>
        </nav>
      </div>

      {/* Tab Content */}
      {tab === "pending" && pendingResult && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pending Approval</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <DiscountRequestsTable
                requests={pendingResult.data}
                enableBulkActions={true}
              />
            </CardContent>
          </Card>

          {approvedUnapplied.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Approved — Ready to Apply ({approvedUnapplied.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  These approved requests are waiting to be attached to their
                  parent assessment (e.g., after a payment void + discount reversal).
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <DiscountRequestsTable
                  requests={approvedUnapplied}
                  enableBulkActions={false}
                />
              </CardContent>
            </Card>
          )}

          {pendingResult.pagination && (
            <TablePagination
              currentPage={pendingResult.pagination.page}
              totalPages={pendingResult.pagination.totalPages}
              totalRecords={pendingResult.pagination.totalRecords}
              pageSize={pendingResult.pagination.pageSize}
              baseUrl="/staff/approvals?section=discount&tab=pending"
              itemLabel="requests"
            />
          )}
        </>
      )}

      {tab === "approved" && approvedResult && (
        <Card>
          <CardHeader>
            <CardTitle>Approved Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DiscountRequestsTable
              requests={approvedResult.data}
              enableBulkActions={false}
            />
          </CardContent>
          {approvedResult.pagination && (
            <TablePagination
              currentPage={approvedResult.pagination.page}
              totalPages={approvedResult.pagination.totalPages}
              totalRecords={approvedResult.pagination.totalRecords}
              pageSize={approvedResult.pagination.pageSize}
              baseUrl="/staff/approvals?section=discount&tab=approved"
              itemLabel="requests"
            />
          )}
        </Card>
      )}

      {tab === "rejected" && rejectedResult && (
        <Card>
          <CardHeader>
            <CardTitle>Rejected Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DiscountRequestsTable
              requests={rejectedResult.data}
              enableBulkActions={false}
            />
          </CardContent>
          {rejectedResult.pagination && (
            <TablePagination
              currentPage={rejectedResult.pagination.page}
              totalPages={rejectedResult.pagination.totalPages}
              totalRecords={rejectedResult.pagination.totalRecords}
              pageSize={rejectedResult.pagination.pageSize}
              baseUrl="/staff/approvals?section=discount&tab=rejected"
              itemLabel="requests"
            />
          )}
        </Card>
      )}
    </div>
  );
}
