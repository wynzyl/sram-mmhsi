import { redirect } from "next/navigation";
import { requirePortalSession } from "@/lib/auth/session";
import {
  getStudentGrades,
  PORTAL_GRADES_PAGE_SIZE,
  type SectionGrades,
} from "@/features/portal/portal.queries";
import { Badge } from "@/components/ui/badge";
import { PaginationControls } from "@/components/shared/PaginationControls";
import { EmptyState } from "@/components/shared/EmptyState";
import { calculatePagination } from "@/lib/types/pagination";
import {
  GRADING_PERIOD_LABELS,
  type GradingPeriod,
} from "@/lib/constants/grading-periods";
import {
  PortalPage,
  PortalSection,
  PortalPeriodTabs,
  PortalGradeValue,
  PORTAL_GRADE_BANDS,
  gradeRemarkInk,
} from "@/features/portal/components";

export const metadata = { title: "My Grades" };

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

const PAGE_DESCRIPTION = "View your grades by grading period.";

function periodLabel(period: string): string {
  return GRADING_PERIOD_LABELS[period as GradingPeriod] ?? period;
}

/** SectionGrades carries no id, so key on the tuple it was grouped by. */
function sectionKey(section: SectionGrades): string {
  return `${section.schoolYearLabel}-${section.gradeLevelName}-${section.sectionName}`;
}

function readGrade(
  section: SectionGrades,
  period: string,
  subjectCode: string
): number | null {
  const raw = section.grades.get(period)?.get(subjectCode);
  if (raw === undefined || raw === null || raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

/** Shares PORTAL_GRADE_BANDS with the cells above, so the two cannot drift. */
function GradingScaleLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {PORTAL_GRADE_BANDS.map((band) => (
        <span key={band.remark}>
          <strong className={gradeRemarkInk(band.remark)}>{band.range}:</strong>{" "}
          {band.remark}
        </span>
      ))}
    </div>
  );
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

  const pagination = calculatePagination(
    page,
    PORTAL_GRADES_PAGE_SIZE,
    totalSections
  );

  if (sections.length === 0) {
    if (page > 1) redirect("/portal/grades");

    return (
      <PortalPage title="My Grades" description={PAGE_DESCRIPTION}>
        <EmptyState
          icon="grades"
          title="No grades yet"
          description="Your grades will appear here once they are published by your teachers."
        />
      </PortalPage>
    );
  }

  return (
    <PortalPage title="My Grades" description={PAGE_DESCRIPTION}>
      {sections.map((section) => (
        <PortalSection
          key={sectionKey(section)}
          title={section.gradeLevelName}
          subtitle={`Section ${section.sectionName}, ${section.schoolYearLabel}`}
          badge={<Badge variant="success">Published</Badge>}
          padded={false}
          footer={<GradingScaleLegend />}
        >
          {/*
            From md up the matrix answers "how am I doing across every quarter"
            in one glance, so tabs would only hide data. Below md an 8-12 column
            matrix cannot fit, so the same data is re-cut by period into real
            tabs. The page previously rendered a decorative strip that styled
            every period as simultaneously active and controlled nothing.
          */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full">
              <caption className="sr-only">
                {`Grades for ${section.gradeLevelName} section ${section.sectionName}, ${section.schoolYearLabel}`}
              </caption>
              <thead className="bg-muted/50">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border-r border-border bg-muted/50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Period
                  </th>
                  {section.subjects.map((subject) => (
                    <th
                      key={subject.code}
                      scope="col"
                      className="min-w-20 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      <abbr
                        title={subject.name}
                        className="no-underline"
                      >
                        {subject.code}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.periods.map((period) => (
                  <tr key={period} className="border-t border-border">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-border bg-card px-4 py-3 text-left text-sm font-medium whitespace-nowrap text-foreground"
                    >
                      {periodLabel(period)}
                    </th>
                    {section.subjects.map((subject) => (
                      <td
                        key={subject.code}
                        className="px-3 py-3 text-center text-sm font-medium"
                      >
                        <PortalGradeValue
                          grade={readGrade(section, period, subject.code)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 md:hidden">
            <PortalPeriodTabs
              ariaLabel={`Grading periods for section ${section.sectionName}`}
              tabs={section.periods.map((p) => ({
                id: p,
                label: periodLabel(p),
              }))}
            >
              {section.periods.map((period) => (
                <ul key={period} className="divide-y divide-border">
                  {section.subjects.map((subject) => (
                    <li
                      key={subject.code}
                      className="flex items-baseline justify-between gap-3 py-2.5"
                    >
                      <span className="text-sm text-foreground">
                        {subject.name}
                      </span>
                      <PortalGradeValue
                        grade={readGrade(section, period, subject.code)}
                        className="shrink-0 text-sm font-medium"
                      />
                    </li>
                  ))}
                </ul>
              ))}
            </PortalPeriodTabs>
          </div>
        </PortalSection>
      ))}

      {pagination.totalPages > 1 && (
        <PaginationControls pagination={pagination} basePath="/portal/grades" />
      )}
    </PortalPage>
  );
}
