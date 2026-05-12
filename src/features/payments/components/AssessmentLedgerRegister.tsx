"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import GenerateInvoiceButton from "@/features/finance/components/invoices/GenerateInvoiceButton";
import PostPaymentForm from "./PostPaymentForm";
import PaymentsHistoryTable from "./PaymentsHistoryTable";

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
    studentLastName: string;
    studentFirstName: string;
    schoolYear: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
    billingStatus: string;
    transferredAt: string | null;
    transferredToAssessmentId: string | null;  };
  items: LedgerLineItem[];
  payments: LedgerPaymentRow[];
  activeBooklets: ActiveBooklet[];
  canPost: boolean;
  canVoid: boolean;
  balanceForwardTypeId: string | null;
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
  canVoid,
  balanceForwardTypeId,
}: AssessmentLedgerRegisterProps) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [formNonce, setFormNonce] = useState(0);

  const totalNum  = Number(assessment.totalAmount);
  const paidNum   = Number(assessment.totalPaid);
  const balanceNum = Number(assessment.balance);
  const isFullyPaid = assessment.billingStatus === "fully_paid";
  const isCancelledEnrollment = assessment.billingStatus === "cancelled";
  const isTransferred = assessment.transferredAt != null;
  const canOpenPay = canPost && !isFullyPaid && !isCancelledEnrollment && !isTransferred && balanceNum > 0;

  const feesRunning = items.reduce((sum, row) => sum + lineSignedAmount(row), 0);
  const paymentsRecorded = payments
    .filter((p) => p.status !== "voided")
    .reduce((sum, p) => sum + Number(p.amount), 0);

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

  const payUiRows = payments.map((p) => ({
    ...p,
    paymentDate: new Date(p.paymentDate),
  }));

  return (
    <div className="ledger-register">
      {/* ── Header card ── */}
      <header className="ledger-register-top">
        {/* Left: identity */}
        <div className="ledger-register-top-main">
          <p className="ledger-register-eyebrow">Billing ledger · Cashier view</p>
          <h1 className="ledger-register-title">
            {assessment.studentLastName}, {assessment.studentFirstName}
          </h1>
          <p className="ledger-register-meta">
            <span>School year {assessment.schoolYear}</span>
            <span className="ledger-register-meta-sep" aria-hidden>·</span>
            <Link
              href={`${studentRecordsBasePath}/${assessment.studentId}`}
              className="ledger-register-student-link"
            >
              Open student record ↗
            </Link>
          </p>
        </div>

        {/* Right: actions */}
        <div className="ledger-register-actions">
          {canOpenPay && (
            <button
              type="button"
              className="ledger-register-btn-primary"
              onClick={openPayment}
            >
              {/* Receipt icon */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
              Receive payment
            </button>
          )}
          <GenerateInvoiceButton assessmentId={assessment.id} />
        </div>

        {/* Bottom: KPI tiles + progress bar */}
        <div className="ledger-register-tiles-wrap">
          {/* Progress bar */}
          <div
            style={{
              height: "4px",
              borderRadius: "9999px",
              background: "color-mix(in srgb, var(--color-ops-line) 80%, transparent)",
              marginBottom: "1rem",
              overflow: "hidden",
            }}
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${Math.round(percent)}% of assessed fees paid`}
          >
            <div
              style={{
                height: "100%",
                width: `${percent}%`,
                borderRadius: "9999px",
                background: isFullyPaid
                  ? "var(--color-ops-positive)"
                  : "var(--color-primary)",
                transition: "width 0.6s ease",
              }}
            />
          </div>

          <div className="ledger-register-tiles">
            {/* Total assessed */}
            <div className="ledger-register-tile">
              <span className="ledger-register-tile-label">Total assessed</span>
              <span className="ledger-register-tile-value">
                <CurrencyDisplay amount={totalNum} />
              </span>
            </div>

            {/* Total paid */}
            <div className="ledger-register-tile ledger-register-tile-paid">
              <span className="ledger-register-tile-label">Total paid</span>
              <span className="ledger-register-tile-value">
                <CurrencyDisplay amount={paidNum} />
              </span>
              {totalNum > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--color-ops-muted)",
                    marginTop: "2px",
                  }}
                >
                  {Math.round(percent)}% of total
                </span>
              )}
            </div>

            {/* Balance due */}
            <div
              className={`ledger-register-tile ledger-register-tile-balance${!isFullyPaid && !isCancelledEnrollment && balanceNum > 0 ? " ledger-register-tile-owe" : ""}`}
            >
              <span className="ledger-register-tile-label">Balance due</span>
              <span className="ledger-register-tile-value ledger-register-tile-balance-num">
                {isCancelledEnrollment ? (
                  <StatusBadge type="billing" status="cancelled" />
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
            border: "1px solid color-mix(in srgb, var(--color-ops-warning) 30%, transparent)",
            background: "color-mix(in srgb, var(--color-ops-warning) 8%, transparent)",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-ops-warning)"
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
              <p style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--color-ops-warning)" }}>
                Balance Transferred
              </p>
              <p style={{ fontSize: "0.875rem", lineHeight: "1.5", color: "var(--color-ops-body)" }}>
                This assessment's outstanding balance was transferred to a newer school year on{" "}
                {new Date(assessment.transferredAt).toLocaleDateString("en-PH", {
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
                      style={{ color: "var(--color-primary)", textDecoration: "underline" }}
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

      {/* ── Two-column body ── */}
      <div className="ledger-register-column">
        {/* Fee Assessment table */}
        <section className="ledger-register-section" aria-labelledby="ledger-fees-heading">
          <div className="ledger-register-section-head">
            <h2 id="ledger-fees-heading" className="ledger-register-section-title">
              Fee assessment
            </h2>
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-ops-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {items.length} line{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="ledger-register-table-wrap">
            <table className="ledger-register-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className="ledger-register-th-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="ledger-register-empty">
                      No fee lines on this assessment.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isBalanceForward = balanceForwardTypeId && item.feeItemTypeId === balanceForwardTypeId;
                    return (
                      <tr
                        key={item.id}
                        style={
                          isBalanceForward
                            ? {
                                backgroundColor: "rgba(245, 158, 11, 0.05)",
                                borderLeft: "4px solid rgba(245, 158, 11, 0.5)",
                              }
                            : undefined
                        }
                      >
                        <td>
                          {item.isDiscount && (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "var(--color-ops-positive)",
                                marginRight: "0.4em",
                              }}
                            >
                              DISC
                            </span>
                          )}
                          {isBalanceForward && (
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "10px",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "rgb(180, 83, 9)",
                                backgroundColor: "rgba(245, 158, 11, 0.15)",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                marginRight: "0.5em",
                              }}
                            >
                              PREVIOUS YEAR
                            </span>
                          )}
                          {item.description}
                        </td>
                        <td className="ledger-register-td-num">
                          <span className={item.isDiscount ? "ledger-register-discount" : ""}>
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
                <tr className="ledger-register-foot-row">
                  <th scope="row">Total fees</th>
                  <td className="ledger-register-td-num ledger-register-foot-value">
                    <CurrencyDisplay amount={feesRunning} />
                  </td>
                </tr>
                {Math.abs(feesRunning - totalNum) > 0.005 ? (
                  <tr className="ledger-register-foot-sub">
                    <td colSpan={2}>
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
        <section className="ledger-register-section" aria-labelledby="ledger-payments-heading">
          <div className="ledger-register-section-head">
            <h2 id="ledger-payments-heading" className="ledger-register-section-title">
              Payment history
            </h2>
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-ops-muted)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {payments.filter((p) => p.status !== "voided").length} posted
            </span>
          </div>
          <div className="ledger-register-payments-body">
            <PaymentsHistoryTable payments={payUiRows} canVoid={canVoid} embedded />
          </div>
          <div className="ledger-register-payments-footer">
            <div className="ledger-register-foot-inline">
              <span className="ledger-register-foot-inline-label">Payments posted</span>
              <span className="ledger-register-foot-inline-value">
                <CurrencyDisplay amount={paymentsRecorded} />
              </span>
            </div>
            <p className="ledger-register-foot-hint">
              Ledger total paid{" "}
              <CurrencyDisplay amount={paidNum} className="font-medium" />
            </p>
          </div>
        </section>
      </div>

      {/* ── Payment modal ── */}
      {payOpen && (
        <div
          className="cashier-modal-backdrop no-print"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closePayment()}
        >
          <div
            className="cashier-modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cashier-modal-title"
          >
            <div className="cashier-modal-header">
              <div>
                <p className="cashier-modal-kicker">Point of payment</p>
                <h2 id="cashier-modal-title" className="cashier-modal-title">
                  Post official receipt payment
                </h2>
                <p className="cashier-modal-sub">
                  {assessment.studentLastName}, {assessment.studentFirstName}
                  {" · "}
                  {assessment.schoolYear}
                </p>
              </div>
              <button
                type="button"
                className="cashier-modal-close"
                onClick={closePayment}
                aria-label="Close payment form"
              >
                ×
              </button>
            </div>
            <div className="cashier-modal-body">
              <PostPaymentForm
                key={formNonce}
                studentId={assessment.studentId}
                assessmentId={assessment.id}
                balance={balanceNum}
                activeBooklets={activeBooklets}
                onCancel={closePayment}
                onPosted={onPosted}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
