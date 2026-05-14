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
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/35 p-2 sm:items-center sm:p-3 md:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cashier-payment-modal-title"
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg max-h-[100dvh] sm:max-h-[calc(100dvh-1.5rem)] md:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Payment processing
            </p>
            <h1
              id="cashier-payment-modal-title"
              className="mt-0.5 font-display text-lg font-extrabold text-charcoal md:text-xl"
            >
              {studentName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <ReferenceCode code={referenceNumber} />
              <span className="text-xs text-[var(--color-text-2)] md:text-sm">{gradeLevel}</span>
              <span className="text-xs text-[var(--color-text-muted)] md:text-sm" aria-hidden>
                ·
              </span>
              <span className="text-xs text-[var(--color-text-2)] md:text-sm">{schoolYear}</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => router.push("/staff/payments")}
            >
              Back to queue
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 md:px-4 md:py-4">
          <div className="grid grid-cols-1 gap-3 md:gap-4 lg:grid-cols-12">
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


