"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { formatDate } from "@/lib/utils/date";
import { CashierQueueTable } from "@/features/payments/components/CashierQueueTable";
import { useCashierQueue } from "@/features/payments/hooks/use-cashier-queue";

export function CashierDashboardView() {
  const query = useCashierQueue();
  const data = query.data;

  const stats = data?.stats ?? {
    totalCollectedToday: 0,
    pendingPaymentsCount: 0,
    studentsAssessed: 0,
    totalCollectibles: 0,
  };
  const queue = data?.queue ?? [];
  const recentCollections = data?.recentCollections ?? [];

  return (
    <PageContainer width="standard">
      <PageHeader
        title="Payment Queue"
        description="Newly assessed students and outstanding balances ready for posting."
      />

      <div className="mt-6 w-full">
        <div className="flex items-center justify-end">
          {query.isFetching && !query.isLoading && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Refreshing…
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Collection (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-primary">
                <CurrencyDisplay amount={stats.totalCollectedToday} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Pending Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-foreground">
                {stats.pendingPaymentsCount}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Students Assessed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-foreground">
                {stats.studentsAssessed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Collectibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-display text-xl font-black text-foreground">
                <CurrencyDisplay amount={stats.totalCollectibles} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-4">
          {query.isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
              Failed to load the payment queue. Please try again.
              <div className="mt-3">
                <button type="button" onClick={() => query.refetch()} className="btn-primary min-h-9 px-4">
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <CashierQueueTable rows={queue} />
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                Cashier Policy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <h3 className="font-display text-2xl font-extrabold text-foreground">
                Daily Reconciliation Reminder
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400">
                All cash and check transactions must be reconciled and closed before 4:30 PM. Ensure
                physical receipts match the digital ledger entries to avoid audit discrepancies. Contact
                your supervisor for partial-payment overrides and exception handling.
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Collections</CardTitle>
            </CardHeader>
            <CardContent>
              {recentCollections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No posted payments yet.</p>
              ) : (
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {recentCollections.map((p) => {
                    const rowClassName =
                      "flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2 transition-colors hover:bg-gray-200 dark:hover:bg-gray-800 hover:border-primary";
                    const rowContent = (
                      <>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            Receipt {p.orNumber ? <ReferenceCode code={p.orNumber} /> : "#—"}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {p.studentLastName}, {p.studentFirstName}
                          </p>
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            {formatDate(p.paymentDate, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          <CurrencyDisplay amount={Number(p.amount)} />
                        </div>
                      </>
                    );
                    return (
                      <li key={p.paymentId}>
                        {p.assessmentId ? (
                          <Link href={`/staff/assessments/${p.assessmentId}`} className={rowClassName}>
                            {rowContent}
                          </Link>
                        ) : (
                          <div className={rowClassName} aria-disabled="true">
                            {rowContent}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
