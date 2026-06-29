import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  fetchDocumentRequestsPage,
  getDocumentRequestsSummary,
  getSchoolYearOptions,
} from "@/features/documents/document-requests.queries";
import { DocumentRequestsTable } from "@/features/documents/components/DocumentRequestsTable";
import { DocumentRequestFilters } from "@/features/documents/components/DocumentRequestFilters";
import type { DocumentRequestStatus, DocumentRequestType } from "@/lib/constants/document-requests";
import Link from "next/link";

export const metadata = {
  title: "Document Requests | Archive",
};

export default async function DocumentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    type?: string;
    sy?: string;
    q?: string;
    studentId?: string;
  }>;
}) {
  // Force dynamic rendering - document requests are transactional data
  await connection();

  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "documents:read")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);
  const status = params.status as DocumentRequestStatus | undefined;
  const documentType = params.type as DocumentRequestType | undefined;
  const schoolYearId = params.sy;
  const search = params.q;
  const studentId = params.studentId;

  // Fetch data
  const [requestsData, summary, schoolYearOptions] = await Promise.all([
    fetchDocumentRequestsPage({
      page,
      pageSize: 20,
      status,
      documentType,
      schoolYearId,
      search,
      studentId,
    }),
    getDocumentRequestsSummary(),
    getSchoolYearOptions(),
  ]);

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Header */}
      <div className="mb-6">
        <nav className="mb-2 text-sm text-muted-foreground">
          <Link href="/staff/archive" className="hover:text-primary">
            Archive
          </Link>
          <span className="mx-2">/</span>
          <span>Document Requests</span>
        </nav>
        <h1 className="text-2xl font-bold">Document Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Manage requests for official school documents from students and alumni.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Pending"
          count={summary.byStatus.requested + summary.byStatus.processing}
          color="amber"
        />
        <SummaryCard
          label="Ready for Release"
          count={summary.byStatus.ready}
          color="blue"
        />
        <SummaryCard
          label="Released"
          count={summary.byStatus.released}
          color="green"
        />
        <SummaryCard
          label="Total Requests"
          count={summary.total}
          color="gray"
        />
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border bg-card p-4">
        <DocumentRequestFilters schoolYearOptions={schoolYearOptions} />
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <DocumentRequestsTable
          rows={requestsData.rows}
          emptyMessage="No document requests found matching your criteria."
        />
      </div>

      {/* Pagination */}
      {requestsData.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing page {requestsData.currentPage} of {requestsData.totalPages} (
            {requestsData.totalCount} total requests)
          </p>
          <div className="flex gap-2">
            {requestsData.currentPage > 1 && (
              <PaginationLink page={requestsData.currentPage - 1} params={params}>
                Previous
              </PaginationLink>
            )}
            {requestsData.currentPage < requestsData.totalPages && (
              <PaginationLink page={requestsData.currentPage + 1} params={params}>
                Next
              </PaginationLink>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "amber" | "blue" | "green" | "gray";
}) {
  const colorClasses = {
    amber: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
    blue: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
    green: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
    gray: "bg-muted border-border",
  };

  const textClasses = {
    amber: "text-amber-700 dark:text-amber-300",
    blue: "text-blue-700 dark:text-blue-300",
    green: "text-green-700 dark:text-green-300",
    gray: "text-foreground",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${textClasses[color]}`}>{count}</p>
    </div>
  );
}

function PaginationLink({
  page,
  params,
  children,
}: {
  page: number;
  params: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  if (params.status) searchParams.set("status", params.status);
  if (params.type) searchParams.set("type", params.type);
  if (params.sy) searchParams.set("sy", params.sy);
  if (params.q) searchParams.set("q", params.q);
  if (params.studentId) searchParams.set("studentId", params.studentId);

  return (
    <Link
      href={`?${searchParams.toString()}`}
      className="rounded-md border px-3 py-1.5 hover:bg-muted"
    >
      {children}
    </Link>
  );
}
