"use client";

import Link from "next/link";
import { StudentRowActionsMenu } from "@/features/students/components/StudentRowActionsMenu";
import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";
import { registrationStudentTypeLabel } from "@/lib/utils/intake-documents";

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

function initials(name: string): string {
  const parts = name.split(",").map((s) => s.trim());
  if (parts.length >= 2) {
    // "Last, First" format
    const last = parts[0].charAt(0);
    const first = parts[1].charAt(0);
    return `${first}${last}`.toUpperCase() || "?";
  }
  // Fallback for other formats
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase();
  }
  return name.charAt(0).toUpperCase() || "?";
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
  return new Date(date).toLocaleDateString("en-PH", {
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
    <div className="table-wrapper rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="registrations-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="pl-4 font-semibold tracking-wide text-[var(--color-text-2)]">Student</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Reference</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Grade Level</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">School Year</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Type</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Documents</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Registered</th>
            <th className="w-px text-right font-semibold tracking-wide text-[var(--color-text-2)]" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {registrations.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-[var(--color-text-muted)]">
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
                  className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]/80"
                >
                  <td className="align-middle py-3 pl-4 pr-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface))] font-display text-sm font-bold text-[var(--color-primary)]"
                        aria-hidden
                      >
                        {initials(reg.studentName)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`${studentBasePath}/${reg.studentId}`}
                          className="block truncate font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                        >
                          {reg.studentName}
                        </Link>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle py-3">
                    <code className="reference-code text-[0.8rem]">#{reg.referenceNumber}</code>
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)]">
                    {reg.gradeLevel}
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)]">
                    {reg.schoolYear}
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)]">
                    {registrationStudentTypeLabel(reg.studentType)}
                  </td>
                  <td className="align-middle py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        isComplete
                          ? "bg-[color-mix(in_srgb,var(--color-success)_18%,transparent)] text-[var(--color-success)]"
                          : docProgress.completed > 0
                            ? "bg-[color-mix(in_srgb,var(--color-warning)_18%,transparent)] text-[var(--color-warning)]"
                            : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
                      {isComplete ? "Complete" : `${docProgress.completed}/${docProgress.total}`}
                    </span>
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text-muted)] text-sm">
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
