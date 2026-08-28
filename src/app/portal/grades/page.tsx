import { redirect } from "next/navigation";
import { requirePortalSession } from "@/lib/auth/session";
import {
  getStudentGrades,
  PORTAL_GRADES_PAGE_SIZE,
} from "@/features/portal/portal.queries";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { calculatePagination } from "@/lib/types/pagination";
import { GRADING_PERIOD_LABELS, type GradingPeriod } from "@/lib/constants/grading-periods";

export const metadata = { title: "My Grades" };

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PortalGradesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const session = await requirePortalSession();
  const { sections, totalSections } = await getStudentGrades(
    session.studentId,
    page,
    PORTAL_GRADES_PAGE_SIZE
  );

  const pagination = calculatePagination(page, PORTAL_GRADES_PAGE_SIZE, totalSections);

  // Handle empty state or invalid page
  if (sections.length === 0) {
    if (page > 1) {
      redirect("/portal/grades");
    }

    return (
      <PageContainer>
        <PageHeader title="My Grades" description="View your grades by grading period." />
        <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No grades yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your grades will appear here once they are published by your teachers.
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="My Grades" description="View your grades by grading period." />

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="bg-muted px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {section.gradeLevelName}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Section {section.sectionName} | {section.schoolYearLabel}
                  </p>
                </div>
                <Badge variant="success">Published</Badge>
              </div>
            </div>

            {/* Period Tabs */}
            <div className="border-b border-border">
              <div className="flex gap-1 px-4 pt-3">
                {section.periods.map((period) => (
                  <div
                    key={period}
                    className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary bg-primary/5 rounded-t-lg"
                  >
                    {GRADING_PERIOD_LABELS[period as GradingPeriod] || period}
                  </div>
                ))}
              </div>
            </div>

            {/* Grades Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-r border-border"
                    >
                      Period
                    </th>
                    {section.subjects.map((subject) => (
                      <th
                        key={subject.code}
                        scope="col"
                        className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[80px]"
                        title={subject.name}
                      >
                        {subject.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {section.periods.map((period, periodIdx) => (
                    <tr
                      key={period}
                      className={periodIdx % 2 === 0 ? "bg-card" : "bg-muted/30"}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground border-r border-border">
                        {GRADING_PERIOD_LABELS[period as GradingPeriod] || period}
                      </td>
                      {section.subjects.map((subject) => {
                        const grade = section.grades.get(period)?.get(subject.code);
                        const gradeNum = grade != null && grade !== "" ? Number(grade) : null;
                        const displayGrade = gradeNum != null && !Number.isNaN(gradeNum)
                          ? gradeNum.toFixed(2)
                          : "—";

                        // Determine grade color based on DepEd scale
                        let gradeClass = "text-foreground";
                        if (gradeNum !== null) {
                          if (gradeNum >= 90) gradeClass = "text-green-600 dark:text-green-400";
                          else if (gradeNum >= 85) gradeClass = "text-blue-600 dark:text-blue-400";
                          else if (gradeNum >= 80) gradeClass = "text-foreground";
                          else if (gradeNum >= 75) gradeClass = "text-amber-600 dark:text-amber-400";
                          else gradeClass = "text-red-600 dark:text-red-400";
                        }

                        return (
                          <td
                            key={subject.code}
                            className={`px-3 py-3 text-center text-sm font-medium tabular-nums ${gradeClass}`}
                          >
                            {displayGrade}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grading Scale Legend */}
            <div className="border-t border-border p-4 bg-muted/50">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Grading Scale
              </h4>
              <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>
                  <strong className="text-green-600 dark:text-green-400">90-100:</strong> Outstanding
                </span>
                <span>
                  <strong className="text-blue-600 dark:text-blue-400">85-89:</strong> Very Satisfactory
                </span>
                <span>
                  <strong className="text-foreground">80-84:</strong> Satisfactory
                </span>
                <span>
                  <strong className="text-amber-600 dark:text-amber-400">75-79:</strong> Fairly Satisfactory
                </span>
                <span>
                  <strong className="text-red-600 dark:text-red-400">Below 75:</strong> Did Not Meet Expectations
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <PaginationControls
          pagination={pagination}
          basePath="/portal/grades"
        />
      )}
    </PageContainer>
  );
}
