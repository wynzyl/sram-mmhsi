import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import {
  fetchDocumentRequestsPage,
  getDocumentRequestsSummary,
  getSchoolYearOptions,
} from "@/features/documents/document-requests.queries";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import { DocumentRequestsTable } from "@/features/documents/components/DocumentRequestsTable";
import { DocumentRequestFilters } from "@/features/documents/components/DocumentRequestFilters";
import { TablePagination } from "@/components/ui/TablePagination";
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
  const search = params.q;
  const studentId = params.studentId;

  // Fetch active school year ID for default selection
  const activeSchoolYearId = await getActiveSchoolYearId();
  // Default to active school year if no filter specified
  const schoolYearId = params.sy ?? activeSchoolYearId ?? undefined;

  // Fetch data
  const [requestsData, summary, schoolYearOptions] = await Promise.all([
    fetchDocumentRequestsPage({
      page,
      pageSize: 25,
      status,
      documentType,
      schoolYearId,
      search,
      studentId,
    }),
    getDocumentRequestsSummary(),
    getSchoolYearOptions(),
  ]);

  const pendingCount = summary.byStatus.requested + summary.byStatus.processing;

  return (
    <div className="page-container--full space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/staff/archive" className="hover:text-primary">
          Archive
        </Link>
        <span className="mx-2">/</span>
        <span>Document Requests</span>
      </nav>

      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Document Requests
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage requests for official school documents from students and alumni
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="documents-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              id="documents-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Request Queue
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {summary.total} Total
            </span>
            {pendingCount > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {pendingCount} Pending
              </span>
            )}
            {summary.byStatus.ready > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {summary.byStatus.ready} Ready
              </span>
            )}
          </div>

          {/* Right: Inline Filters */}
          <DocumentRequestFilters
            schoolYearOptions={schoolYearOptions}
            defaultSchoolYearId={schoolYearId}
            inline
          />
        </div>

        {/* Table Content */}
        <DocumentRequestsTable
          rows={requestsData.rows}
          emptyMessage="No document requests found matching your criteria."
        />

        {/* Pagination */}
        {requestsData.totalCount > 0 && (
          <div className="border-t border-border px-4 py-3">
            <TablePagination
              currentPage={requestsData.currentPage}
              totalPages={requestsData.totalPages}
              totalRecords={requestsData.totalCount}
              pageSize={25}
              baseUrl={buildBaseUrl({ ...params, sy: schoolYearId })}
              itemLabel="requests"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function buildBaseUrl(params: {
  status?: string;
  type?: string;
  sy?: string;
  q?: string;
  studentId?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.type) searchParams.set("type", params.type);
  if (params.sy) searchParams.set("sy", params.sy);
  if (params.q) searchParams.set("q", params.q);
  if (params.studentId) searchParams.set("studentId", params.studentId);
  const qs = searchParams.toString();
  return `/staff/archive/documents${qs ? `?${qs}` : ""}`;
}


