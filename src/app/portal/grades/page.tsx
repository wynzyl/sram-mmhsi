import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  gradeSheetEntries,
  gradeSheets,
  subjects,
  sections,
  schoolYears,
  gradeLevels,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/badge";
import type { GradeSheetStatus } from "@/lib/constants/grading-periods";
import { GRADING_PERIOD_LABELS, type GradingPeriod } from "@/lib/constants/grading-periods";

/** Show grades from approved, published, or locked grade sheets */
const VISIBLE_STATUSES: GradeSheetStatus[] = ["principal_approved", "published", "locked"];

export const metadata = { title: "My Grades" };

export default async function PortalGradesPage() {
  const session = await requireSession();

  // Only allow portal sessions with direct studentId access
  if (session.accountSource !== "portal" || !session.studentId) {
    redirect("/login");
  }

  // Fetch all grade entries for this student from visible grade sheets
  const rows = await db
    .select({
      id: gradeSheetEntries.id,
      schoolYearId: gradeSheets.schoolYearId,
      schoolYearLabel: schoolYears.label,
      schoolYearStart: schoolYears.startDate,
      sectionId: gradeSheets.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
      gradeLevelOrder: gradeLevels.order,
      subjectId: gradeSheetEntries.subjectId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      gradingPeriod: gradeSheets.gradingPeriod,
      grade: gradeSheetEntries.grade,
      status: gradeSheets.status,
    })
    .from(gradeSheetEntries)
    .innerJoin(gradeSheets, eq(gradeSheetEntries.gradeSheetId, gradeSheets.id))
    .innerJoin(subjects, eq(gradeSheetEntries.subjectId, subjects.id))
    .innerJoin(sections, eq(gradeSheets.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(gradeSheets.schoolYearId, schoolYears.id))
    .where(
      and(
        eq(gradeSheetEntries.studentId, session.studentId),
        inArray(gradeSheets.status, VISIBLE_STATUSES)
      )
    )
    .orderBy(
      desc(schoolYears.startDate),
      asc(gradeLevels.order),
      asc(subjects.code),
      asc(gradeSheets.gradingPeriod)
    );

  if (rows.length === 0) {
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

  // Group data by school year + section
  type SectionGrades = {
    schoolYearLabel: string;
    sectionName: string;
    gradeLevelName: string;
    subjects: Map<string, { code: string; name: string }>;
    periods: Set<string>;
    grades: Map<string, Map<string, string | null>>; // period -> subjectCode -> grade
  };

  const groupedData = new Map<string, SectionGrades>();

  for (const row of rows) {
    const key = `${row.schoolYearId}-${row.sectionId}`;

    if (!groupedData.has(key)) {
      groupedData.set(key, {
        schoolYearLabel: row.schoolYearLabel,
        sectionName: row.sectionName,
        gradeLevelName: row.gradeLevelName,
        subjects: new Map(),
        periods: new Set(),
        grades: new Map(),
      });
    }

    const group = groupedData.get(key)!;

    // Add subject
    if (!group.subjects.has(row.subjectCode)) {
      group.subjects.set(row.subjectCode, { code: row.subjectCode, name: row.subjectName });
    }

    // Add period
    group.periods.add(row.gradingPeriod);

    // Add grade
    if (!group.grades.has(row.gradingPeriod)) {
      group.grades.set(row.gradingPeriod, new Map());
    }
    group.grades.get(row.gradingPeriod)!.set(row.subjectCode, row.grade);
  }

  // Convert to array and sort subjects by code
  const sections_data = Array.from(groupedData.values()).map(group => ({
    ...group,
    subjects: Array.from(group.subjects.values()).sort((a, b) => a.code.localeCompare(b.code)),
    periods: Array.from(group.periods).sort(),
  }));

  return (
    <PageContainer>
      <PageHeader title="My Grades" description="View your grades by grading period." />

      <div className="space-y-8">
        {sections_data.map((section, idx) => (
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

                        // Determine grade color
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
    </PageContainer>
  );
}
