"use client";

import { useMemo, memo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useFormToast } from "@/hooks/useFormToast";
import { useInlineConfirm } from "@/hooks/useInlineConfirm";
import { useCancelAssessmentFromQueue } from "@/features/assessments/hooks/use-assessments";
import { DataTable } from "@/components/shared/DataTable";
import { StudentAvatarCell } from "@/components/shared/StudentAvatarCell";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import {
  InlineConfirmButtons,
  InlineConfirmTrigger,
} from "@/components/shared/InlineConfirmButtons";
import { createTextColumn } from "@/components/tables/column-factories";

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

// ─────────────────────────────────────────────────────────────────────────────
// CancelEnrollmentInline - Memoized to prevent column regeneration
// ─────────────────────────────────────────────────────────────────────────────

interface CancelEnrollmentInlineProps {
  enrollmentId: string;
  studentName: string;
}

/** Inline cancel button with confirmation for a single enrollment row. */
const CancelEnrollmentInline = memo(function CancelEnrollmentInline({
  enrollmentId,
  studentName,
}: CancelEnrollmentInlineProps) {
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
});

// ─────────────────────────────────────────────────────────────────────────────
// ActionsCell - Memoized to prevent column regeneration on state changes
// ─────────────────────────────────────────────────────────────────────────────

interface ActionsCellProps {
  row: PendingEnrollmentRow;
  canCreate: boolean;
  canCancel: boolean;
  assessmentsBasePath: string;
}

const ActionsCell = memo(function ActionsCell({
  row,
  canCreate,
  canCancel,
  assessmentsBasePath,
}: ActionsCellProps) {
  return (
    <div className="flex items-center justify-end gap-2">
      {canCreate && (
        <Link
          href={`${assessmentsBasePath}/new/${row.enrollmentId}`}
          className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-95 transition-opacity"
        >
          Assessment
        </Link>
      )}
      {canCancel && (
        <CancelEnrollmentInline
          enrollmentId={row.enrollmentId}
          studentName={row.studentName}
        />
      )}
    </div>
  );
});

export default function PendingAssessmentsQueue({
  rows,
  canCreate,
  canCancel = false,
  assessmentsBasePath = "/staff/assessments",
}: PendingAssessmentsQueueProps) {
  const hasActions = canCreate || canCancel;

  const columns = useMemo<ColumnDef<PendingEnrollmentRow>[]>(() => {
    const baseColumns: ColumnDef<PendingEnrollmentRow>[] = [
      {
        header: "Student",
        id: "student",
        accessorFn: (row) => row.studentName,
        cell: ({ row }) => <StudentAvatarCell name={row.original.studentName} />,
      },
      {
        header: "Student ID",
        id: "referenceNumber",
        accessorKey: "referenceNumber",
        cell: ({ row }) => <ReferenceCode code={row.original.referenceNumber} />,
      },
      createTextColumn<PendingEnrollmentRow>("gradeLevel", { header: "Grade Level" }),
      createTextColumn<PendingEnrollmentRow>("schoolYear", { header: "School Year" }),
      {
        header: "Queued",
        id: "queuedAt",
        accessorKey: "queuedAtLabel",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.queuedAtLabel}</span>
        ),
      },
    ];

    if (hasActions) {
      baseColumns.push({
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <ActionsCell
            row={row.original}
            canCreate={canCreate}
            canCancel={canCancel}
            assessmentsBasePath={assessmentsBasePath}
          />
        ),
      });
    }

    return baseColumns;
  }, [hasActions, canCreate, canCancel, assessmentsBasePath]);

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable={false}
      enablePagination={false}
    />
  );
}
