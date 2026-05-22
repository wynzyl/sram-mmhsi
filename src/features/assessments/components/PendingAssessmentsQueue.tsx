"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { updateEnrollmentStatusAction } from "@/features/enrollments/enrollments.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { useRouter } from "next/navigation";

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
  /** Whether user can cancel enrollments. */
  canCancel?: boolean;
  /** Base path without trailing slash (e.g. `/staff/assessments`). */
  assessmentsBasePath?: string;
}

/** Inline cancel button with confirmation for a single enrollment row. */
function CancelEnrollmentInline({
  enrollmentId,
  studentName,
}: {
  enrollmentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});

  useFormToast(state, {
    successMessage: "Enrollment cancelled",
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
    },
  });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center justify-center rounded-md border border-[var(--color-destructive,#dc2626)] bg-transparent px-3 py-1 text-xs font-semibold text-[var(--color-destructive,#dc2626)] hover:bg-[var(--color-destructive,#dc2626)] hover:text-white transition-colors"
      >
        Cancel
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="action" value="cancel" />
      <input type="hidden" name="cancelRemarks" value={`Cancelled from assessment queue for ${studentName}`} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center rounded-md bg-[var(--color-destructive,#dc2626)] px-2 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {pending ? "..." : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex items-center justify-center rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] transition-colors"
      >
        No
      </button>
    </form>
  );
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
  canCancel = false,
  assessmentsBasePath = "/staff/assessments",
}: PendingAssessmentsQueueProps) {
  const hasActions = canCreate || canCancel;
  const colSpan = hasActions ? 6 : 5;

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
            {hasActions && (
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
                {hasActions && (
                  <td className="align-middle py-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {canCreate && (
                        <Link
                          href={`${assessmentsBasePath}/new/${r.enrollmentId}`}
                          className="inline-flex items-center justify-center rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs font-semibold text-white hover:opacity-95 transition-opacity"
                        >
                          Assessment
                        </Link>
                      )}
                      {canCancel && (
                        <CancelEnrollmentInline
                          enrollmentId={r.enrollmentId}
                          studentName={r.studentName}
                        />
                      )}
                    </div>
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
