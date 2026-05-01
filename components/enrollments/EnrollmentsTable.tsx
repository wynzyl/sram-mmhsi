"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { updateEnrollmentStatusAction } from "@/actions/enrollments";

interface Enrollment {
  id: string;
  status: string;
  studentName: string;
  referenceNumber: string;
  studentId: string;
  schoolYear: string;
  gradeLevel: string;
  section: string | null;
  enrolledAt: Date | null;
  createdAt: Date;
  assessmentId: string | null;
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
  canOverrideEnrolled: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  assessed: "badge-secondary",
  enrolled: "badge-success",
  cancelled: "badge-danger",
};

function CancelInline({ enrollmentId }: { enrollmentId: string }) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [show, setShow] = useState(false);

  if (state.success) {
    return (
      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
        ✓ {state.message}
      </span>
    );
  }

  return (
    <div style={{ marginTop: "0.125rem" }}>
      {!show ? (
        <button
          type="button"
          className="btn-ghost btn-sm"
          style={{ color: "var(--color-error)" }}
          onClick={() => setShow(true)}
        >
          Cancel enrollment
        </button>
      ) : (
        <form
          action={action}
          style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}
        >
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="cancel" />
          <input
            type="text"
            name="cancelRemarks"
            className="form-control"
            placeholder="Reason…"
            style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", width: "140px" }}
          />
          <button type="submit" className="btn-danger btn-sm" disabled={pending}>
            {pending ? "…" : "Confirm"}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShow(false)}>
            ✕
          </button>
        </form>
      )}
      {state.message && !state.success && (
        <p style={{ fontSize: "0.72rem", color: "var(--color-error)", marginTop: "0.2rem" }}>
          {state.message}
        </p>
      )}
    </div>
  );
}

function OverrideEnrollBlock({ enrollmentId, sections }: { enrollmentId: string; sections: Section[] }) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [showPick, setShowPick] = useState(false);

  if (state.success) {
    return (
      <span className="text-muted" style={{ fontSize: "0.72rem" }}>
        ✓ {state.message}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {state.message && !state.success && (
        <p style={{ fontSize: "0.72rem", color: "var(--color-error)" }}>{state.message}</p>
      )}
      {!showPick ? (
        <button type="button" className="btn-secondary btn-sm" onClick={() => setShowPick(true)}>
          Override: mark enrolled (no payment)
        </button>
      ) : (
        <form
          action={action}
          style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}
        >
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="override_enroll" />
          <select
            name="sectionId"
            className="form-control"
            style={{ padding: "0.2rem 0.4rem", fontSize: "0.72rem" }}
          >
            <option value="">Section…</option>
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
            ✕
          </button>
        </form>
      )}
    </div>
  );
}

function EnrolledActions({
  studentId,
  enrollmentId,
  canCancel,
}: {
  studentId: string;
  enrollmentId: string;
  canCancel: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link href={`/admin/students/${studentId}`} className="btn-ghost btn-sm">
          Student
        </Link>
        <Link href="/admin/assessments?view=ledgers" className="btn-ghost btn-sm">
          Ledgers
        </Link>
      </div>
      {canCancel && <CancelInline enrollmentId={enrollmentId} />}
    </div>
  );
}

function EnrollmentActionsCell({
  en,
  sections,
  canManage,
  canCancel,
  canOverrideEnrolled,
}: {
  en: Enrollment;
  sections: Section[];
  canManage: boolean;
  canCancel: boolean;
  canOverrideEnrolled: boolean;
}) {
  const viewStudent = (
    <Link href={`/admin/students/${en.studentId}`} className="btn-ghost btn-sm">
      Student
    </Link>
  );

  if (en.status === "cancelled") {
    return (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {viewStudent}
        {canManage && (
          <Link href={`/admin/enrollments/new?studentId=${en.studentId}`} className="table-action-link">
            Re-enroll
          </Link>
        )}
      </div>
    );
  }

  if (en.status === "enrolled") {
    return (
      <EnrolledActions studentId={en.studentId} enrollmentId={en.id} canCancel={canCancel} />
    );
  }

  if (en.status === "pending") {
    if (!canManage) {
      return <div style={{ display: "flex", gap: "0.35rem" }}>{viewStudent}</div>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <Link href={`/admin/assessments/new/${en.id}`} className="btn-secondary btn-sm">
            Build assessment
          </Link>
          {viewStudent}
        </div>
        {canCancel && <CancelInline enrollmentId={en.id} />}
      </div>
    );
  }

  if (en.status === "assessed") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
          {en.assessmentId ? (
            <Link href={`/admin/assessments/${en.assessmentId}`} className="btn-primary btn-sm">
              Ledger / pay
            </Link>
          ) : (
            <span className="text-muted" style={{ fontSize: "0.72rem" }}>
              Missing ledger row
            </span>
          )}
          {viewStudent}
        </div>
        {canOverrideEnrolled && <OverrideEnrollBlock enrollmentId={en.id} sections={sections} />}
        {canCancel && <CancelInline enrollmentId={en.id} />}
      </div>
    );
  }

  return <div style={{ display: "flex", gap: "0.35rem" }}>{viewStudent}</div>;
}

export default function EnrollmentsTable({
  enrollments,
  sections,
  canManage,
  canCancel,
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
                  {en.enrolledAt
                    ? new Date(en.enrolledAt).toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "—"}
                </td>
                {showActions && (
                  <td>
                    <EnrollmentActionsCell
                      en={en}
                      sections={sections}
                      canManage={canManage}
                      canCancel={canCancel}
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
