"use client";

import { useState, useActionState, useMemo, memo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { updateEnrollmentStatusAction } from "../enrollments.actions";
import CancelEnrollmentForm from "./CancelEnrollmentForm";
import type { EnrollmentStatus } from "./CancelEnrollmentForm";
import { formatDate } from "@/lib/utils/date";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import {
  createTextColumn,
  createStatusColumn,
  createDateColumn,
} from "@/components/tables/column-factories";

interface Enrollment {
  id: string;
  status: EnrollmentStatus;
  studentName: string;
  referenceNumber: string;
  studentId: string;
  schoolYear: string;
  gradeLevel: string;
  section: string | null;
  enrolledAt: Date | null;
  createdAt: Date;
  assessmentId: string | null;
  /** Assessment row total paid (numeric); null if no assessment joined. */
  assessmentTotalPaid: number | null;
}

interface Section {
  id: string;
  name: string;
}

interface EnrollmentsTableProps {
  enrollments: Enrollment[];
  sections: Section[];
  canManage: boolean;
  canCancel: boolean;
  /** Admin-only: cancel while ledger still shows collected tuition (mandatory long remarks). */
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// OverrideEnrollBlock - Memoized to prevent column regeneration
// ─────────────────────────────────────────────────────────────────────────────

const OverrideEnrollBlock = memo(function OverrideEnrollBlock({
  enrollmentId,
  sections,
}: {
  enrollmentId: string;
  sections: Section[];
}) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [showPick, setShowPick] = useState(false);

  if (state.success) {
    return (
      <span className="text-muted text-[11px]">
        {state.message}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {state.message && !state.success && (
        <p className="text-[11px] text-destructive">{state.message}</p>
      )}
      {!showPick ? (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setShowPick(true)}>
          Override: mark enrolled (no payment)
        </button>
      ) : (
        <form action={action} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="override_enroll" />
          <select name="sectionId" className="form-control px-1.5 py-0.5 text-[11px]">
            <option value="">Section...</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary btn-sm" disabled={pending} title="Admin only">
            Confirm
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowPick(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EnrolledActions - Memoized to prevent column regeneration
// ─────────────────────────────────────────────────────────────────────────────

const EnrolledActions = memo(function EnrolledActions({
  en,
  canCancel,
  canCancelWithBalance,
}: {
  en: Enrollment;
  canCancel: boolean;
  canCancelWithBalance: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/staff/students/${en.studentId}`} prefetch={false} className="btn-ghost btn-sm">
          Student
        </Link>
        <Link href="/staff/assessments?view=ledgers" prefetch={false} className="btn-ghost btn-sm">
          Ledgers
        </Link>
      </div>
      {canCancel && (
        <CancelEnrollmentForm
          enrollmentId={en.id}
          status={en.status}
          assessmentId={en.assessmentId}
          assessmentTotalPaid={en.assessmentTotalPaid}
          canCancelWithBalance={canCancelWithBalance}
          variant="table"
        />
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// EnrollmentActionsCell - Memoized to prevent column regeneration on state changes
// ─────────────────────────────────────────────────────────────────────────────

interface EnrollmentActionsCellProps {
  en: Enrollment;
  sections: Section[];
  canManage: boolean;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
}

const EnrollmentActionsCell = memo(function EnrollmentActionsCell({
  en,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
}: EnrollmentActionsCellProps) {
  const viewStudent = (
    <Link href={`/staff/students/${en.studentId}`} prefetch={false} className="btn-ghost btn-sm">
      Student
    </Link>
  );

  if (en.status === "cancelled") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {viewStudent}
        {canManage && (
          <Link
            href={`/staff/enrollments/new?studentId=${en.studentId}`}
            prefetch={false}
            className="table-action-link"
          >
            Re-enroll
          </Link>
        )}
      </div>
    );
  }

  if (en.status === "enrolled") {
    return (
      <EnrolledActions
        en={en}
        canCancel={canCancel}
        canCancelWithBalance={canCancelWithBalance}
      />
    );
  }

  if (en.status === "pending") {
    if (!canManage) {
      return <div className="flex gap-1.5">{viewStudent}</div>;
    }
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5">
          <Link href={`/staff/assessments/new/${en.id}`} prefetch={false} className="btn-secondary btn-sm">
            Build assessment
          </Link>
          {viewStudent}
        </div>
        {canCancel && (
          <CancelEnrollmentForm
            enrollmentId={en.id}
            status={en.status}
            assessmentId={en.assessmentId}
            assessmentTotalPaid={en.assessmentTotalPaid}
            canCancelWithBalance={canCancelWithBalance}
            variant="table"
          />
        )}
      </div>
    );
  }

  if (en.status === "assessed") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {en.assessmentId ? (
            <Link href={`/staff/assessments/${en.assessmentId}`} prefetch={false} className="btn-primary btn-sm">
              Ledger / pay
            </Link>
          ) : (
            <span className="text-muted text-[11px]">
              Missing ledger row
            </span>
          )}
          {viewStudent}
        </div>
        {canOverrideEnrolled && <OverrideEnrollBlock enrollmentId={en.id} sections={sections} />}
        {canCancel && (
          <CancelEnrollmentForm
            enrollmentId={en.id}
            status={en.status}
            assessmentId={en.assessmentId}
            assessmentTotalPaid={en.assessmentTotalPaid}
            canCancelWithBalance={canCancelWithBalance}
            variant="table"
          />
        )}
      </div>
    );
  }

  return <div className="flex gap-1.5">{viewStudent}</div>;
});

export default function EnrollmentsTable({
  enrollments,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
}: EnrollmentsTableProps) {
  const showActions = canManage || canCancel || canOverrideEnrolled;

  const columns = useMemo<ColumnDef<Enrollment>[]>(() => {
    const baseColumns: ColumnDef<Enrollment>[] = [
      {
        header: "Student ID",
        id: "referenceNumber",
        accessorKey: "referenceNumber",
        cell: ({ row }) => <ReferenceCode code={row.original.referenceNumber} />,
      },
      {
        header: "Student",
        id: "studentName",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.studentName}</span>
        ),
      },
      createTextColumn<Enrollment>("schoolYear", { header: "School Year" }),
      {
        header: "Grade / Section",
        id: "gradeSection",
        accessorFn: (row) => `${row.gradeLevel} ${row.section ?? ""}`,
        cell: ({ row }) => (
          <span>
            {row.original.gradeLevel}
            {row.original.section && (
              <span className="text-muted-foreground"> — {row.original.section}</span>
            )}
          </span>
        ),
      },
      createStatusColumn<Enrollment>("status", { header: "Status", type: "enrollment" }),
      createDateColumn<Enrollment>("enrolledAt", { header: "Enrolled On" }),
    ];

    if (showActions) {
      baseColumns.push({
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <EnrollmentActionsCell
            en={row.original}
            sections={sections}
            canManage={canManage}
            canCancel={canCancel}
            canCancelWithBalance={canCancelWithBalance}
            canOverrideEnrolled={canOverrideEnrolled}
          />
        ),
      });
    }

    return baseColumns;
  }, [showActions, sections, canManage, canCancel, canCancelWithBalance, canOverrideEnrolled]);

  return (
    <DataTable
      columns={columns}
      data={enrollments}
      searchable={false}
      enablePagination={enrollments.length > 20}
      pageSize={20}
    />
  );
}
