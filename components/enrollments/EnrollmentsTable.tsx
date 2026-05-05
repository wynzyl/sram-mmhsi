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
  /** Link targets for staff vs admin shell (assessments/students URLs). */
  portalBase?: "/admin" | "/staff";
}

const STATUS_BADGE: Record<string, string> = {
  pending: "badge-warning",
  assessed: "badge-secondary",
  enrolled: "badge-success",
  cancelled: "badge-danger",
};

const OUTSTANDING_PAYMENT_EPSILON = 0.009;

function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function withPortal(href: string, portalBase: "/admin" | "/staff") {
  return portalBase === "/staff" ? href.replace(/^\/admin/, "/staff") : href;
}

function CancelInline({
  enrollmentId,
  status,
  assessmentId,
  assessmentTotalPaid,
  canCancelWithBalance,
  portalBase,
}: {
  enrollmentId: string;
  status: string;
  assessmentId: string | null;
  assessmentTotalPaid: number | null;
  canCancelWithBalance: boolean;
  portalBase: "/admin" | "/staff";
}) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [show, setShow] = useState(false);

  const paid = assessmentTotalPaid ?? 0;
  const financeStatuses = status === "assessed" || status === "enrolled";
  const hasCollected = financeStatuses && paid > OUTSTANDING_PAYMENT_EPSILON;
  const cancelBlockedByPayments = hasCollected && !canCancelWithBalance;

  const remarksError = state.errors?.cancelRemarks?.[0];

  if (state.success) {
    return (
      <span className="text-muted" style={{ fontSize: "0.75rem" }}>
        ✓ {state.message}
      </span>
    );
  }

  return (
    <div style={{ marginTop: "0.125rem", maxWidth: "min(100%, 22rem)" }}>
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
          style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}
        >
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="cancel" />
          {financeStatuses && assessmentId && (
            <Link
              href={withPortal(`/admin/assessments/${assessmentId}`, portalBase)}
              className="btn-ghost btn-sm"
              style={{ alignSelf: "flex-start", fontSize: "0.72rem" }}
            >
              Open assessment ledger
            </Link>
          )}
          {hasCollected && (
            <p
              style={{
                fontSize: "0.72rem",
                margin: 0,
                color: cancelBlockedByPayments ? "var(--color-error)" : "var(--color-warning, #b45309)",
              }}
            >
              {cancelBlockedByPayments ? (
                <>
                  Ledger shows {formatPhp(paid)} collected. Void posted payments (Cashier) first,
                  then cancel. Ask an admin only if policy requires cancelling without voiding in the
                  system.
                </>
              ) : (
                <>
                  Ledger shows {formatPhp(paid)} collected. Prefer voiding payments before cancel.
                  As admin you may proceed with a detailed audit reason (≥15 characters); this does
                  not replace proper voiding for accounting.
                </>
              )}
            </p>
          )}
          <textarea
            name="cancelRemarks"
            className="form-control"
            rows={hasCollected && canCancelWithBalance ? 4 : 2}
            placeholder={
              hasCollected && canCancelWithBalance
                ? "Detailed audit reason (required, ≥15 characters)…"
                : "Reason for cancellation…"
            }
            style={{ padding: "0.35rem 0.45rem", fontSize: "0.75rem", width: "100%" }}
          />
          <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="submit"
              className="btn-danger btn-sm"
              disabled={pending || cancelBlockedByPayments}
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShow(false)}>
              ✕
            </button>
          </div>
        </form>
      )}
      {remarksError && (
        <p style={{ fontSize: "0.72rem", color: "var(--color-error)", marginTop: "0.2rem" }}>
          {remarksError}
        </p>
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
  en,
  canCancel,
  canCancelWithBalance,
  portalBase,
}: {
  en: Enrollment;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  portalBase: "/admin" | "/staff";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
        <Link href={withPortal(`/admin/students/${en.studentId}`, portalBase)} className="btn-ghost btn-sm">
          Student
        </Link>
        <Link href={withPortal("/admin/assessments?view=ledgers", portalBase)} className="btn-ghost btn-sm">
          Ledgers
        </Link>
      </div>
      {canCancel && (
        <CancelInline
          enrollmentId={en.id}
          status={en.status}
          assessmentId={en.assessmentId}
          assessmentTotalPaid={en.assessmentTotalPaid}
          canCancelWithBalance={canCancelWithBalance}
          portalBase={portalBase}
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
  portalBase,
}: {
  en: Enrollment;
  sections: Section[];
  canManage: boolean;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
  portalBase: "/admin" | "/staff";
}) {
  const viewStudent = (
    <Link href={withPortal(`/admin/students/${en.studentId}`, portalBase)} className="btn-ghost btn-sm">
      Student
    </Link>
  );

  if (en.status === "cancelled") {
    return (
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {viewStudent}
        {canManage && (
          <Link
            href={`${withPortal("/admin/enrollments/new", portalBase)}?studentId=${en.studentId}`}
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
        portalBase={portalBase}
      />
    );
  }

  if (en.status === "pending") {
    if (!canManage) {
      return <div style={{ display: "flex", gap: "0.35rem" }}>{viewStudent}</div>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          <Link href={withPortal(`/admin/assessments/new/${en.id}`, portalBase)} className="btn-secondary btn-sm">
            Build assessment
          </Link>
          {viewStudent}
        </div>
        {canCancel && (
          <CancelInline
            enrollmentId={en.id}
            status={en.status}
            assessmentId={en.assessmentId}
            assessmentTotalPaid={en.assessmentTotalPaid}
            canCancelWithBalance={canCancelWithBalance}
            portalBase={portalBase}
          />
        )}
      </div>
    );
  }

  if (en.status === "assessed") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
          {en.assessmentId ? (
            <Link href={withPortal(`/admin/assessments/${en.assessmentId}`, portalBase)} className="btn-primary btn-sm">
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
        {canCancel && (
          <CancelInline
            enrollmentId={en.id}
            status={en.status}
            assessmentId={en.assessmentId}
            assessmentTotalPaid={en.assessmentTotalPaid}
            canCancelWithBalance={canCancelWithBalance}
            portalBase={portalBase}
          />
        )}
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
  canCancelWithBalance,
  canOverrideEnrolled,
  portalBase = "/admin",
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
                      canCancelWithBalance={canCancelWithBalance}
                      canOverrideEnrolled={canOverrideEnrolled}
                      portalBase={portalBase}
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
