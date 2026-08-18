"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { formatDate } from "@/lib/utils/date";
import { CashierQueueTable } from "./CashierQueueTable";
import { useCashierQueue } from "@/features/payments/hooks/use-cashier-queue";

const PAGE_SIZE = 50;

export function CashierDashboardView() {
  const [currentPage, setCurrentPage] = useState(1);
  const query = useCashierQueue({ page: currentPage, pageSize: PAGE_SIZE });
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
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Payment Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          Newly assessed students and outstanding balances ready for posting
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="payments-heading"
      >
        {/* Queue Table with Header */}
        {query.isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            Failed to load the payment queue. Please try again.
            <div className="mt-3">
              <button type="button" onClick={() => query.refetch()} className="btn-primary min-h-9 px-4">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <CashierQueueTable
            rows={queue}
            stats={stats}
            isFetching={query.isFetching && !query.isLoading}
            totalCount={data?.queueTotalCount ?? 0}
            currentPage={currentPage}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        )}
      </section>

      {/* Bottom Info Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
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
              <p className="text-secondary">No posted payments yet.</p>
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
  );
}
