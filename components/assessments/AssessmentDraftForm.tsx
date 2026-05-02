"use client";

import { useActionState, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAssessmentFromEnrollmentAction } from "@/actions/assessments";
import type { AssessmentFormState } from "@/lib/validators/assessment";

/** Rows in the flat school-year fee catalog (Finance → Fee schedules). */
export interface FeeCatalogEntry {
  feeScheduleItemId: string;
  description: string;
  defaultAmount: string;
  isDiscount: boolean;
}

interface AssessmentLineRow {
  rowKey: string;
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
  /** Lookup list: fees defined for this enrollment's school year. */
  feeCatalog: FeeCatalogEntry[];
  submitBlockedReason?: string | null;
}

const initialAssessmentState: AssessmentFormState = {};

function newRowKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AssessmentDraftForm({
  enrollmentId,
  studentLabel,
  schoolYearLabel,
  gradeLabel,
  feeCatalog,
  submitBlockedReason,
}: AssessmentDraftFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createAssessmentFromEnrollmentAction,
    initialAssessmentState
  );

  const [rows, setRows] = useState<AssessmentLineRow[]>([]);

  const catalogById = useMemo(
    () => new Map(feeCatalog.map((e) => [e.feeScheduleItemId, e])),
    [feeCatalog]
  );

  const usedIds = useMemo(
    () => new Set(rows.map((r) => r.feeScheduleItemId).filter(Boolean)),
    [rows]
  );

  const addLineFromCatalogId = useCallback(
    (feeScheduleItemId: string) => {
      const entry = catalogById.get(feeScheduleItemId);
      if (!entry || usedIds.has(feeScheduleItemId)) return;
      setRows((prev) => [
        ...prev,
        {
          rowKey: newRowKey(),
          feeScheduleItemId: entry.feeScheduleItemId,
          description: entry.description,
          amount: String(entry.defaultAmount),
          isDiscount: entry.isDiscount,
        },
      ]);
    },
    [catalogById, usedIds]
  );

  const removeRow = useCallback((rowKey: string) => {
    setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
  }, []);

  const setRowAmount = useCallback((rowKey: string, amount: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowKey === rowKey ? { ...r, amount } : r))
    );
  }, []);

  const changeRowFee = useCallback(
    (rowKey: string, nextFeeScheduleItemId: string) => {
      const entry = catalogById.get(nextFeeScheduleItemId);
      if (!entry) return;
      setRows((prev) =>
        prev.map((r) =>
          r.rowKey === rowKey
            ? {
                ...r,
                feeScheduleItemId: entry.feeScheduleItemId,
                description: entry.description,
                amount: String(entry.defaultAmount),
                isDiscount: entry.isDiscount,
              }
            : r
        )
      );
    },
    [catalogById]
  );

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
  const availableToAdd = feeCatalog.filter((c) => !usedIds.has(c.feeScheduleItemId));
  const [addSelectValue, setAddSelectValue] = useState("");

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
          Fees are picked from the school-year catalog maintained under Finance → Fee schedules. Add
          one catalog line at a time; amounts can be adjusted for this student before saving.
        </p>

        {!blocked && availableToAdd.length > 0 && (
          <div className="form-group" style={{ marginBottom: "1rem", maxWidth: "28rem" }}>
            <label className="form-label" htmlFor="add-catalog-fee">
              Add fee from catalog
            </label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <select
                id="add-catalog-fee"
                className="form-control"
                value={addSelectValue}
                disabled={pending}
                onChange={(e) => {
                  const v = e.target.value;
                  setAddSelectValue("");
                  if (v) addLineFromCatalogId(v);
                }}
              >
                <option value="">Select a fee…</option>
                {availableToAdd.map((c) => (
                  <option key={c.feeScheduleItemId} value={c.feeScheduleItemId}>
                    {c.description}
                    {c.isDiscount ? " (discount)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <p className="text-muted">
            {blocked
              ? "Fix the warning above before adding assessment lines."
              : "Choose a catalog fee above to add your first assessment line."}
          </p>
        ) : (
          <div className="table-wrapper" style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fee (catalog)</th>
                  <th style={{ width: "9rem", textAlign: "right" }}>Amount</th>
                  <th style={{ width: "7rem", textAlign: "center" }}>Discount?</th>
                  <th style={{ width: "5rem", textAlign: "center" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const selectable = feeCatalog.filter(
                    (c) =>
                      c.feeScheduleItemId === row.feeScheduleItemId ||
                      !usedIds.has(c.feeScheduleItemId)
                  );
                  return (
                    <tr key={row.rowKey}>
                      <td>
                        <select
                          className="form-control"
                          aria-label={`Line ${index + 1} fee type`}
                          disabled={blocked || pending}
                          value={row.feeScheduleItemId}
                          onChange={(e) => changeRowFee(row.rowKey, e.target.value)}
                        >
                          {selectable.map((c) => (
                            <option key={c.feeScheduleItemId} value={c.feeScheduleItemId}>
                              {c.description}
                              {c.isDiscount ? " (discount)" : ""}
                            </option>
                          ))}
                        </select>
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
                          onChange={(e) =>
                            setRowAmount(row.rowKey, e.target.value)
                          }
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
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          disabled={blocked || pending}
                          onClick={() => removeRow(row.rowKey)}
                          aria-label={`Remove ${row.description}`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
        <button
          type="submit"
          className="btn-primary"
          disabled={pending || blocked || rows.length === 0}
        >
          {pending ? "Saving…" : "Save assessment"}
        </button>
      </div>
    </form>
  );
}
