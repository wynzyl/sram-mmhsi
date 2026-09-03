"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useActionState, useMemo } from "react";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import GenerateInvoiceButton from "@/features/finance/components/invoices/GenerateInvoiceButton";
import PostPaymentForm from "./PostPaymentForm";
import PaymentsHistoryTable from "./PaymentsHistoryTable";
import StudentDiscountsList from "@/features/discounts/components/StudentDiscountsList";
import type { StudentDiscountView } from "@/features/discounts";
import { cancelAssessmentAction } from "@/features/assessments/assessments.actions";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";

export type LedgerLineItem = {
  id: string;
  description: string;
  amount: string;
  isDiscount: boolean;
  feeItemTypeId: string | null;
  sourceAssessmentId: string | null;
};

export type LedgerPaymentRow = {
  id: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  referenceNumber: string | null;
  /** Cashier / user who posted the payment (`payments.created_by`). */
  processedBy: string | null;
  /** Payment kind: 'payment' (original) or 'reversal' (offsetting entry) */
  kind?: string;
  /** For reversal rows: links to the original payment */
  reversesPaymentId?: string | null;
  /** Manual entry flag: true when payment was entered retroactively from offline receipt */
  isManualEntry?: boolean;
};

export type PendingVoidRequestInfo = {
  requestId: string;
  requestedBy: string;
  requestedByUsername: string;
};

type ActiveBooklet = {
  id: string;
  series: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
};

export type AssessmentLedgerRegisterProps = {
  /** Base path for student profile links (staff operational shell). */
  studentRecordsBasePath?: string;
  assessment: {
    id: string;
    studentId: string;
    studentRef: string;
    studentLastName: string;
    studentFirstName: string;
    schoolYear: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
    billingStatus: string;
    transferredAt: string | null;
    transferredToAssessmentId: string | null;
    /** Enrollment status - needed for cancel button visibility */
    enrollmentStatus: "pending" | "assessed" | "enrolled" | "cancelled";
  };
  items: LedgerLineItem[];
  payments: LedgerPaymentRow[];
  activeBooklets: ActiveBooklet[];
  canPost: boolean;
  /** Whether user can request voids (replaces legacy canVoid) */
  canRequestVoid: boolean;
  /** Map of paymentId -> pending void request info */
  pendingVoidByPaymentId?: Record<string, PendingVoidRequestInfo>;
  /** Current user ID (for cancel button visibility) */
  currentUserId?: string;
  balanceForwardTypeId: string | null;
  /** Parent enrollment id — backs the "Back to enrollment" link. */
  enrollmentId: string;
  /** Applied + reversed discount snapshots for this assessment. */
  appliedDiscounts: StudentDiscountView[];
  /** Gates the Reverse Discount button. `discounts:manage` (finance / admin). */
  canReverseDiscount: boolean;
  /** Gates the "Request replacement →" deep link. `discounts:request` (registrar / admin). */
  canRequestDiscount: boolean;
  /** Gates the Cancel Assessment button. `assessments:cancel` (finance_officer / admin). */
  canCancel?: boolean;
  /** Default booklet ID for pre-selection (from cashier's assigned default) */
  defaultBookletId?: string | null;
  /** Manual entry suggestions for pre-filling date and OR number */
  manualSuggestions?: {
    lastManualPaymentDate: string | null;
    suggestedOrNumbers: { bookletId: string; series: string; nextOr: string }[];
  } | null;
  /** ID of the most recent voidable payment (accounting integrity: void in reverse order). */
  mostRecentVoidablePaymentId?: string | null;
  /**
   * True when this assessment's enrollment is cancelled AND the student has an
   * active enrollment for the same school year. Payments/invoices are blocked
   * here — settle on the active enrollment instead. Computed server-side.
   */
  cancelledWithActiveEnrollment?: boolean;
  /** Slot for SPED fee management component (rendered in actions area) */
  spedFeeSlot?: ReactNode;
};

function lineSignedAmount(item: LedgerLineItem): number {
  const n = Number(item.amount);
  return item.isDiscount ? -n : n;
}

/** Clamp a value between 0–100 for the progress bar. */
function paidPercent(paid: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (paid / total) * 100));
}

export default function AssessmentLedgerRegister({
  studentRecordsBasePath = "/staff/students",
  assessment,
  items,
  payments,
  activeBooklets,
  canPost,
  canRequestVoid,
  pendingVoidByPaymentId = {},
  currentUserId,
  balanceForwardTypeId,
  enrollmentId,
  appliedDiscounts,
  canReverseDiscount,
  canRequestDiscount,
  canCancel = false,
  defaultBookletId,
  manualSuggestions,
  mostRecentVoidablePaymentId,
  cancelledWithActiveEnrollment = false,
  spedFeeSlot,
}: AssessmentLedgerRegisterProps) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [formNonce, setFormNonce] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelRemarks, setCancelRemarks] = useState("");
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelAssessmentAction, {});

  useFormToast(cancelState, {
    successMessage: "Assessment cancelled successfully",
    onSuccess: () => {
      setCancelOpen(false);
      setCancelRemarks("");
      router.refresh();
    },
  });

  const totalNum  = Number(assessment.totalAmount);
  const paidNum   = Number(assessment.totalPaid);
  const balanceNum = Number(assessment.balance);
  const isFullyPaid = assessment.billingStatus === "fully_paid";
  const isCancelled = assessment.billingStatus === "cancelled";
  const isTransferred = assessment.transferredAt != null;
  // Allow payments for cancelled enrollments to settle outstanding balances/clearances,
  // UNLESS the student has an active enrollment for the same school year (pay there instead).
  const canOpenPay = canPost && !isFullyPaid && !isTransferred && balanceNum > 0 && !cancelledWithActiveEnrollment;

  // Check for balance forward items (visual indicator only - action handles reversal)
  const hasBalanceForwardItems = items.some(
    (item) => balanceForwardTypeId && item.feeItemTypeId === balanceForwardTypeId
  );

  // Cancel button visibility logic (per CANCELLATION.md spec)
  // Requirements:
  // 1. billingStatus === 'outstanding'
  // 2. enrollment.status === 'assessed'
  // 3. No posted payments (hard block, no admin override)
  const hasPostedPayments = paidNum > 0.009; // OUTSTANDING_PAYMENT_EPSILON
  const isEnrollmentAssessed = assessment.enrollmentStatus === "assessed";
  const isOutstanding = assessment.billingStatus === "outstanding";

  // Cancellation is blocked if any payments exist (no override allowed per spec)
  const cancelBlockedByPayments = hasPostedPayments;

  // Show cancel button only when all conditions are met
  const canShowCancelButton =
    canCancel &&
    isOutstanding &&
    isEnrollmentAssessed &&
    !cancelBlockedByPayments;

  const feesRunning = items.reduce((sum, row) => sum + lineSignedAmount(row), 0);
  const postedPayments = payments.filter((p) => p.status === "posted");
  const paymentsRecorded = postedPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );

  const percent = paidPercent(paidNum, totalNum);

  const openPayment = useCallback(() => {
    setFormNonce((n) => n + 1);
    setPayOpen(true);
  }, []);

  const closePayment = useCallback(() => setPayOpen(false), []);

  const onPosted = useCallback(() => {
    setPayOpen(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!payOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPayOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [payOpen]);

  // Memoize payment row transformation to prevent new Date objects on every render
  const payUiRows = useMemo(
    () => payments.map((p) => ({
      ...p,
      paymentDate: new Date(p.paymentDate),
    })),
    [payments]
  );

  return (
    <div className="flex flex-col gap-6 max-w-[1180px] mx-auto px-6 pt-6 pb-12 text-foreground">
      {/* ── Header card ── */}
      <header className="relative grid grid-cols-[1fr_auto] gap-x-8 gap-y-6 p-7 bg-card border border-border rounded-lg overflow-hidden [grid-template-areas:'identity_actions''tiles_tiles'] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-primary max-md:grid-cols-1 max-md:[grid-template-areas:'identity''actions''tiles'] max-md:p-5">
        {/* Left: identity */}
        <div className="[grid-area:identity] flex flex-col gap-1.5 min-w-0">
          <p className="m-0 text-[11px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">Billing ledger · Cashier view</p>
          <h1 className="m-0 text-[26px] leading-tight font-semibold tracking-tight text-foreground">
            {assessment.studentLastName}, {assessment.studentFirstName}
          </h1>
          <p className="m-0 flex items-center flex-wrap gap-2 text-[13px] text-muted-foreground">
            <span>School year {assessment.schoolYear}</span>
            <span className="opacity-55" aria-hidden>·</span>
            <Link
              href={`${studentRecordsBasePath}/${assessment.studentRef}`}
              className="text-primary font-medium no-underline border-b border-dashed border-primary/45 transition-colors hover:border-current"
            >
              Open student record ↗
            </Link>
            <span className="opacity-55" aria-hidden>·</span>
            <Link
              href={`/staff/enrollments/${enrollmentId}`}
              className="text-primary font-medium no-underline border-b border-dashed border-primary/45 transition-colors hover:border-current"
            >
              ← Back to enrollment
            </Link>
          </p>
        </div>

        {/* Right: actions */}
        <div className="[grid-area:actions] flex items-start justify-end gap-2 flex-wrap max-md:justify-start">
          {canOpenPay && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 bg-primary text-primary-foreground text-[13px] font-semibold tracking-[0.005em] border border-primary/80 rounded-md cursor-pointer shadow-sm transition-colors hover:bg-primary/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              onClick={openPayment}
            >
              {/* Receipt icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="opacity-95">
                <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              Receive payment
            </button>
          )}
          {/* SPED Fee management slot */}
          {spedFeeSlot}
          <GenerateInvoiceButton
            assessmentId={assessment.id}
            balance={balanceNum}
            disabled={cancelledWithActiveEnrollment}
            disabledReason="Student has an active enrollment for this school year"
          />
          {canShowCancelButton && !cancelOpen && (
            <button
              type="button"
              className="inline-flex items-center justify-center gap-[0.45rem] h-[38px] min-w-[140px] px-4 bg-transparent text-destructive text-[13px] font-semibold tracking-[0.005em] border border-destructive rounded-md cursor-pointer transition-colors hover:bg-destructive hover:text-destructive-foreground active:translate-y-px focus-visible:outline-2 focus-visible:outline-destructive focus-visible:outline-offset-2"
              onClick={() => setCancelOpen(true)}
            >
              {/* X icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="opacity-90">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Cancel Assessment
            </button>
          )}
        </div>

        {/* Bottom: KPI tiles + progress bar */}
        <div className="[grid-area:tiles] flex flex-col">
          {/* Progress bar */}
          <div
            className="h-1 rounded-full bg-border/80 mb-4 overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(percent)}% of assessed fees paid`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${isFullyPaid ? "bg-success" : "bg-primary"}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-1">
            {/* Total assessed */}
            <div className="flex flex-col gap-1 p-[0.875rem_1.05rem] bg-muted/55 border border-border rounded-lg min-w-0">
              <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Total assessed</span>
              <span className="text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-foreground inline-flex items-baseline gap-1.5">
                <CurrencyDisplay amount={totalNum} />
              </span>
            </div>

            {/* Total paid */}
            <div className="flex flex-col gap-1 p-[0.875rem_1.05rem] bg-muted/55 border border-border rounded-lg min-w-0">
              <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Total paid</span>
              <span className="text-[22px] font-semibold leading-tight tracking-tight tabular-nums text-success inline-flex items-baseline gap-1.5">
                <CurrencyDisplay amount={paidNum} />
              </span>
              {totalNum > 0 && (
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {Math.round(percent)}% of total
                </span>
              )}
            </div>

            {/* Balance due */}
            <div className="flex flex-col gap-1 p-[0.875rem_1.05rem] bg-muted/55 border border-border rounded-lg min-w-0">
              <span className="text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">Balance due</span>
              <span className={cn(
                "text-[22px] font-semibold leading-tight tracking-tight tabular-nums inline-flex items-baseline gap-1.5",
                !isFullyPaid && !isCancelled && !isTransferred && balanceNum > 0 ? "text-primary" : "text-foreground"
              )}>
                {isCancelled ? (
                  <StatusBadge type="billing" status="cancelled" />
                ) : isTransferred ? (
                  <StatusBadge type="billing" status="balance_forwarded" />
                ) : isFullyPaid ? (
                  <StatusBadge type="billing" status="fully_paid" />
                ) : (
                  <CurrencyDisplay amount={balanceNum} />
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Transfer Warning Banner ── */}
      {assessment.transferredAt && (
        <div
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
            background: "color-mix(in srgb, #f59e0b 8%, transparent)",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: "2px" }}
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#f59e0b" }}>
                Balance Transferred
              </p>
              <p style={{ fontSize: "0.875rem", lineHeight: "1.5", color: "var(--foreground)" }}>
                This assessment&apos;s outstanding balance was transferred to a newer school year on{" "}
                {formatDate(assessment.transferredAt, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}.
                {" "}Payment posting and voiding are disabled for this ledger.
                {assessment.transferredToAssessmentId && (
                  <>
                    {" "}
                    <Link
                      href={`/staff/assessments/${assessment.transferredToAssessmentId}`}
                      className="text-primary underline"
                    >
                      View current year assessment →
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancelled with Active Enrollment Warning Banner ── */}
      {cancelledWithActiveEnrollment && (
        <div
          style={{
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
            borderRadius: "6px",
            border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)",
            background: "color-mix(in srgb, #f59e0b 8%, transparent)",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: "2px" }}
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p style={{ fontWeight: 600, marginBottom: "0.25rem", color: "#f59e0b" }}>
                Payments Not Available
              </p>
              <p style={{ fontSize: "0.875rem", lineHeight: "1.5", color: "var(--foreground)" }}>
                This enrollment was cancelled. The student has an active enrollment for this school year.
                {" "}Please process payments on the active enrollment instead.
                {" "}
                <Link
                  href={`/staff/enrollments/${enrollmentId}`}
                  className="text-primary underline"
                >
                  ← Back to enrollment
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Assessment Form ── */}
      {cancelOpen && canShowCancelButton && (
        <div className="p-4 mb-6 rounded-md border border-destructive/30 bg-destructive/5">
          <div className="flex gap-3 items-start">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="stroke-destructive shrink-0 mt-0.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold mb-2 text-destructive">
                Cancel Assessment
              </p>

              {/* Information about what cancellation will do */}
              <div
                style={{
                  fontSize: "0.75rem",
                  lineHeight: "1.6",
                  marginBottom: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "4px",
                  background: "color-mix(in srgb, #f59e0b 10%, transparent)",
                  color: "rgb(120, 53, 15)",
                }}
              >
                <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>This action will:</p>
                <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
                  <li>Mark the assessment as cancelled</li>
                  <li>Revert enrollment status from &quot;assessed&quot; to &quot;pending&quot;</li>
                  {hasBalanceForwardItems && (
                    <li>Reverse all balance forwards (restore prior year balances)</li>
                  )}
                  {appliedDiscounts.length > 0 && (
                    <li>Remove {appliedDiscounts.length} applied discount{appliedDiscounts.length !== 1 ? "s" : ""} (must re-request)</li>
                  )}
                </ul>
              </div>

              <form action={cancelAction}>
                <input type="hidden" name="assessmentId" value={assessment.id} />

                <TextAreaField
                  label="Cancellation reason"
                  name="remarks"
                  required
                  value={cancelRemarks}
                  onChange={setCancelRemarks}
                  error={cancelState.errors?.remarks}
                  rows={3}
                  placeholder="Enter reason for cancellation (required)..."
                  className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-border"
                />

                <div className="flex gap-2 mt-3">
                  <button
                    type="submit"
                    disabled={cancelPending}
                    className="px-4 py-2 rounded-md text-sm font-semibold text-destructive-foreground bg-destructive border-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
                  >
                    {cancelPending ? "Cancelling..." : "Confirm Cancellation"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCancelOpen(false);
                      setCancelRemarks("");
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "6px",
                      fontSize: "0.875rem",
                      color: "var(--muted-foreground)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 gap-5 items-start">
        {/* Fee Assessment table */}
        <section className="bg-card border border-border rounded-lg overflow-hidden" aria-labelledby="ledger-fees-heading">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/35">
            <h2 id="ledger-fees-heading" className="m-0 text-[13.5px] font-semibold tracking-[0.02em] text-foreground">
              Fee assessment
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {items.length} line{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th scope="col" className="text-left text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground px-5 py-3 border-b border-border bg-muted/25">Description</th>
                  <th scope="col" className="text-right text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted-foreground px-5 py-3 border-b border-border bg-muted/25 tabular-nums whitespace-nowrap">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-8 px-4 text-muted-foreground italic text-[13px]">
                      No fee lines on this assessment.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isBalanceForward = balanceForwardTypeId && item.feeItemTypeId === balanceForwardTypeId;
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "hover:bg-primary/5",
                          isBalanceForward && "bg-warning/5 border-l-4 border-l-amber-500/50"
                        )}
                      >
                        <td className="px-5 py-2.5 border-b border-border/60 text-foreground align-middle">
                          {item.isDiscount && (
                            <span className="text-[10px] font-bold tracking-[0.08em] uppercase text-success mr-1.5">
                              DISC
                            </span>
                          )}
                          {isBalanceForward && (
                            <span className="inline-block text-[10px] font-bold tracking-[0.08em] uppercase text-warning bg-warning/15 px-1.5 py-0.5 rounded mr-2">
                              PREVIOUS YEAR
                            </span>
                          )}
                          {item.description}
                        </td>
                        <td className="text-right px-5 py-2.5 border-b border-border/60 tabular-nums whitespace-nowrap align-middle">
                          <span className={item.isDiscount ? "text-success font-medium" : ""}>
                            {item.isDiscount ? "−" : ""}
                            <CurrencyDisplay amount={Number(item.amount)} />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/55">
                  <th scope="row" className="text-left px-5 py-3.5 text-sm font-bold tracking-[0.02em] text-foreground">Total fees</th>
                  <td className="text-right px-5 py-3.5 text-sm font-bold tabular-nums text-primary">
                    <CurrencyDisplay amount={feesRunning} />
                  </td>
                </tr>
                {Math.abs(feesRunning - totalNum) > 0.005 ? (
                  <tr className="bg-warning/10">
                    <td colSpan={2} className="px-5 py-2 text-[11.5px] font-medium text-warning">
                      ⚠ Stored total differs from line sum — stored{" "}
                      <CurrencyDisplay className="font-medium" amount={totalNum} />
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>
        </section>

        {/* Payment history */}
        <section className="bg-card border border-border rounded-lg overflow-hidden" aria-labelledby="ledger-payments-heading">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/35">
            <h2 id="ledger-payments-heading" className="m-0 text-[13.5px] font-semibold tracking-[0.02em] text-foreground">
              Payment history
            </h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {postedPayments.length} posted
            </span>
          </div>
          <div className="p-0">
            <PaymentsHistoryTable
              payments={payUiRows}
              canRequestVoid={canRequestVoid}
              pendingVoidByPaymentId={pendingVoidByPaymentId}
              currentUserId={currentUserId}
              embedded
              mostRecentVoidablePaymentId={mostRecentVoidablePaymentId}
            />
          </div>
          <div className="flex items-center justify-between flex-wrap gap-y-2 gap-x-4 px-5 py-4 border-t border-border bg-muted/25">
            <div className="inline-flex items-baseline gap-2.5">
              <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-muted-foreground">Payments posted</span>
              <span className="text-base font-semibold tabular-nums text-success">
                <CurrencyDisplay amount={paymentsRecorded} />
              </span>
            </div>
            <p className="m-0 text-[11.5px] text-muted-foreground">
              Ledger total paid{" "}
              <CurrencyDisplay amount={paidNum} className="font-medium" />
            </p>
          </div>
        </section>
      </div>

      {/* ── Discounts ── */}
      <section
        className="bg-card border border-border rounded-lg overflow-hidden mt-6"
        aria-labelledby="ledger-discounts-heading"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/35">
          <h2 id="ledger-discounts-heading" className="m-0 text-[13.5px] font-semibold tracking-[0.02em] text-foreground">
            Discounts
          </h2>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {appliedDiscounts.length} record{appliedDiscounts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="p-4">
          <StudentDiscountsList
            discounts={appliedDiscounts}
            canReverse={canReverseDiscount}
            canRequest={canRequestDiscount}
          />
        </div>
      </section>

      {/* ── Payment modal ── */}
      {payOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-5 pb-8 bg-black/60 animate-in fade-in duration-200 no-print"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closePayment()}
        >
          <div
            className="relative w-full max-w-[580px] max-h-[calc(100vh-6rem)] flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashier-modal-title"
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
              <div>
                <p className="m-0 mb-1 text-[11px] font-semibold tracking-[0.14em] uppercase text-primary">Point of payment</p>
                <h2 id="cashier-modal-title" className="m-0 text-[19px] font-semibold tracking-tight text-foreground">
                  Post official receipt payment
                </h2>
                <p className="m-0 mt-1.5 text-[12.5px] text-muted-foreground">
                  {assessment.studentLastName}, {assessment.studentFirstName}
                  {" · "}
                  {assessment.schoolYear}
                </p>
              </div>
              <button
                type="button"
                className="appearance-none bg-transparent border border-transparent text-muted-foreground text-[22px] leading-none w-8 h-8 rounded-md cursor-pointer inline-flex items-center justify-center transition-colors hover:bg-primary/10 hover:text-primary hover:border-primary/30 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                onClick={closePayment}
                aria-label="Close payment form"
              >
                ×
              </button>
            </div>
            <div className="px-6 pt-5 pb-6 overflow-y-auto">
              <PostPaymentForm
                key={formNonce}
                studentId={assessment.studentId}
                assessmentId={assessment.id}
                balance={balanceNum}
                activeBooklets={activeBooklets}
                onCancel={closePayment}
                onPosted={onPosted}
                defaultBookletId={defaultBookletId}
                manualSuggestions={manualSuggestions ?? undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
