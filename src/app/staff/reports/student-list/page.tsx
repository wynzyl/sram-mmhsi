import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { getActiveSchoolYear, getSchoolYears } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getStudentListReport } from "@/features/reports/student-list-report.queries";
import { StudentListView } from "@/features/reports/components/StudentListView";

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
      <div className="page-container--full space-y-6">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
            Student List
          </h1>
          <p className="text-sm text-muted-foreground">
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

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Student List
        </h1>
        <p className="text-sm text-muted-foreground">
          Enrolled students for {schoolYearLabel} · {gradeLabel}
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="student-list-heading"
      >
        <StudentListView
          data={rows}
          schoolYears={schoolYears}
          gradeLevels={gradeLevels.map((g) => ({ id: g.id, label: g.name }))}
          defaults={{
            schoolYearId,
            gradeLevelId,
          }}
          pagination={{
            currentPage: page,
            totalPages,
            totalCount,
            pageSize: PAGE_SIZE,
          }}
        />
      </section>

      <p className="text-xs text-muted-foreground text-center no-print">
        Export PDF for a printable roster, or Export Excel for a spreadsheet you
        can sort and filter.
      </p>
    </div>
  );
}
