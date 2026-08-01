import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchArchivedStudentsPage,
  getArchiveSummary,
  getArchiveSchoolYearOptions,
  getArchiveGradeLevelOptions,
} from "@/features/archive/archive.queries";
import {
  ArchiveDirectoryTable,
  ArchiveFilters,
  BatchArchiveDialog,
  BatchNoShowDialog,
} from "@/features/archive/components";
import {
  STUDENT_STATUS_LABELS,
  type StudentStatus,
} from "@/lib/constants/student-status";

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

  // Fetch data
  const [archiveData, summary, allSchoolYears, allGradeLevels] =
    await Promise.all([
      fetchArchivedStudentsPage({
        // Archive directory is archived-only; ignore a stray ?status=active.
        status:
          params.status && params.status !== "active"
            ? (params.status as Exclude<StudentStatus, "active">)
            : undefined,
        schoolYearId: params.schoolYearId,
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Archive Directory</h1>
          <p className="text-muted-foreground">
            View and manage archived students (graduated, transferred, etc.)
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <BatchArchiveDialog
              schoolYearOptions={allSchoolYears}
              gradeLevelOptions={allGradeLevels}
              trigger={<Button variant="secondary">Batch Archive Graduates</Button>}
            />
            <BatchNoShowDialog
              schoolYearOptions={allSchoolYears}
              trigger={
                <Button variant="secondary" className="text-destructive">
                  Batch Cancel No-Shows
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Archived
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
          </CardContent>
        </Card>
        {(
          ["graduated", "transferred", "withdrawn", "cancelled", "inactive"] as const
        ).map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {STUDENT_STATUS_LABELS[status]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary.byStatus[status] ?? 0}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <ArchiveFilters
            schoolYearOptions={archiveData.schoolYearOptions}
            currentStatus={params.status}
            currentSchoolYearId={params.schoolYearId}
            currentSearch={params.search}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ArchiveDirectoryTable rows={archiveData.rows} />
        </CardContent>
      </Card>

      {/* Pagination */}
      <TablePagination
        currentPage={archiveData.currentPage}
        totalPages={archiveData.totalPages}
        totalRecords={archiveData.totalCount}
        pageSize={25}
        baseUrl={buildBaseUrl(params)}
        itemLabel="students"
      />
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
