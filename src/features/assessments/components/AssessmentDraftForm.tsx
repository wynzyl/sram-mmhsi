"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAssessmentFromEnrollmentAction } from "../assessments.actions";
import { computeAssessmentTotals } from "../assessments.schema";
import type { AssessmentFormState } from "../assessments.schema";
import type { NewAssessmentFeeCatalogEntry, ExpectedDiscountsSummary } from "../new-assessment-context.queries";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import {
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardFooter,
} from "@/components/ui/editorial/DataCard";
import { StatusIndicator } from "@/components/ui/editorial/StatusIndicator";
import type { DiscountRequestView } from "@/features/discounts/discounts.schema";

export type FeeCatalogEntry = NewAssessmentFeeCatalogEntry;

interface AssessmentLineRow {
  rowKey: string;
  feeTemplateItemId: string;
  feeItemTypeId: string;
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
  /** Base path without trailing slash (e.g. `/staff/assessments`). */
  assessmentsBasePath: string;
  /** Route to fee schedule setup page (e.g. `/staff/finance/fee-schedules`). */
  feeSchedulesPath?: string;
  /** Existing discount requests for this enrollment */
  existingDiscountRequests: DiscountRequestView[];
  /** Whether user can review/approve discounts */
  canReviewDiscounts: boolean;
  /** Pre-calculated expected discounts (calculated on server) */
  expectedDiscounts: ExpectedDiscountsSummary;
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
    feeTemplateItemId: entry.feeTemplateItemId,
    feeItemTypeId: entry.feeItemTypeId,
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
  feeSchedulesPath = "/staff/finance/fee-schedules",
  existingDiscountRequests,
  canReviewDiscounts,
  expectedDiscounts,
}: AssessmentDraftFormProps) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createAssessmentFromEnrollmentAction,
    initialAssessmentState
  );

  const rows = useMemo<AssessmentLineRow[]>(
    () => (submitBlockedReason || feeCatalog.length === 0 ? [] : rowsFromCatalog(feeCatalog)),
    [feeCatalog, submitBlockedReason]
  );

  const [remarks, setRemarks] = useState("");

  // Separate discount requests by status
  const pendingRequests = existingDiscountRequests.filter((r) => r.status === "pending");
  const approvedRequests = existingDiscountRequests.filter((r) => r.status === "approved");
  const rejectedRequests = existingDiscountRequests.filter((r) => r.status === "rejected");

  // Format discount value for display
  const formatDiscountValue = (
    calculationType: "fixed_amount" | "percentage",
    value: string
  ) => {
    if (calculationType === "percentage") {
      return `${value}%`;
    }
    return `₱${Number(value).toLocaleString("en-PH")}`;
  };

  // Check if there are pending discounts that block assessment
  const hasPendingDiscounts = pendingRequests.length > 0;

  const itemsJson = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          feeTemplateItemId: r.feeTemplateItemId,
          feeItemTypeId: r.feeItemTypeId,
          amount: r.amount,
        }))
      ),
    [rows]
  );

  // Calculate totals using pre-calculated expected discounts from server
  // (business logic for discount calculation stays on server)
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
    const catalogDisc = safe.filter((r) => r.isDiscount).reduce((a, r) => a + r.amount, 0);

    // Use pre-calculated expected discounts from server
    const totalDisc = catalogDisc + expectedDiscounts.totalExpectedDiscounts;
    const net = gross - totalDisc;

    return {
      grossCharges: gross,
      discountSum: totalDisc,
      netAssessed: net,
    };
  }, [rows, expectedDiscounts.totalExpectedDiscounts]);

  useFormToast(state, {
    successMessage: "Assessment created successfully",
    onSuccess: () => router.replace(`${assessmentsBasePath}/${state.assessmentId}`),
  });

  const blocked = !!submitBlockedReason;
  const formId = "enrollment-assessment-form";

  return (
    <div className="space-y-8">
      {submitBlockedReason && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="alert"
        >
          <p>{submitBlockedReason}</p>
          <p className="mt-2">
            <Link href={feeSchedulesPath} className="font-semibold underline hover:no-underline">
              Open fee setup
            </Link>
          </p>
        </div>
      )}

      <form id={formId} action={action} className="space-y-6">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="items" value={itemsJson} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Student context */}
          <DataCard className="animate-reveal-stagger stagger-delay-1">
            <DataCardHeader>
              <h2 className="font-display text-lg font-bold text-foreground">Student</h2>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <div className="flex gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted font-display text-lg font-bold text-foreground"
                  aria-hidden
                >
                  {studentInitials(studentFirstName, studentLastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-xl font-bold text-foreground">
                      {studentLastName}, {studentFirstName}
                    </h3>
                    {enrollmentStatus === "pending" && (
                      <StatusIndicator status="pending" size="sm" pulse={false} />
                    )}
                  </div>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">{referenceNumber}</p>
                </div>
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4 border-t border-border pt-3">
                  <dt className="text-muted-foreground">Grade</dt>
                  <dd className="text-right font-medium text-foreground">{gradeLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">School year</dt>
                  <dd className="text-right font-medium text-foreground">{schoolYearLabel}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Fee band</dt>
                  <dd className="text-right font-medium text-foreground">{catalogBandLabel}</dd>
                </div>
                {primaryGuardianLabel ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Parent / guardian</dt>
                    <dd className="text-right font-medium text-foreground">{primaryGuardianLabel}</dd>
                  </div>
                ) : null}
              </dl>
            </DataCardBody>
          </DataCard>

          {/* Charges */}
          <DataCard className="animate-reveal-stagger stagger-delay-2">
            <DataCardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">Current charges</h2>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                Draft
              </span>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Lines come from Finance → Fee schedules for this band. This list is read-only on this
                page.
              </p>

              {rows.length === 0 ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    {blocked
                      ? "Fix the warning above before lines can be generated."
                      : "No fee schedule lines are available for this enrollment band."}
                  </p>
                  <Link
                    href={feeSchedulesPath}
                    className="inline-flex rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    Go to fee setup
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-md text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Amount (PHP)</th>
                        <th className="px-3 py-2 text-center">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        return (
                          <tr
                            key={row.rowKey}
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="px-3 py-2 align-middle font-medium text-foreground">
                              {row.description}
                            </td>
                            <td className="px-3 py-2 text-right align-middle tabular-nums text-foreground">
                              <CurrencyDisplay amount={Number.parseFloat(row.amount) || 0} />
                            </td>
                            <td className="px-3 py-2 text-center align-middle">
                              <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                                {row.isDiscount ? "Discount" : "Charge"}
                              </span>
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
                  <span className="font-semibold text-foreground">Gross charges</span>
                  <CurrencyDisplay amount={grossCharges} className="font-semibold text-foreground" />
                </div>
              </DataCardFooter>
            )}
          </DataCard>

          {/* Discount Requests Queue */}
          <DataCard className="animate-reveal-stagger stagger-delay-3">
            <DataCardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-foreground">
                Discount requests
              </h2>
              {hasPendingDiscounts && (
                <span
                  className="rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{
                    backgroundColor:
                      "color-mix(in srgb, var(--warning, #f59e0b) 18%, transparent)",
                    color: "var(--warning, #f59e0b)",
                  }}
                >
                  {pendingRequests.length} pending
                </span>
              )}
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              {/* Pending discount requests - needs review */}
              {pendingRequests.length > 0 && (
                <div className="space-y-2">
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--warning, #f59e0b)" }}
                  >
                    Awaiting approval
                  </p>
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-lg border p-3"
                        style={{
                          backgroundColor:
                            "color-mix(in srgb, var(--warning, #f59e0b) 10%, var(--card))",
                          borderColor:
                            "color-mix(in srgb, var(--warning, #f59e0b) 30%, var(--border))",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {req.discountTypeName}
                              </span>
                              <span
                                className="rounded px-1.5 py-0.5 text-xs font-medium"
                                style={{
                                  backgroundColor:
                                    "color-mix(in srgb, var(--warning, #f59e0b) 18%, transparent)",
                                  color: "var(--warning, #f59e0b)",
                                }}
                              >
                                {formatDiscountValue(req.calculationType, req.defaultValue)}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  req.baseType === "tuition_only"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {req.baseType === "tuition_only" ? "Tuition" : "Full"}
                              </span>
                            </div>
                            {req.requestReason && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Reason: {req.requestReason}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              Requested by {req.requestedByName} on{" "}
                              {new Date(req.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                          {canReviewDiscounts && (
                            <div className="flex shrink-0 gap-1">
                              <a
                                href={`/staff/finance/discount-requests?highlight=${req.id}`}
                                className="rounded bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                              >
                                Review
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div
                    className="rounded-md border px-3 py-2 text-sm"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--warning, #f59e0b) 12%, var(--card))",
                      borderColor:
                        "color-mix(in srgb, var(--warning, #f59e0b) 40%, var(--border))",
                      color: "var(--warning, #f59e0b)",
                    }}
                  >
                    <strong>⚠️ Assessment blocked:</strong> All discount requests must be
                    approved or rejected before creating an assessment.
                    {canReviewDiscounts && (
                      <a
                        href="/staff/finance/discount-requests"
                        className="ml-2 font-semibold underline hover:no-underline"
                      >
                        Go to Discount Queue →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Approved discounts - will be applied */}
              {approvedRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Approved (will be applied)
                  </p>
                  <ul className="space-y-1.5">
                    {expectedDiscounts.items.map((discountPreview) => (
                      <li
                        key={discountPreview.discountRequestId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {discountPreview.discountTypeName}
                          </span>
                          <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                            {formatDiscountValue(discountPreview.calculationType, discountPreview.displayValue)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CurrencyDisplay
                            amount={-discountPreview.calculatedAmount}
                            className="font-semibold"
                          />
                          <span className="rounded px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                            Approved
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-emerald-600">
                    ✓ These discounts will be applied as negative line items when the assessment is saved.
                  </p>
                </div>
              )}

              {/* Rejected discounts - informational */}
              {rejectedRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rejected
                  </p>
                  <ul className="space-y-1">
                    {rejectedRequests.map((req) => (
                      <li
                        key={req.id}
                        className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2 text-sm opacity-60"
                      >
                        <span className="font-medium text-foreground line-through">
                          {req.discountTypeName}
                        </span>
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Rejected
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No discount requests */}
              {existingDiscountRequests.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No discount requests for this enrollment. Discounts can be requested during
                  enrollment or from the student profile page.
                </p>
              )}

              {/* Remarks */}
              <TextAreaField
                label="Registrar remarks (optional)"
                name="remarks"
                variant="editorial"
                rows={3}
                value={remarks}
                onChange={setRemarks}
                disabled={blocked || hasPendingDiscounts}
                placeholder="ESC context, scholarship notes, or other assessment remarks…"
              />
            </DataCardBody>
          </DataCard>

          {/* Summary */}
          <DataCard className="animate-reveal-stagger stagger-delay-4 border-primary/20 bg-muted/80">
            <DataCardHeader>
              <h2 className="font-display text-lg font-bold text-foreground">Assessment summary</h2>
            </DataCardHeader>
            <DataCardBody className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Gross charges</span>
                  <CurrencyDisplay amount={grossCharges} />
                </li>
                <li className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Discount lines</span>
                  <CurrencyDisplay
                    amount={-discountSum}
                    className={discountSum > 0 ? "text-blue-700" : undefined}
                  />
                </li>
                <li className="flex justify-between gap-4 border-t border-dashed border-border pt-3">
                  <span className="font-display font-bold text-foreground">Net assessed balance</span>
                  <CurrencyDisplay
                    amount={netAssessed}
                    className="font-display text-lg font-bold text-primary"
                  />
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                After saving, open the assessment ledger from this enrollment to post payments. Manage
                invoices under Finance when your office uses that workflow.
              </p>
            </DataCardBody>
            <DataCardFooter className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={assessmentsBasePath}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Back
              </Link>
              <button
                type="submit"
                form={formId}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
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
        className="rounded-lg border border-border bg-card px-6 py-5"
        aria-labelledby="assessment-audit-heading"
      >
        <h2
          id="assessment-audit-heading"
          className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground"
        >
          Assessment audit
        </h2>
        <p className="mt-2 text-sm text-foreground">
          This screen is the <strong>only</strong> time an assessment is created for this enrollment.
          When you save, the system records an audit entry (<code className="rounded bg-muted px-1 font-mono text-xs">assessment_created_and_enrollment_assessed</code>),
          locks in the line items you confirmed, and sets the enrollment to <strong>Assessed</strong>.
          Further payment activity is tracked on the ledger, not by re-running this screen.
        </p>
      </section>
    </div>
  );
}
