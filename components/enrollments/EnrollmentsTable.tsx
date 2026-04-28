"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { updateEnrollmentStatusAction } from "@/actions/enrollments";
import type { UpdateEnrollmentFormState } from "@/lib/validators/enrollment";

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
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  assessed: "badge-secondary",
  enrolled: "badge-success",
  cancelled: "badge-danger",
};

const NEXT_ACTION: Record<string, { label: string; action: string; btnClass: string }> = {
  pending: { label: "Mark Assessed", action: "assess", btnClass: "btn-secondary btn-sm" },
  assessed: { label: "Enroll", action: "enroll", btnClass: "btn-primary btn-sm" },
};

// ─── Inline Status Update Row ─────────────────────────────────────────────────

function EnrollmentActionRow({
  enrollment,
  sections,
  canCancel,
  onDone,
}: {
  enrollment: Enrollment;
  sections: Section[];
  canCancel: boolean;
  onDone: () => void;
}) {
  const initialState: UpdateEnrollmentFormState = {};
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, initialState);
  const [showCancel, setShowCancel] = useState(false);
  const [showSectionPick, setShowSectionPick] = useState(false);
  const nextAction = NEXT_ACTION[enrollment.status];

  if (state.success) {
    return (
      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
        ✓ {state.message}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      {state.message && (
        <p style={{ fontSize: "0.72rem", color: "var(--color-error)" }}>{state.message}</p>
      )}

      <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
        {/* Primary next-step action */}
        {nextAction && (
          <form action={action}>
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <input type="hidden" name="action" value={nextAction.action} />
            {nextAction.action === "enroll" && showSectionPick ? (
              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                <select name="sectionId" className="form-control" style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem" }}>
                  <option value="">No section</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button type="submit" className="btn-primary btn-sm" disabled={pending}>
                  {pending ? "..." : "Confirm"}
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setShowSectionPick(false)}>
                  ✕
                </button>
              </div>
            ) : (
              <button
                type={nextAction.action === "enroll" ? "button" : "submit"}
                className={nextAction.btnClass}
                disabled={pending}
                onClick={nextAction.action === "enroll" ? () => setShowSectionPick(true) : undefined}
              >
                {pending ? "..." : nextAction.label}
              </button>
            )}
          </form>
        )}

        {/* View Student */}
        <Link
          href={`/admin/students/${enrollment.studentId}`}
          className="btn-ghost btn-sm"
        >
          View
        </Link>

        {/* Cancel */}
        {canCancel && enrollment.status !== "enrolled" && enrollment.status !== "cancelled" && (
          showCancel ? (
            <form action={action} style={{ display: "flex", gap: "0.25rem" }}>
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <input type="hidden" name="action" value="cancel" />
              <input
                type="text"
                name="cancelRemarks"
                className="form-control"
                placeholder="Reason..."
                style={{ padding: "0.2rem 0.4rem", fontSize: "0.75rem", width: "120px" }}
              />
              <button type="submit" className="btn-danger btn-sm" disabled={pending}>
                {pending ? "..." : "Confirm"}
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowCancel(false)}>✕</button>
            </form>
          ) : (
            <button
              type="button"
              className="btn-ghost btn-sm"
              style={{ color: "var(--color-error)" }}
              onClick={() => setShowCancel(true)}
            >
              Cancel
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── Main Table ───────────────────────────────────────────────────────────────

export default function EnrollmentsTable({
  enrollments,
  sections,
  canManage,
  canCancel,
}: EnrollmentsTableProps) {
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
            {(canManage || canCancel) && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {enrollments.length === 0 ? (
            <tr>
              <td colSpan={canManage || canCancel ? 7 : 6} className="table-empty">
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
                  {en.section && (
                    <span className="text-muted"> — {en.section}</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${STATUS_BADGE[en.status] ?? "badge-secondary"}`}>
                    {en.status.charAt(0).toUpperCase() + en.status.slice(1)}
                  </span>
                </td>
                <td className="text-muted">
                  {en.enrolledAt
                    ? new Date(en.enrolledAt).toLocaleDateString("en-PH", {
                        year: "numeric", month: "short", day: "numeric",
                      })
                    : "—"}
                </td>
                {(canManage || canCancel) && (
                  <td>
                    {en.status === "cancelled" || en.status === "enrolled" ? (
                      <Link
                        href={`/admin/students/${en.studentId}`}
                        className="table-action-link"
                      >
                        View Student
                      </Link>
                    ) : (
                      <EnrollmentActionRow
                        enrollment={en}
                        sections={sections}
                        canCancel={canCancel}
                        onDone={() => {}}
                      />
                    )}
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
