"use client";

import Link from "next/link";
import { useFormToast } from "@/hooks/useFormToast";
import { useInlineConfirm } from "@/hooks/useInlineConfirm";
import { useCancelAssessmentFromQueue } from "@/features/assessments/hooks/use-assessments";
import { StudentAvatarCell } from "@/components/shared/StudentAvatarCell";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import {
  InlineConfirmButtons,
  InlineConfirmTrigger,
} from "@/components/shared/InlineConfirmButtons";

const EMPTY_STATE = {} as const;

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
  const confirm = useInlineConfirm();
  const cancel = useCancelAssessmentFromQueue();

  useFormToast(cancel.data ?? EMPTY_STATE, {
    successMessage: "Enrollment cancelled",
    onSuccess: () => confirm.reset(),
  });

  function handleConfirm() {
    const formData = new FormData();
    formData.set("enrollmentId", enrollmentId);
    formData.set("action", "cancel");
    formData.set("cancelRemarks", `Cancelled from assessment queue for ${studentName}`);
    cancel.mutate(formData);
  }

  if (!confirm.isConfirming) {
    return (
      <InlineConfirmTrigger
        label="Cancel"
        variant="danger-outline"
        onClick={confirm.showConfirm}
      />
    );
  }

  return (
    <InlineConfirmButtons
      confirmLabel={cancel.isPending ? "..." : "Confirm"}
      cancelLabel="No"
      isLoading={cancel.isPending}
      variant="danger"
      onConfirm={handleConfirm}
      onCancel={confirm.hideConfirm}
    />
  );
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
    <div className="table-wrapper rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="pending-assessments-table">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="pl-4 font-semibold tracking-wide text-gray-600 dark:text-gray-400">Student</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Reference</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Grade Level</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">School Year</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Queued</th>
            {hasActions && (
              <th className="w-px text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400" aria-label="Actions" />
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <TableEmptyState
              message="No enrollments are waiting for assessment."
              colSpan={colSpan}
            />
          ) : (
            rows.map((r) => (
              <tr
                key={r.enrollmentId}
                className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/80"
              >
                <td className="align-middle py-3 pl-4 pr-4">
                  <StudentAvatarCell name={r.studentName} />
                </td>
                <td className="align-middle py-3">
                  <ReferenceCode code={r.referenceNumber} />
                </td>
                <td className="align-middle py-3 text-foreground">
                  {r.gradeLevel}
                </td>
                <td className="align-middle py-3 text-foreground">
                  {r.schoolYear}
                </td>
                <td className="align-middle py-3 text-muted-foreground text-sm">
                  {r.queuedAtLabel}
                </td>
                {hasActions && (
                  <td className="align-middle py-3 text-right pr-4">
                    <div className="flex items-center justify-end gap-2">
                      {canCreate && (
                        <Link
                          href={`${assessmentsBasePath}/new/${r.enrollmentId}`}
                          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:opacity-95 transition-opacity"
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
