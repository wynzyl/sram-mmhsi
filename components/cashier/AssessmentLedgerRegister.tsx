"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";
import GenerateInvoiceButton from "@/components/finance/invoices/GenerateInvoiceButton";
import PostPaymentForm from "@/components/cashier/PostPaymentForm";
import PaymentsHistoryTable from "@/components/cashier/PaymentsHistoryTable";

export type LedgerLineItem = {
  id: string;
  description: string;
  amount: string;
  isDiscount: boolean;
};

export type LedgerPaymentRow = {
  id: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  referenceNumber: string | null;
};

type ActiveBooklet = {
  id: string;
  series: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
};

export type AssessmentLedgerRegisterProps = {
  assessment: {
    id: string;
    studentId: string;
    studentLastName: string;
    studentFirstName: string;
    schoolYear: string;
    totalAmount: string;
    totalPaid: string;
    balance: string;
  };
  items: LedgerLineItem[];
  payments: LedgerPaymentRow[];
  activeBooklets: ActiveBooklet[];
  canPost: boolean;
  canVoid: boolean;
};

function lineSignedAmount(item: LedgerLineItem): number {
  const n = Number(item.amount);
  return item.isDiscount ? -n : n;
}

export default function AssessmentLedgerRegister({
  assessment,
  items,
  payments,
  activeBooklets,
  canPost,
  canVoid,
}: AssessmentLedgerRegisterProps) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [formNonce, setFormNonce] = useState(0);

  const balanceNum = Number(assessment.balance);
  const canOpenPay = canPost && balanceNum > 0;

  const feesRunning = items.reduce((sum, row) => sum + lineSignedAmount(row), 0);
  const paymentsRecorded = payments
    .filter((p) => p.status !== "voided")
    .reduce((sum, p) => sum + Number(p.amount), 0);

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
      <header className="ledger-register-top">
        <div className="ledger-register-top-main">
          <p className="ledger-register-eyebrow">Billing ledger · Cashier view</p>
          <h1 className="ledger-register-title">
            {assessment.studentLastName}, {assessment.studentFirstName}
          </h1>
          <p className="ledger-register-meta">
            <span>School year {assessment.schoolYear}</span>
            <span className="ledger-register-meta-sep" aria-hidden>
              ·
            </span>
            <Link href={`/admin/students/${assessment.studentId}`} className="ledger-register-student-link">
              Open student record
            </Link>
          </p>
        </div>

        <div className="ledger-register-tiles">
          <div className="ledger-register-tile">
            <span className="ledger-register-tile-label">Total assessed</span>
            <span className="ledger-register-tile-value">
              <CurrencyDisplay amount={Number(assessment.totalAmount)} />
            </span>
          </div>
          <div className="ledger-register-tile ledger-register-tile-paid">
            <span className="ledger-register-tile-label">Total paid</span>
            <span className="ledger-register-tile-value">
              <CurrencyDisplay amount={Number(assessment.totalPaid)} />
            </span>
          </div>
          <div
            className={`ledger-register-tile ledger-register-tile-balance ${balanceNum > 0 ? "ledger-register-tile-owe" : ""}`}
          >
            <span className="ledger-register-tile-label">Balance due</span>
            <span className="ledger-register-tile-value ledger-register-tile-balance-num">
              <CurrencyDisplay amount={balanceNum} />
            </span>
          </div>
        </div>

        <div className="ledger-register-actions">
          {canOpenPay && (
            <button type="button" className="ledger-register-btn-primary" onClick={openPayment}>
              Receive payment
            </button>
          )}
          <GenerateInvoiceButton assessmentId={assessment.id} />
        </div>
      </header>

      <div className="ledger-register-column">
        <section className="ledger-register-section" aria-labelledby="ledger-fees-heading">
          <div className="ledger-register-section-head">
            <h2 id="ledger-fees-heading" className="ledger-register-section-title">
              Fee assessment
            </h2>
          </div>
          <div className="ledger-register-table-wrap">
            <table className="ledger-register-table">
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col" className="ledger-register-th-num">
                    Amount
                  </th>
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
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td className="ledger-register-td-num">
                        <span
                          className={item.isDiscount ? "ledger-register-discount" : ""}
                        >
                          {item.isDiscount ? "−" : ""}
                          <CurrencyDisplay amount={Number(item.amount)} />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="ledger-register-foot-row">
                  <th scope="row">Total fees</th>
                  <td className="ledger-register-td-num ledger-register-foot-value">
                    <CurrencyDisplay amount={feesRunning} />
                  </td>
                </tr>
                {Math.abs(feesRunning - Number(assessment.totalAmount)) > 0.005 ? (
                  <tr className="ledger-register-foot-sub">
                    <td colSpan={2}>
                      Stored assessment total differs from line sum — stored{" "}
                      <CurrencyDisplay
                        className="font-medium"
                        amount={Number(assessment.totalAmount)}
                      />
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>
        </section>

        <section className="ledger-register-section" aria-labelledby="ledger-payments-heading">
          <div className="ledger-register-section-head">
            <h2 id="ledger-payments-heading" className="ledger-register-section-title">
              Payment history
            </h2>
          </div>
          <div className="ledger-register-payments-body">
            <PaymentsHistoryTable payments={payUiRows} canVoid={canVoid} embedded />
          </div>
          <div className="ledger-register-payments-footer">
            <div className="ledger-register-foot-inline">
              <span className="ledger-register-foot-inline-label">Totals (payments posted)</span>
              <span className="ledger-register-foot-inline-value">
                <CurrencyDisplay amount={paymentsRecorded} />
              </span>
            </div>
            <p className="ledger-register-foot-hint">
              Ledger total paid{" "}
              <CurrencyDisplay amount={Number(assessment.totalPaid)} className="font-medium" />
            </p>
          </div>
        </section>
      </div>

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
                  {assessment.studentLastName}, {assessment.studentFirstName} ·{" "}
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
