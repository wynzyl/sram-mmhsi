"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { usePortalPayments } from "@/features/payments/hooks/use-portal-payments";

export function PortalPaymentsView() {
  const query = usePortalPayments();
  const data = query.data;

  const rows = data?.rows ?? [];
  const showStudentColumn = data?.showStudentColumn ?? false;

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
  } else if (data && !data.hasLinkedStudents) {
    emptyCopy = (
      <p className="text-muted-foreground">
        No learner profile is linked to your portal account yet. Ask the registrar to link your account if
        you believe this is an error.
      </p>
    );
  } else if (rows.length === 0) {
    emptyCopy = <p className="text-muted-foreground">No posted payments on file yet.</p>;
  }

  return (
    <PageContainer>
      <PageHeader title="Payments" description="Official receipts and payment history (read-only)." />

      {emptyCopy}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-border bg-muted">
              <tr>
                {showStudentColumn && (
                  <th className="px-4 py-2 text-left font-semibold text-foreground">Student</th>
                )}
                <th className="px-4 py-2 text-left font-semibold text-foreground">Date</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">OR #</th>
                <th className="px-4 py-2 text-right font-semibold text-foreground">Amount</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Method</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Ref</th>
                <th className="px-4 py-2 text-left font-semibold text-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dateLabel = new Date(r.paymentDate).toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    {showStudentColumn && (
                      <td className="px-4 py-3 text-foreground">
                        <div className="font-medium">{r.studentName}</div>
                        <div className="text-xs text-muted-foreground">{r.studentReference}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-foreground">{dateLabel}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{r.orNumber ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <CurrencyDisplay amount={Number(r.amount)} />
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
      )}
    </PageContainer>
  );
}
