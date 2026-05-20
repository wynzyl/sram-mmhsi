import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getPendingDiscountRequests, getDiscountRequestCounts } from "@/features/discounts";
import DiscountRequestsTable from "@/features/discounts/components/DiscountRequestsTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Discount Requests",
  description: "Review and approve student discount requests.",
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    schoolYearId?: string;
    gradeLevelId?: string;
    search?: string;
  }>;
}

export default async function DiscountRequestsPage({ searchParams }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "discounts:review")) {
    redirect("/staff/finance");
  }

  const params = await searchParams;

  const [pendingResult, counts] = await Promise.all([
    getPendingDiscountRequests({
      page: params.page ? parseInt(params.page, 10) : 1,
      pageSize: 20,
      schoolYearId: params.schoolYearId,
      gradeLevelId: params.gradeLevelId,
      searchQuery: params.search,
    }),
    getDiscountRequestCounts(),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold">Discount Requests</h1>
        <p className="text-[var(--color-text-muted)]">
          Review and approve discount requests from registrars
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={counts.pending > 0 ? "border-[var(--color-warning)]" : ""}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{counts.pending}</div>
            <p className="text-xs text-[var(--color-text-muted)]">Pending Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[var(--color-success)]">{counts.approved}</div>
            <p className="text-xs text-[var(--color-text-muted)]">Approved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{counts.total}</div>
            <p className="text-xs text-[var(--color-text-muted)]">Total Processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests Table */}
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

      {/* Pagination info */}
      {pendingResult.pagination.totalPages > 1 && (
        <div className="text-sm text-[var(--color-text-muted)] text-center">
          Page {pendingResult.pagination.page} of{" "}
          {pendingResult.pagination.totalPages} ({pendingResult.pagination.totalRecords}{" "}
          total records)
        </div>
      )}
    </div>
  );
}
