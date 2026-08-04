"use client";

import Link from "next/link";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/date";
import type { EnrollmentRecordRow } from "@/features/students/components/StudentRecordProfile";
import type { StudentRecordFlags } from "@/features/students/components/StudentRecordProfile";
import EnrollmentCancelAction from "@/features/registrations/components/EnrollmentCancelAction";

function enrollmentTypeLabel(studentType: string): string {
  if (studentType === "new_student") return "New";
  if (studentType === "transferee") return "Transferee";
  if (studentType === "old_student") return "Old";
  return studentType.replace(/_/g, " ");
}

function EnrollmentBillingCell({
  row,
  flags,
}: {
  row: EnrollmentRecordRow;
  flags: StudentRecordFlags;
}) {
  if (row.status === "cancelled") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (flags.canReadAssessments && row.assessmentId) {
    return (
      <Link
        href={`/staff/assessments/${row.assessmentId}`}
        className="font-mono text-sm text-primary underline-offset-2 hover:underline"
      >
        Open ledger
      </Link>
    );
  }

  if (row.status === "pending" && flags.canCreateAssessment) {
    return (
      <Link
        href={`/staff/assessments/new/${row.id}`}
        className="font-mono text-sm text-primary underline-offset-2 hover:underline"
      >
        Build assessment
      </Link>
    );
  }

  if (row.status === "assessed" && !row.assessmentId && flags.canReadAssessments) {
    return <span className="text-sm text-muted-foreground">Missing ledger</span>;
  }

  return <span className="text-muted-foreground">—</span>;
}

export type RegistrationHistoryTabProps = {
  enrollments: EnrollmentRecordRow[];
  flags: StudentRecordFlags;
};

/**
 * Enrollment history table tab for RegistrationDetailView.
 * Extracted for maintainability (audit 2026-07).
 */
export function RegistrationHistoryTab({
  enrollments,
  flags,
}: RegistrationHistoryTabProps) {
  return (
    <DataCard className="overflow-hidden">
      {enrollments.length === 0 ? (
        <p className="p-6 text-muted-foreground">No enrollment records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">School year</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Billing</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Created</th>
                {flags.canCancelEnrollment && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {enrollments.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="px-4 py-3">
                    <Link
                      href={`/staff/enrollments/${row.id}`}
                      className="text-primary hover:underline underline-offset-2"
                    >
                      {row.schoolYear}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.gradeLevel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.sectionName ?? "—"}</td>
                  <td className="px-4 py-3">{enrollmentTypeLabel(row.studentType)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} type="enrollment" />
                  </td>
                  <td className="px-4 py-3">
                    <EnrollmentBillingCell row={row} flags={flags} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.enrolledAt
                      ? formatDate(row.enrolledAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(row.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  {flags.canCancelEnrollment && (
                    <td className="px-4 py-3">
                      <EnrollmentCancelAction
                        enrollmentId={row.id}
                        enrollmentStatus={row.status}
                        schoolYearIsActive={row.schoolYearIsActive}
                        hasPendingCancellation={row.hasPendingCancellation}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}
