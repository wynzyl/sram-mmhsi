import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getGradeSheetById,
  getGradeSheetEntries,
  getStudentsInSection,
  getSubjectsForGradeLevel,
  getSubjectsFromOfferingsForSection,
} from "@/features/academics/grades/grades.queries";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/date";
import { GRADING_PERIOD_LABELS, type GradingPeriod } from "@/lib/constants/grading-periods";
import { GradeSheetReviewActions } from "@/features/academics/grades/components/GradeSheetReviewActions";
import { GradeSheetPublishActions } from "@/features/academics/grades/components/GradeSheetPublishActions";
import { getGradeGroup } from "@/lib/constants/grade-groups";

export const metadata = {
  title: "Review Grade Sheet | SRAMS",
  description: "Review and approve submitted grade sheet",
};

interface PageProps {
  params: Promise<{ sheetId: string }>;
}

function getStatusBadgeVariant(status: string): "secondary" | "info" | "success" | "warning" {
  const variants: Record<string, "secondary" | "info" | "success" | "warning"> = {
    draft: "secondary",
    submitted: "info",
    principal_approved: "success",
    published: "success",
    locked: "secondary",
    returned: "warning",
  };
  return variants[status] || "secondary";
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    principal_approved: "Principal Approved",
    published: "Published",
    locked: "Locked",
    returned: "Returned",
  };
  return labels[status] || status;
}

export default async function GradeSheetReviewPage({ params }: PageProps) {
  const session = await requireSession();
  const { sheetId } = await params;

  // Only principals can review
  if (!hasPermission(session.role, "grades:principal_review")) {
    redirect("/staff/grades");
  }

  // Get grade sheet
  const gradeSheet = await getGradeSheetById(sheetId);
  if (!gradeSheet) {
    notFound();
  }

  // Detect if this is an SHS section (Grade 11 or Grade 12)
  const isSHS = getGradeGroup(gradeSheet.gradeLevelName) === "shs";

  // Get entries and students in parallel
  const [entries, students] = await Promise.all([
    getGradeSheetEntries(sheetId),
    getStudentsInSection(gradeSheet.sectionId, gradeSheet.schoolYearId),
  ]);

  // Get subjects: for SHS, try subject offerings first (uses subjectId for grade lookup)
  // For non-SHS, use curriculum-based subjects
  // allSubjectIds tracks all IDs per code for grade lookup (handles duplicate subject records)
  let subjects: Array<{ id: string; code: string; name: string; allIds: string[] }>;

  if (isSHS) {
    // SHS sections use subject offerings for grade entry
    // Pass gradingPeriod to filter subjects by term (e.g., Q3 only shows second_semester + full_year subjects)
    const offeringSubjects = await getSubjectsFromOfferingsForSection(
      gradeSheet.sectionId,
      gradeSheet.schoolYearId,
      gradeSheet.gradingPeriod
    );

    if (offeringSubjects && offeringSubjects.length > 0) {
      // Deduplicate by subject CODE - same subject may have multiple term offerings
      // or duplicate subject records (same code, different ID) across strands/curriculums
      // Collect ALL subjectIds per code for grade lookup
      const subjectsByCode = new Map<string, { id: string; code: string; name: string; allIds: string[] }>();
      for (const s of offeringSubjects) {
        const existing = subjectsByCode.get(s.subjectCode);
        if (existing) {
          // Add this subjectId to the list if not already present
          if (!existing.allIds.includes(s.subjectId)) {
            existing.allIds.push(s.subjectId);
          }
        } else {
          subjectsByCode.set(s.subjectCode, {
            id: s.subjectId,
            code: s.subjectCode,
            name: s.subjectName,
            allIds: [s.subjectId],
          });
        }
      }
      subjects = Array.from(subjectsByCode.values());
    } else {
      // Fallback to curriculum-based subjects if no offerings exist
      const curriculumSubjects = await getSubjectsForGradeLevel(
        gradeSheet.gradeLevelId,
        gradeSheet.schoolYearId
      );
      subjects = curriculumSubjects.map(s => ({ ...s, allIds: [s.id] }));
    }
  } else {
    // Non-SHS: use curriculum-based subjects
    const curriculumSubjects = await getSubjectsForGradeLevel(
      gradeSheet.gradeLevelId,
      gradeSheet.schoolYearId
    );
    subjects = curriculumSubjects.map(s => ({ ...s, allIds: [s.id] }));
  }

  // Build a map of grades: studentId -> subjectId -> grade
  const gradeMap = new Map<string, Map<string, string | null>>();
  entries.forEach((entry) => {
    if (!gradeMap.has(entry.studentId)) {
      gradeMap.set(entry.studentId, new Map());
    }
    gradeMap.get(entry.studentId)!.set(entry.subjectId, entry.grade);
  });

  const canApprove = gradeSheet.status === "submitted";
  const canPublish = gradeSheet.status === "principal_approved" && hasPermission(session.role, "grades:publish");
  const canLock = gradeSheet.status === "published" && hasPermission(session.role, "grades:lock");
  const canUnlock = gradeSheet.status === "locked" && hasPermission(session.role, "grades:unlock");

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Link
                href="/staff/grades/approvals"
                className="hover:text-primary transition-colors"
              >
                Pending Approvals
              </Link>
              <span>/</span>
              <span className="text-foreground">{gradeSheet.gradeLevelName}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {gradeSheet.gradeLevelName} - Review Grade Sheet
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-medium text-foreground">
                Section {gradeSheet.sectionName}
              </span>{" "}
              |{" "}
              <span className="font-medium text-foreground">
                {GRADING_PERIOD_LABELS[gradeSheet.gradingPeriod as GradingPeriod]}
              </span>
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(gradeSheet.status)}>
            {getStatusLabel(gradeSheet.status)}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Adviser:</span>
            <p className="font-medium text-foreground">{gradeSheet.adviserName || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">School Year:</span>
            <p className="font-medium text-foreground">{gradeSheet.schoolYearLabel}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Submitted:</span>
            <p className="font-medium text-foreground">
              {gradeSheet.submittedAt ? formatDate(gradeSheet.submittedAt) : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Students:</span>
            <p className="font-medium text-foreground">{students.length}</p>
          </div>
        </div>
      </div>

      {/* Grade Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-r border-border min-w-[200px]"
                >
                  Student Name
                </th>
                {subjects.map((subject) => (
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
              {students.map((student, studentIndex) => (
                <tr
                  key={student.id}
                  className={studentIndex % 2 === 0 ? "bg-card" : "bg-muted/50"}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground border-r border-border">
                    <div className="flex flex-col">
                      <span>{student.fullName}</span>
                      <span className="text-xs text-muted-foreground">
                        {student.studentRef}
                      </span>
                    </div>
                  </td>
                  {subjects.map((subject) => {
                    // Check all subjectIds for this code (handles duplicate subject records)
                    const studentGrades = gradeMap.get(student.id);
                    let grade: string | null | undefined;
                    if (studentGrades) {
                      for (const subjectId of subject.allIds) {
                        grade = studentGrades.get(subjectId);
                        if (grade !== undefined) break;
                      }
                    }
                    return (
                      <td
                        key={subject.code}
                        className="px-3 py-3 text-center text-sm text-foreground"
                      >
                        {grade ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="border-t border-border p-4 bg-muted">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Grading Scale
          </h4>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              <strong className="text-foreground">90-100:</strong> Outstanding
            </span>
            <span>
              <strong className="text-foreground">85-89:</strong> Very Satisfactory
            </span>
            <span>
              <strong className="text-foreground">80-84:</strong> Satisfactory
            </span>
            <span>
              <strong className="text-foreground">75-79:</strong> Fairly Satisfactory
            </span>
            <span>
              <strong className="text-foreground">Below 75:</strong> Did Not Meet Expectations
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {canApprove && (
        <GradeSheetReviewActions gradeSheetId={sheetId} />
      )}

      {/* Publish/Lock Actions */}
      {(canPublish || canLock || canUnlock) && (
        <GradeSheetPublishActions
          gradeSheetId={sheetId}
          status={gradeSheet.status}
          canPublish={canPublish}
          canLock={canLock}
          canUnlock={canUnlock}
        />
      )}

      {/* Return remarks if returned */}
      {gradeSheet.status === "returned" && gradeSheet.returnRemarks && (
        <div className="bg-warning-tint border border-warning/25 rounded-xl p-4">
          <h3 className="text-sm font-medium text-warning mb-1">
            Return Remarks
          </h3>
          <p className="text-sm text-warning">
            {gradeSheet.returnRemarks}
          </p>
        </div>
      )}
    </div>
  );
}
