import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchArchivedStudentsPage,
  getArchiveSummary,
  getArchiveSchoolYearOptions,
  getArchiveGradeLevelOptions,
} from "@/features/archive/archive.queries";
import { getActiveSchoolYearId } from "@/lib/queries/schoolYears";
import {
  ArchiveDirectoryTable,
  ArchiveFilters,
  BatchArchiveDialog,
  BatchNoShowDialog,
} from "@/features/archive/components";
import type { StudentStatus } from "@/lib/constants/student-status";

export const metadata: Metadata = {
  title: "Archive Directory",
  description: "View and manage archived students.",
};

interface PageProps {
  searchParams: Promise<{
    status?: string;
    schoolYearId?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function ArchiveDirectoryPage({ searchParams }: PageProps) {
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "archive:read")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Fetch active school year ID for default selection
  const activeSchoolYearId = await getActiveSchoolYearId();
  // Default to active school year if no filter specified
  const schoolYearId = params.schoolYearId ?? activeSchoolYearId ?? undefined;

  // Fetch data
  const [archiveData, summary, allSchoolYears, allGradeLevels] =
    await Promise.all([
      fetchArchivedStudentsPage({
        // Archive directory is archived-only; ignore a stray ?status=active.
        status:
          params.status && params.status !== "active"
            ? (params.status as Exclude<StudentStatus, "active">)
            : undefined,
        schoolYearId,
        search: params.search,
        page,
        pageSize: 25,
      }),
      getArchiveSummary(),
      getArchiveSchoolYearOptions(),
      getArchiveGradeLevelOptions(),
    ]);

  const canManage = hasPermission(session.role, "archive:manage");

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Archive Directory
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage archived students (graduated, transferred, etc.)
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="archive-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              id="archive-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Archived Students
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {summary.total} Total
            </span>
            {summary.byStatus.graduated > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                {summary.byStatus.graduated} Graduated
              </span>
            )}
            {summary.byStatus.transferred > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info/10 text-info border border-info/30">
                {summary.byStatus.transferred} Transferred
              </span>
            )}
          </div>

          {/* Right: Filters + Actions (single row, no wrapping) */}
          <div className="filter-controls-inline">
            <ArchiveFilters
              schoolYearOptions={archiveData.schoolYearOptions}
              currentStatus={params.status}
              currentSchoolYearId={schoolYearId}
              currentSearch={params.search}
              inline
            />

            {canManage && (
              <>
                <div className="filter-separator hidden sm:block" />
                <BatchArchiveDialog
                  schoolYearOptions={allSchoolYears}
                  gradeLevelOptions={allGradeLevels}
                  trigger={<Button variant="secondary" size="sm">Batch Archive</Button>}
                />
                <BatchNoShowDialog
                  schoolYearOptions={allSchoolYears}
                  trigger={
                    <Button variant="secondary" size="sm" className="text-destructive">
                      Cancel No-Shows
                    </Button>
                  }
                />
              </>
            )}
          </div>
        </div>

        {/* Table Content */}
        <ArchiveDirectoryTable rows={archiveData.rows} />

        {/* Pagination */}
        {archiveData.totalCount > 0 && (
          <div className="border-t border-border px-4 py-3">
            <TablePagination
              currentPage={archiveData.currentPage}
              totalPages={archiveData.totalPages}
              totalRecords={archiveData.totalCount}
              pageSize={25}
              baseUrl={buildBaseUrl({ status: params.status, schoolYearId, search: params.search })}
              itemLabel="students"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function buildBaseUrl(params: {
  status?: string;
  schoolYearId?: string;
  search?: string;
}): string {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.schoolYearId) searchParams.set("schoolYearId", params.schoolYearId);
  if (params.search) searchParams.set("search", params.search);
  const qs = searchParams.toString();
  return `/staff/archive${qs ? `?${qs}` : ""}`;
}
