"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { updateEnrollmentStatusAction } from "../enrollments.actions";
import CancelEnrollmentForm from "./CancelEnrollmentForm";
import type { EnrollmentStatus } from "./CancelEnrollmentForm";
import { formatDate } from "@/lib/utils/date";

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

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  assessed: "badge-secondary",
  enrolled: "badge-success",
  cancelled: "badge-danger",
};

function OverrideEnrollBlock({ enrollmentId, sections }: { enrollmentId: string; sections: Section[] }) {
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
}

function EnrolledActions({
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
        <Link href={`/staff/students/${en.studentId}`} className="btn-ghost btn-sm">
          Student
        </Link>
        <Link href="/staff/assessments?view=ledgers" className="btn-ghost btn-sm">
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
}

function EnrollmentActionsCell({
  en,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
}: {
  en: Enrollment;
  sections: Section[];
  canManage: boolean;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
}) {
  const viewStudent = (
    <Link href={`/staff/students/${en.studentId}`} className="btn-ghost btn-sm">
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
          <Link href={`/staff/assessments/new/${en.id}`} className="btn-secondary btn-sm">
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
            <Link href={`/staff/assessments/${en.assessmentId}`} className="btn-primary btn-sm">
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
}

export default function EnrollmentsTable({
  enrollments,
  sections,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
}: EnrollmentsTableProps) {
  const showActions = canManage || canCancel || canOverrideEnrolled;

  return (
    <div className="table-wrapper">
      <table className="data-table" id="enrollments-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Student</th>
            <th>School Year</th>
            <th>Grade / Section</th>
            <th>Status</th>
            <th>Enrolled On</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {enrollments.length === 0 ? (
            <tr>
              <td colSpan={showActions ? 7 : 6} className="table-empty">
                No enrollment records found.
              </td>
            </tr>
          ) : (
            enrollments.map((en) => (
              <tr key={en.id} className="table-row-hover">
                <td>
                  <code className="reference-code">{en.referenceNumber}</code>
                </td>
                <td className="student-name">{en.studentName}</td>
                <td>{en.schoolYear}</td>
                <td>
                  {en.gradeLevel}
                  {en.section && <span className="text-muted"> — {en.section}</span>}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[en.status] ?? "badge-secondary"}`}>
                    {en.status.charAt(0).toUpperCase() + en.status.slice(1)}
                  </span>
                </td>
                <td className="text-muted">
                  {en.enrolledAt ? formatDate(en.enrolledAt) : "—"}
                </td>
                {showActions && (
                  <td>
                    <EnrollmentActionsCell
                      en={en}
                      sections={sections}
                      canManage={canManage}
                      canCancel={canCancel}
                      canCancelWithBalance={canCancelWithBalance}
                      canOverrideEnrolled={canOverrideEnrolled}
                    />
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
