"use client";

import Link from "next/link";

export interface PendingEnrollmentRow {
  enrollmentId: string;
  referenceNumber: string;
  studentName: string;
  schoolYear: string;
  gradeLevel: string;
  /** Preformatted on the server (e.g. en-PH date). */
  queuedAtLabel: string;
}

interface PendingAssessmentsQueueProps {
  rows: PendingEnrollmentRow[];
  canCreate: boolean;
  /** Base path without trailing slash (e.g. `/staff/assessments`). */
  assessmentsBasePath?: string;
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

export default function PendingAssessmentsQueue({
  rows,
  canCreate,
  assessmentsBasePath = "/staff/assessments",
}: PendingAssessmentsQueueProps) {
  const colSpan = canCreate ? 6 : 5;

  return (
    <div className="table-wrapper rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="pending-assessments-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="pl-4 font-semibold tracking-wide text-[var(--color-text-2)]">Student</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Reference</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Grade Level</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">School Year</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Queued</th>
            {canCreate && (
              <th className="w-px text-right font-semibold tracking-wide text-[var(--color-text-2)]" aria-label="Actions" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-[var(--color-text-muted)]">
                No enrollments are waiting for assessment.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr
                key={r.enrollmentId}
                className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]/80"
              >
                <td className="align-middle py-3 pl-4 pr-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface))] font-display text-sm font-bold text-[var(--color-primary)]"
                      aria-hidden
                    >
                      {initials(r.studentName)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text)]">
                        {r.studentName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="align-middle py-3">
                  <code className="reference-code text-[0.8rem]">#{r.referenceNumber}</code>
                </td>
                <td className="align-middle py-3 text-[var(--color-text)]">
                  {r.gradeLevel}
                </td>
                <td className="align-middle py-3 text-[var(--color-text)]">
                  {r.schoolYear}
                </td>
                <td className="align-middle py-3 text-[var(--color-text-muted)] text-sm">
                  {r.queuedAtLabel}
                </td>
                {canCreate && (
                  <td className="align-middle py-3 text-right pr-4">
                    <Link
                      href={`${assessmentsBasePath}/new/${r.enrollmentId}`}
                      className="inline-flex items-center justify-center rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white hover:opacity-95 transition-opacity"
                    >
                      Assessment
                    </Link>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
