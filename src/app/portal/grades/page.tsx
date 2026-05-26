import { redirect } from "next/navigation";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  gradeRecords,
  teacherAssignments,
  subjects,
  sections,
  schoolYears,
} from "@/lib/db/schema";
import { requireSession } from "@/lib/auth/session";
import { PORTAL_ROLES } from "@/lib/constants/roles";
import type { Role } from "@/lib/constants/roles";
import { getPortalStudentIds, getPortalStudentLabels } from "@/lib/queries/portal-student";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { StatusBadge } from "@/components/shared/StatusBadge";

export const metadata = { title: "My Grades" };

export default async function PortalGradesPage() {
  const session = await requireSession();

  if (!PORTAL_ROLES.includes(session.role)) {
    redirect("/login");
  }

  const studentIds = await getPortalStudentIds(session.userId, session.role as Role);
  const labels = await getPortalStudentLabels(studentIds);
  const labelMap = Object.fromEntries(labels.map((s) => [s.id, s]));

  const rows =
    studentIds.length === 0
      ? []
      : await db
          .select({
            studentId: gradeRecords.studentId,
            id: gradeRecords.id,
            schoolYear: schoolYears.label,
            subject: subjects.name,
            section: sections.name,
            period: gradeRecords.gradingPeriod,
            grade: gradeRecords.grade,
            status: gradeRecords.status,
          })
          .from(gradeRecords)
          .innerJoin(
            teacherAssignments,
            eq(gradeRecords.teacherAssignmentId, teacherAssignments.id)
          )
          .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
          .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
          .innerJoin(schoolYears, eq(gradeRecords.schoolYearId, schoolYears.id))
          .where(
            and(
              inArray(gradeRecords.studentId, studentIds),
              isNull(teacherAssignments.deletedAt),
              isNull(subjects.deletedAt)
            )
          )
          .orderBy(desc(schoolYears.startDate), subjects.name, gradeRecords.gradingPeriod);

  const emptyCopy =
    studentIds.length === 0 ? (
      <p className="text-muted-foreground">
        No learner profile is linked to your portal account yet. Ask the registrar to link your account if
        you believe this is an error.
      </p>
    ) : rows.length === 0 ? (
      <p className="text-muted-foreground">
        No grades published yet for your enrollment. Check back once teachers submit grades.
      </p>
    ) : null;

  const showStudentColumn = studentIds.length > 1;

  return (
    <PageContainer>
      <PageHeader title="Grades" description="Quarterly grades by subject (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                {showStudentColumn && (
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Student</th>
                )}
                <th className="px-4 py-2 text-left font-semibold text-foreground">School year</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Subject</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Section</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Period</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Grade</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const who = labelMap[r.studentId];
                const name = who != null ? `${who.lastName}, ${who.firstName}` : "—";
                const gradeNum = r.grade != null && r.grade !== "" ? Number(r.grade) : null;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    {showStudentColumn && (
                      <td className="px-4 py-3 text-foreground">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{who?.referenceNumber}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-foreground">{r.schoolYear}</td>
                    <td className="px-4 py-3 text-foreground">{r.subject}</td>
                    <td className="px-4 py-3 text-foreground">{r.section}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{r.period}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                      {gradeNum != null && !Number.isNaN(gradeNum) ? gradeNum.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
