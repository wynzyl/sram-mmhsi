"use client";

import { useActionState, useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAssessmentFromEnrollmentAction } from "@/actions/assessments";
import type { AssessmentFormState } from "@/lib/validators/assessment";

/** One row per fee schedule catalog line — amounts editable only here. */
export interface AssessmentScheduleLine {
  feeScheduleItemId: string;
  description: string;
  defaultAmount: string;
  isDiscount: boolean;
}

interface LineRow {
  feeScheduleItemId: string;
  description: string;
  amount: string;
  isDiscount: boolean;
}

interface AssessmentDraftFormProps {
  enrollmentId: string;
  studentLabel: string;
  schoolYearLabel: string;
  gradeLabel: string;
  scheduleLines: AssessmentScheduleLine[];
  submitBlockedReason?: string | null;
}

const initialAssessmentState: AssessmentFormState = {};

export default function AssessmentDraftForm({
  enrollmentId,
  studentLabel,
  schoolYearLabel,
  gradeLabel,
  scheduleLines,
  submitBlockedReason,
}: AssessmentDraftFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createAssessmentFromEnrollmentAction,
    initialAssessmentState
  );

  const [rows, setRows] = useState<LineRow[]>(() =>
    scheduleLines.map((l) => ({
      feeScheduleItemId: l.feeScheduleItemId,
      description: l.description,
      amount: String(l.defaultAmount),
      isDiscount: l.isDiscount,
    }))
  );

  useEffect(() => {
    setRows(
      scheduleLines.map((l) => ({
        feeScheduleItemId: l.feeScheduleItemId,
        description: l.description,
        amount: String(l.defaultAmount),
        isDiscount: l.isDiscount,
      }))
    );
  }, [scheduleLines]);

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          feeScheduleItemId: r.feeScheduleItemId,
          amount: r.amount,
        }))
      ),
    [rows]
  );

  useEffect(() => {
    if (state.success && state.assessmentId) {
      router.replace(`/admin/assessments/${state.assessmentId}`);
    }
  }, [state.success, state.assessmentId, router]);

  const blocked = !!submitBlockedReason;

  return (
    <form action={action} className="student-form">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="items" value={itemsJson} />

      {submitBlockedReason && (
        <div className="alert alert-warning" role="alert">
          {submitBlockedReason}
        </div>
      )}

      {state.message && (
        <div className="alert alert-error" role="alert">
          {state.message}
        </div>
      )}

      <section className="form-section">
        <h3 className="form-section-title">Enrollment</h3>
        <p className="text-muted" style={{ marginBottom: "0.75rem" }}>
          <strong>{studentLabel}</strong> · {schoolYearLabel} · {gradeLabel}
        </p>
      </section>

      <section className="form-section">
        <h3 className="form-section-title">Assessment lines</h3>
        <p className="text-muted" style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          Fee types come from Finance → Fee schedules for this school year. Only amounts can be
          changed here for this student.
        </p>

        {rows.length === 0 ? (
          <p className="text-muted">No catalog lines loaded.</p>
        ) : (
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fee (from schedule)</th>
                  <th style={{ width: "9rem", textAlign: "right" }}>Amount</th>
                  <th style={{ width: "7rem", textAlign: "center" }}>Discount?</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.feeScheduleItemId}>
                    <td>
                      <span>{row.description}</span>
                    </td>
                    <td>
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={blocked}
                        aria-label={`Line ${index + 1} amount (${row.description})`}
                        value={row.amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRows((prev) =>
                            prev.map((r) =>
                              r.feeScheduleItemId === row.feeScheduleItemId
                                ? { ...r, amount: v }
                                : r
                            )
                          );
                        }}
                      />
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={row.isDiscount}
                        disabled
                        readOnly
                        tabIndex={-1}
                        aria-label={`${row.description} is discount line`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="form-section">
        <div className="form-group">
          <label className="form-label" htmlFor="remarks">
            Remarks (optional)
          </label>
          <textarea
            id="remarks"
            name="remarks"
            className="form-control"
            rows={2}
            disabled={blocked}
          />
        </div>
      </section>

      <div className="form-actions">
        <Link href="/admin/assessments" className="btn-ghost">
          Back
        </Link>
        <button type="submit" className="btn-primary" disabled={pending || blocked}>
          {pending ? "Saving…" : "Save assessment"}
        </button>
      </div>
    </form>
  );
}
