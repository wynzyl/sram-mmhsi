"use client";

import { useRouter } from "next/navigation";
import PostPaymentForm from "./PostPaymentForm";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ActiveBooklet = {
  id: string;
  series: string;
  prefix: string;
  nextNumber: number;
  endNumber: number;
};

export type CashierPaymentProcessingViewProps = {
  assessmentId: string;
  studentId: string;
  studentName: string;
  referenceNumber: string;
  gradeLevel: string;
  schoolYear: string;
  totals: {
    totalAssessed: number;
    totalPaid: number;
    balance: number;
  };
  lastPayment:
    | {
        amount: number;
        paymentMethod: string;
        paymentDateLabel: string;
        orNumber: string | null;
      }
    | null;
  activeBooklets: ActiveBooklet[];
};

export function CashierPaymentProcessingView({
  assessmentId,
  studentId,
  studentName,
  referenceNumber,
  gradeLevel,
  schoolYear,
  totals,
  lastPayment,
  activeBooklets,
}: CashierPaymentProcessingViewProps) {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-payment-modal-title"
        className="w-full max-w-3xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-lg md:p-4"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Payment processing
              </p>
              <h1
                id="cashier-payment-modal-title"
                className="mt-1 font-display text-xl font-extrabold text-charcoal"
              >
                {studentName}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <ReferenceCode code={referenceNumber} />
                <span className="text-sm text-[var(--color-text-2)]">{gradeLevel}</span>
                <span className="text-sm text-[var(--color-text-muted)]" aria-hidden>
                  ·
                </span>
                <span className="text-sm text-[var(--color-text-2)]">{schoolYear}</span>
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                Close this form only by posting payment, Cancel, or Back.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => router.push("/staff/payments")}
              >
                Back to queue
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-8">
              <CardHeader className="pb-3">
                <CardTitle>Payment details</CardTitle>
              </CardHeader>
              <CardContent>
                <PostPaymentForm
                  studentId={studentId}
                  assessmentId={assessmentId}
                  balance={totals.balance}
                  activeBooklets={activeBooklets}
                  onCancel={() => router.push("/staff/payments")}
                  onPosted={() => router.push("/staff/payments")}
                />
              </CardContent>
            </Card>

            <div className="space-y-4 lg:col-span-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Assessment summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--color-text-muted)]">Total assessed</span>
                    <span className="font-semibold">
                      <CurrencyDisplay amount={totals.totalAssessed} />
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--color-text-muted)]">Paid to date</span>
                    <span className="font-semibold text-[var(--color-success)]">
                      <CurrencyDisplay amount={totals.totalPaid} />
                    </span>
                  </div>
                  <div className="h-px w-full bg-[var(--color-border)]" />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[var(--color-text-muted)]">Remaining balance</span>
                    <span className="font-display text-lg font-black text-[var(--color-primary)]">
                      <CurrencyDisplay amount={totals.balance} />
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Last payment</CardTitle>
                </CardHeader>
                <CardContent>
                  {lastPayment ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">Amount</span>
                        <span className="font-semibold">
                          <CurrencyDisplay amount={lastPayment.amount} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">Method</span>
                        <span className="text-sm font-medium text-[var(--color-text-2)]">
                          {lastPayment.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">Date</span>
                        <span className="text-sm font-medium text-[var(--color-text-2)]">
                          {lastPayment.paymentDateLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-[var(--color-text-muted)]">OR</span>
                        <span className="text-sm font-medium text-[var(--color-text-2)]">
                          {lastPayment.orNumber ? (
                            <ReferenceCode code={lastPayment.orNumber} />
                          ) : (
                            "—"
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--color-text-muted)]">No payments posted yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

