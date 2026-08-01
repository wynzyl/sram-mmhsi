import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { getActiveSchoolYear, getSchoolYears } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getStudentListReport } from "@/features/reports/student-list-report.queries";
import { StudentListTable } from "@/features/reports/components/StudentListTable";
import { ReportFilters } from "@/components/shared/ReportFilters";
import { ReportExportActions } from "@/components/shared/ReportExportActions";

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    gradeLevelId?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function StudentListReportPage({ searchParams }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "reports:view")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

  const [schoolYears, gradeLevels, activeYear] = await Promise.all([
    getSchoolYears(),
    getGradeLevels(),
    getActiveSchoolYear(),
  ]);

  const schoolYearId = params.schoolYearId || activeYear?.id || "";
  const gradeLevelId = params.gradeLevelId || undefined;
  const page = parseInt(params.page || "1", 10) || 1;

  if (!schoolYearId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Student List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enrolled students with primary guardian contact details
          </p>
        </div>
        <div className="p-8 text-center bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">
            No active school year is set. Set an active school year to view the
            student list.
          </p>
        </div>
      </div>
    );
  }

  const { rows, totalCount } = await getStudentListReport({
    schoolYearId,
    gradeLevelId,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const schoolYearLabel =
    schoolYears.find((sy) => sy.id === schoolYearId)?.label ?? "—";
  const gradeLabel = gradeLevelId
    ? gradeLevels.find((g) => g.id === gradeLevelId)?.name ?? "Grade"
    : "All Grades";

  const buildPageUrl = (pageNum: number) => {
    const urlParams = new URLSearchParams();
    urlParams.set("schoolYearId", schoolYearId);
    if (gradeLevelId) urlParams.set("gradeLevelId", gradeLevelId);
    urlParams.set("page", pageNum.toString());
    return `?${urlParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Student List</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enrolled students for {schoolYearLabel} · {gradeLabel}
          </p>
        </div>
        <ReportExportActions
          exportPath="/staff/reports/student-list/export"
          filters={{ schoolYearId, gradeLevelId }}
        />
      </div>

      {/* Filters */}
      <div className="no-print">
        <ReportFilters
          basePath="/staff/reports/student-list"
          config={{
            schoolYears: schoolYears.map((sy) => ({ id: sy.id, label: sy.label })),
            schoolYearRequired: true,
            gradeLevels: gradeLevels.map((g) => ({ id: g.id, label: g.name })),
          }}
          defaults={{ schoolYearId, gradeLevelId }}
        />
      </div>

      {/* Preview */}
      {rows.length === 0 ? (
        <div className="p-8 text-center bg-card border border-border rounded-lg">
          <p className="text-muted-foreground">
            No enrolled students found for the selected filters.
          </p>
        </div>
      ) : (
        <>
          <StudentListTable data={rows} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg no-print">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1} -{" "}
                {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} students
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <a
                    href={buildPageUrl(page - 1)}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={buildPageUrl(page + 1)}
                    className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
                  >
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground text-center no-print">
        Export PDF for a printable roster, or Export Excel for a spreadsheet you
        can sort and filter.
      </p>
    </div>
  );
}
