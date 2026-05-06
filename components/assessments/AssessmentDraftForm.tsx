"use client";

import { useActionState, useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAssessmentFromEnrollmentAction } from "@/actions/assessments";
import { computeAssessmentTotals } from "@/lib/validators/assessment";
import type { AssessmentFormState } from "@/lib/validators/assessment";
import type { NewAssessmentFeeCatalogEntry } from "@/lib/queries/new-assessment-context";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { SelectField } from "@/components/forms/SelectField";
import { TextAreaField } from "@/components/forms/TextInputField";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";
import {
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardFooter,
} from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import { cn } from "@/lib/utils/cn";

export type FeeCatalogEntry = NewAssessmentFeeCatalogEntry;

interface AssessmentLineRow {
  rowKey: string;
  feeScheduleItemId: string;
  description: string;
  amount: string;
  isDiscount: boolean;
}

type EnrollmentStatus = "pending" | "assessed" | "enrolled" | "cancelled";

interface AssessmentDraftFormProps {
  enrollmentId: string;
  studentFirstName: string;
  studentLastName: string;
  referenceNumber: string;
  schoolYearLabel: string;
  gradeLabel: string;
  catalogBandLabel: string;
  enrollmentStatus: EnrollmentStatus;
  primaryGuardianLabel?: string | null;
  feeCatalog: FeeCatalogEntry[];
  submitBlockedReason?: string | null;
  /** Base path without trailing slash, e.g. `/admin/assessments` or `/staff/assessments`. */
  assessmentsBasePath: string;
}

const initialAssessmentState: AssessmentFormState = {};

function newRowKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function rowsFromCatalog(catalog: FeeCatalogEntry[]): AssessmentLineRow[] {
  return catalog.map((entry) => ({
    rowKey: newRowKey(),
    feeScheduleItemId: entry.feeScheduleItemId,
    description: entry.description,
    amount: String(entry.defaultAmount),
    isDiscount: entry.isDiscount,
  }));
}

function studentInitials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

export default function AssessmentDraftForm({
  enrollmentId,
  studentFirstName,
  studentLastName,
  referenceNumber,
  schoolYearLabel,
  gradeLabel,
  catalogBandLabel,
  enrollmentStatus,
  primaryGuardianLabel,
  feeCatalog,
  submitBlockedReason,
  assessmentsBasePath,
}: AssessmentDraftFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createAssessmentFromEnrollmentAction,
    initialAssessmentState
  );

  const [rows, setRows] = useState<AssessmentLineRow[]>(() =>
    submitBlockedReason || feeCatalog.length === 0 ? [] : rowsFromCatalog(feeCatalog)
  );

  const [remarks, setRemarks] = useState("");
  const [addSelectValue, setAddSelectValue] = useState("");

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

  const { grossCharges, discountSum, netAssessed } = useMemo(() => {
    const parsed = rows.map((r) => ({
      amount: Number.parseFloat(r.amount),
      isDiscount: r.isDiscount,
    }));
    const safe = parsed.map((r) => ({
      amount: Number.isFinite(r.amount) && r.amount >= 0 ? r.amount : 0,
      isDiscount: r.isDiscount,
    }));
    const gross = safe.filter((r) => !r.isDiscount).reduce((a, r) => a + r.amount, 0);
    const disc = safe.filter((r) => r.isDiscount).reduce((a, r) => a + r.amount, 0);
    const net = computeAssessmentTotals(safe);
    return { grossCharges: gross, discountSum: disc, netAssessed: net };
  }, [rows]);

  useEffect(() => {
    if (state.success && state.assessmentId) {
      router.replace(`${assessmentsBasePath}/${state.assessmentId}`);
    }
  }, [state.success, state.assessmentId, router, assessmentsBasePath]);

  const blocked = !!submitBlockedReason;
  const availableToAdd = feeCatalog.filter((c) => !usedIds.has(c.feeScheduleItemId));
  const formId = "enrollment-assessment-form";

  const addFeeOptions = useMemo(
    () =>
      availableToAdd.map((c) => ({
        value: c.feeScheduleItemId,
        label: `${c.description}${c.isDiscount ? " (discount)" : ""}`,
      })),
    [availableToAdd]
  );

  return (
    <div className="space-y-8">
      <FormStateAlert state={state} />

      {submitBlockedReason && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          {submitBlockedReason}
        </div>
      )}

      <form id={formId} action={action} className="space-y-6">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="items" value={itemsJson} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Student context */}
          <DataCard className="animate-reveal-stagger stagger-delay-1">
            <DataCardHeader>
              <h2 className="font-display text-lg font-bold text-charcoal">Student</h2>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <div className="flex gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface-2)] font-display text-lg font-bold text-charcoal"
                  aria-hidden
                >
                  {studentInitials(studentFirstName, studentLastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-xl font-bold text-charcoal">
                      {studentLastName}, {studentFirstName}
                    </h3>
                    {enrollmentStatus === "pending" && (
                      <StatusIndicator status="pending" size="sm" pulse={false} />
                    )}
                  </div>
                  <p className="mt-1 font-mono text-sm text-warm-gray">{referenceNumber}</p>
                </div>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4 border-t border-[var(--color-border)] pt-3">
                  <dt className="text-warm-gray">Grade</dt>
                  <dd className="text-right font-medium text-charcoal">{gradeLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-warm-gray">School year</dt>
                  <dd className="text-right font-medium text-charcoal">{schoolYearLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-warm-gray">Fee band</dt>
                  <dd className="text-right font-medium text-charcoal">{catalogBandLabel}</dd>
                </div>
                {primaryGuardianLabel ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-warm-gray">Parent / guardian</dt>
                    <dd className="text-right font-medium text-charcoal">{primaryGuardianLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </DataCardBody>
          </DataCard>

          {/* Charges */}
          <DataCard className="animate-reveal-stagger stagger-delay-2">
            <DataCardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-charcoal">Current charges</h2>
              <span className="rounded-md bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                Draft
              </span>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <p className="text-sm text-warm-gray">
                Lines come from Finance → Fee schedules for this band. Adjust amounts or remove lines
                that do not apply.
              </p>

              {!blocked && availableToAdd.length > 0 && (
                <SelectField
                  label="Add fee from catalog"
                  name="addCatalogFee"
                  variant="editorial"
                  placeholder="Select a fee…"
                  value={addSelectValue}
                  disabled={pending}
                  onChange={(v) => {
                    setAddSelectValue("");
                    if (v) addLineFromCatalogId(v);
                  }}
                  options={addFeeOptions}
                />
              )}

              {rows.length === 0 ? (
                <p className="text-sm text-warm-gray">
                  {blocked
                    ? "Fix the warning above before lines can be generated."
                    : "No lines yet. Add fees from the catalog if you removed every line."}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
                  <table className="w-full min-w-[28rem] text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-warm-gray">
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Amount (PHP)</th>
                        <th className="px-3 py-2 text-center">Type</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => {
                        const selectable = feeCatalog.filter(
                          (c) =>
                            c.feeScheduleItemId === row.feeScheduleItemId ||
                            !usedIds.has(c.feeScheduleItemId)
                        );
                        const options = selectable.map((c) => ({
                          value: c.feeScheduleItemId,
                          label: `${c.description}${c.isDiscount ? " (discount)" : ""}`,
                        }));
                        return (
                          <tr
                            key={row.rowKey}
                            className="border-b border-[var(--color-border)] last:border-b-0"
                          >
                            <td className="px-3 py-2 align-top">
                              <label className="sr-only" htmlFor={`feeLine_${row.rowKey}`}>
                                Line {index + 1} fee
                              </label>
                              <select
                                id={`feeLine_${row.rowKey}`}
                                className="input-editorial min-w-[12rem] max-w-full"
                                disabled={blocked || pending}
                                value={row.feeScheduleItemId}
                                onChange={(e) => changeRowFee(row.rowKey, e.target.value)}
                              >
                                {options.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <label className="sr-only" htmlFor={`amountLine_${row.rowKey}`}>
                                Line {index + 1} amount
                              </label>
                              <input
                                id={`amountLine_${row.rowKey}`}
                                type="number"
                                min={0}
                                step="0.01"
                                inputMode="decimal"
                                className="input-editorial w-full text-right tabular-nums"
                                disabled={blocked || pending}
                                value={row.amount}
                                onChange={(e) => {
                                  if (!pending) setRowAmount(row.rowKey, e.target.value);
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-center align-middle">
                              <span
                                className={cn(
                                  "inline-block rounded px-2 py-0.5 text-xs font-medium",
                                  row.isDiscount
                                    ? "bg-blue-50 text-blue-800"
                                    : "bg-[var(--color-surface-2)] text-charcoal"
                                )}
                              >
                                {row.isDiscount ? "Discount" : "Charge"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right align-middle">
                              <button
                                type="button"
                                className="text-sm font-medium text-[var(--color-primary)] hover:underline disabled:opacity-50"
                                disabled={blocked || pending}
                                onClick={() => removeRow(row.rowKey)}
                                aria-label={`Remove line ${index + 1}`}
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
            </DataCardBody>
            {rows.length > 0 && (
              <DataCardFooter>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-charcoal">Gross charges</span>
                  <CurrencyDisplay amount={grossCharges} className="font-semibold text-charcoal" />
                </div>
              </DataCardFooter>
            )}
          </DataCard>

          {/* Adjustments & notes */}
          <DataCard className="animate-reveal-stagger stagger-delay-3">
            <DataCardHeader>
              <h2 className="font-display text-lg font-bold text-charcoal">
                Adjustments &amp; notes
              </h2>
            </DataCardHeader>
            <DataCardBody className="space-y-3">
              <p className="text-sm text-warm-gray">
                Scholarships and fee reductions are modeled as <strong>discount</strong> lines from
                your fee catalog—not as a separate percent field. Add or edit those lines in{" "}
                <strong>Current charges</strong>.
              </p>
              <TextAreaField
                label="Registrar remarks (optional)"
                name="remarks"
                variant="editorial"
                rows={4}
                value={remarks}
                onChange={setRemarks}
                disabled={blocked}
                placeholder="Reason for waivers, ESC context, or other assessment notes…"
              />
            </DataCardBody>
          </DataCard>

          {/* Summary */}
          <DataCard className="animate-reveal-stagger stagger-delay-4 border-[var(--color-primary)]/20 bg-[var(--color-surface-2)]/80">
            <DataCardHeader>
              <h2 className="font-display text-lg font-bold text-charcoal">Assessment summary</h2>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-4">
                  <span className="text-warm-gray">Gross charges</span>
                  <CurrencyDisplay amount={grossCharges} />
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-warm-gray">Discount lines</span>
                  <CurrencyDisplay
                    amount={-discountSum}
                    className={discountSum > 0 ? "text-blue-700" : undefined}
                  />
                </li>
                <li className="flex justify-between gap-4 border-t border-dashed border-[var(--color-border)] pt-3">
                  <span className="font-display font-bold text-charcoal">Net assessed balance</span>
                  <CurrencyDisplay
                    amount={netAssessed}
                    className="font-display text-lg font-bold text-[var(--color-primary)]"
                  />
                </li>
              </ul>
              <p className="text-xs text-warm-gray">
                After saving, open the assessment ledger from this enrollment to post payments. Manage
                invoices under Finance when your office uses that workflow.
              </p>
            </DataCardBody>
            <DataCardFooter className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={assessmentsBasePath}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-charcoal hover:bg-[var(--color-surface-2)]"
              >
                Back
              </Link>
              <button
                type="submit"
                form={formId}
                className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                disabled={pending || blocked || rows.length === 0}
              >
                {pending ? "Saving…" : "Save assessment"}
              </button>
            </DataCardFooter>
          </DataCard>
        </div>
      </form>

      {/* Audit / finalization callout */}
      <section
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5"
        aria-labelledby="assessment-audit-heading"
      >
        <h2
          id="assessment-audit-heading"
          className="font-display text-sm font-bold uppercase tracking-wider text-warm-gray"
        >
          Assessment audit
        </h2>
        <p className="mt-2 text-sm text-charcoal">
          This screen is the <strong>only</strong> time an assessment is created for this enrollment.
          When you save, the system records an audit entry (<code className="rounded bg-[var(--color-surface-2)] px-1 font-mono text-xs">assessment_created_and_enrollment_assessed</code>),
          locks in the line items you confirmed, and sets the enrollment to <strong>Assessed</strong>.
          Further payment activity is tracked on the ledger, not by re-running this screen.
        </p>
      </section>
    </div>
  );
}
