"use client";

import Link from "next/link";
import { StudentRowActionsMenu } from "@/features/students/components/StudentRowActionsMenu";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { registrationStudentTypeLabel } from "@/lib/utils/intake-documents";
import { formatDate as formatDateLocalized } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/name";

export interface RegistrationRow {
  id: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  schoolYear: string;
  gradeLevel: string;
  studentType: string;
  intakeDocuments: EnrollmentIntakeDocuments | null;
  createdAt: Date;
}

interface RegistrationsTableProps {
  registrations: RegistrationRow[];
  emptyMessage?: string;
  /** Defaults to staff portal student URLs. */
  studentBasePath?: "/admin/students" | "/staff/students";
}


function countIntakeDocuments(docs: EnrollmentIntakeDocuments | null): {
  completed: number;
  total: number;
} {
  if (!docs) return { completed: 0, total: 5 };

  const fields = [
    docs.form138,
    docs.birthCertificatePsa,
    docs.goodMoralCharacter,
    docs.qualifiedVoucher,
    docs.escCertificate,
  ];

  const completed = fields.filter(
    (field) => field === "received" || field === "not_applicable"
  ).length;

  return { completed, total: 5 };
}

function formatDate(date: Date): string {
  return formatDateLocalized(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function RegistrationsTable({
  registrations,
  emptyMessage = "No registrations found.",
  studentBasePath = "/staff/students",
}: RegistrationsTableProps) {
  const colSpan = 8;

  return (
    <div className="table-wrapper rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="registrations-table">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="pl-4 font-semibold tracking-wide text-gray-600 dark:text-gray-400">Student</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Reference</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Grade Level</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">School Year</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Type</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Documents</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Registered</th>
            <th className="w-px text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            registrations.map((reg) => {
              const docProgress = countIntakeDocuments(reg.intakeDocuments);
              const isComplete = docProgress.completed === docProgress.total;

              return (
                <tr
                  key={reg.id}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/80"
                >
                  <td className="align-middle py-3 pl-4 pr-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary"
                        aria-hidden
                      >
                        {getInitials(reg.studentName)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`${studentBasePath}/${reg.studentId}`}
                          className="block truncate font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {reg.studentName}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle py-3">
                    <code className="reference-code text-[0.8rem]">#{reg.referenceNumber}</code>
                  </td>
                  <td className="align-middle py-3 text-foreground">
                    {reg.gradeLevel}
                  </td>
                  <td className="align-middle py-3 text-foreground">
                    {reg.schoolYear}
                  </td>
                  <td className="align-middle py-3 text-foreground">
                    {registrationStudentTypeLabel(reg.studentType)}
                  </td>
                  <td className="align-middle py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        isComplete
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : docProgress.completed > 0
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-gray-200 text-muted-foreground dark:bg-gray-800"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
                      {isComplete ? "Complete" : `${docProgress.completed}/${docProgress.total}`}
                    </span>
                  </td>
                  <td className="align-middle py-3 text-muted-foreground text-sm">
                    {formatDate(reg.createdAt)}
                  </td>
                  <td className="align-middle py-3 text-right pr-2">
                    <StudentRowActionsMenu
                      studentId={reg.studentId}
                      studentBasePath={studentBasePath}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
