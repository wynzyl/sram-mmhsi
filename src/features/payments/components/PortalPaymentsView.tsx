"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils/date";
import { usePortalPayments } from "@/features/payments/hooks/use-portal-payments";
import type { PortalPaymentRow } from "@/features/payments/payments.types";

export function PortalPaymentsView() {
  const query = usePortalPayments();
  const data = query.data;

  const rows = data?.rows ?? [];

  let emptyCopy: ReactNode = null;
  if (query.isLoading) {
    emptyCopy = <p className="text-muted-foreground">Loading payments…</p>;
  } else if (query.isError) {
    emptyCopy = (
      <p className="text-destructive">
        Failed to load payments.{" "}
        <button type="button" onClick={() => query.refetch()} className="underline">
          Retry
        </button>
      </p>
    );
  } else if (rows.length === 0) {
    emptyCopy = (
      <div className="bg-card rounded-xl border border-border shadow-sm p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-foreground">No payments yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your payment history will appear here once payments are posted.
        </p>
      </div>
    );
  }

  // Group payments by school year
  const groupedByYear = new Map<string, {
    label: string;
    gradeLevelName: string | null;
    payments: PortalPaymentRow[];
    total: number
  }>();

  for (const row of rows) {
    const yearId = row.schoolYearId ?? "unknown";
    const yearLabel = row.schoolYearLabel ?? "Other Payments";

    if (!groupedByYear.has(yearId)) {
      groupedByYear.set(yearId, {
        label: yearLabel,
        gradeLevelName: row.gradeLevelName,
        payments: [],
        total: 0
      });
    }

    const group = groupedByYear.get(yearId)!;
    group.payments.push(row);
    if (row.status === "posted") {
      group.total += row.amount;
    }
  }

  const schoolYears = Array.from(groupedByYear.values());

  return (
    <PageContainer>
      <PageHeader title="Payments" description="Official receipts and payment history (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="space-y-6">
          {schoolYears.map((yearGroup, idx) => (
            <div key={idx} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
              {/* School Year Header */}
              <div className="bg-muted px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {yearGroup.gradeLevelName ? `${yearGroup.gradeLevelName} - ` : ""}{yearGroup.label}
                    </h2>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Paid: <span className="font-semibold text-foreground"><CurrencyDisplay amount={yearGroup.total} /></span>
                  </div>
                </div>
              </div>

              {/* Payments Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground">OR #</th>
                      <th className="px-4 py-2 text-right font-semibold text-foreground">Amount</th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground">Method</th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground">Ref</th>
                      <th className="px-4 py-2 text-left font-semibold text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearGroup.payments.map((r) => {
                      const dateLabel = formatDate(r.paymentDate, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                      return (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 whitespace-nowrap text-foreground">{dateLabel}</td>
                          <td className="px-4 py-3 font-mono text-foreground">{r.orNumber ?? "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <CurrencyDisplay amount={r.amount} />
                          </td>
                          <td className="px-4 py-3 capitalize text-foreground">{r.paymentMethod}</td>
                          <td className="px-4 py-3 text-muted-foreground">{r.paymentReference ?? "—"}</td>
                          <td className="px-4 py-3">
                            <StatusBadge type="payment" status={r.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
