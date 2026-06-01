"use client";

import { formatDate } from "@/lib/utils/date";
import type {
  PaymentCollectionRow,
  PaymentCollectionSummary,
} from "../payment-collection-report.types";
import { PAYMENT_METHOD_LABELS } from "../payment-collection-report.types";

/** Format amount as number without currency symbol */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface PaymentCollectionReportPreviewProps {
  rows: PaymentCollectionRow[];
  summary: PaymentCollectionSummary;
}

export function PaymentCollectionReportPreview({
  rows,
  summary,
}: PaymentCollectionReportPreviewProps) {
  return (
    <div
      id="report-preview"
      className="bg-card text-foreground rounded-lg shadow-lg border border-border overflow-hidden print:shadow-none print:border-none print:rounded-none"
    >
      {/* Report Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-8 py-6 border-b-2 border-primary/20 print:bg-white print:border-b print:border-black">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Payment Collection Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              SRAMS - School Registration and Accounts Monitoring System
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>
              <span className="font-medium">Period:</span>{" "}
              {formatDate(summary.periodStart, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}{" "}
              -{" "}
              {formatDate(summary.periodEnd, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <p className="mt-1">
              <span className="font-medium">Generated:</span>{" "}
              {formatDate(new Date(), {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="px-8 py-6 bg-muted border-b border-border print:bg-white">
        <h2 className="text-lg font-semibold text-foreground mb-4">Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Total Payments
            </p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.totalCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              Total Amount
            </p>
            <p className="text-2xl font-bold text-primary mt-1">
              {formatAmount(summary.totalAmount)}
            </p>
          </div>
        </div>

        {/* Method Breakdown */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Breakdown by Payment Method
          </p>
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-background px-3 py-2 rounded border border-border print:border-gray-300">
              <p className="text-[10px] text-muted-foreground">Cash</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.cash)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-gray-300">
              <p className="text-[10px] text-muted-foreground">GCash</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.gcash)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-gray-300">
              <p className="text-[10px] text-muted-foreground">Bank Transfer</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.bank_transfer)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-gray-300">
              <p className="text-[10px] text-muted-foreground">Check</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.check)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-gray-300">
              <p className="text-[10px] text-muted-foreground">Other</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.other)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="px-8 py-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Payment Details ({rows.length.toLocaleString()} records)
        </h2>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No payments found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted print:bg-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    OR #
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Student
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Grade
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground border-b border-border">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Method
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Reference #
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground border-b border-border">
                    Processed By
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={
                      index % 2 === 0 ? "bg-card" : "bg-muted/50 print:bg-white"
                    }
                  >
                    <td className="px-3 py-2 border-b border-border font-mono text-xs">
                      {row.orNumber || "—"}
                    </td>
                    <td className="px-3 py-2 border-b border-border whitespace-nowrap">
                      {formatDate(row.collectionDate, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2 border-b border-border">
                      <span className="font-medium">{row.studentName}</span>
                    </td>
                    <td className="px-3 py-2 border-b border-border">
                      {row.gradeLevel}
                    </td>
                    <td className="px-3 py-2 border-b border-border text-right font-medium">
                      {formatAmount(Number(row.amount))}
                    </td>
                    <td className="px-3 py-2 border-b border-border">
                      {PAYMENT_METHOD_LABELS[row.paymentMethod] ||
                        row.paymentMethod}
                    </td>
                    <td className="px-3 py-2 border-b border-border font-mono text-xs">
                      {row.referenceNumber || "—"}
                    </td>
                    <td className="px-3 py-2 border-b border-border">
                      {row.processedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-semibold print:bg-gray-200">
                  <td
                    colSpan={4}
                    className="px-3 py-2 border-t-2 border-border text-right"
                  >
                    Total:
                  </td>
                  <td className="px-3 py-2 border-t-2 border-border text-right text-primary">
                    {formatAmount(summary.totalAmount)}
                  </td>
                  <td
                    colSpan={3}
                    className="px-3 py-2 border-t-2 border-border"
                  />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-8 py-4 bg-muted border-t border-border text-xs text-muted-foreground print:bg-white">
        <div className="flex justify-between">
          <span>SRAMS Payment Collection Report</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
}
