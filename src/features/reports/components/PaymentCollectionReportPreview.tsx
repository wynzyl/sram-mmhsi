"use client";

import { formatDate } from "@/lib/utils/date";
import type {
  PaymentCollectionRow,
  PaymentCollectionSummary,
} from "../payment-collection-report.types";
import { PAYMENT_METHOD_LABELS, USAGE_MODE_LABELS } from "../payment-collection-report.types";

/** Format amount as number without currency symbol */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

interface PaymentCollectionReportContentProps {
  rows: PaymentCollectionRow[];
  summary: PaymentCollectionSummary;
}

/**
 * Content-only component for the Payment Collection Report.
 * Does NOT include the outer card wrapper or header/footer - those are managed by PaymentCollectionReportView.
 * Contains: Summary section + Payment details table.
 */
export function PaymentCollectionReportContent({
  rows,
  summary,
}: PaymentCollectionReportContentProps) {
  return (
    <div id="report-preview">
      {/* Summary Section */}
      <div className="px-6 py-5 bg-muted/50 border-b border-border print:bg-white">
        <h3 className="text-sm font-semibold text-foreground mb-3">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Total Payments
            </p>
            <p className="text-xl font-bold text-foreground mt-0.5">
              {summary.totalCount.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Total Amount
            </p>
            <p className="text-xl font-bold text-primary mt-0.5">
              {formatAmount(summary.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Period Start
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {formatDate(summary.periodStart, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
              Period End
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5">
              {formatDate(summary.periodEnd, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Method Breakdown */}
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">
            Breakdown by Payment Method
          </p>
          <div className="grid grid-cols-5 gap-2">
            <div className="bg-background px-3 py-2 rounded border border-border print:border-border">
              <p className="text-[10px] text-muted-foreground">Cash</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.cash)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-border">
              <p className="text-[10px] text-muted-foreground">GCash</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.gcash)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-border">
              <p className="text-[10px] text-muted-foreground">Bank Transfer</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.bank_transfer)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-border">
              <p className="text-[10px] text-muted-foreground">Check</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.check)}
              </p>
            </div>
            <div className="bg-background px-3 py-2 rounded border border-border print:border-border">
              <p className="text-[10px] text-muted-foreground">Other</p>
              <p className="text-sm font-semibold text-foreground">
                {formatAmount(summary.byMethod.other)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="px-6 py-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Payment Details ({rows.length.toLocaleString()} records)
        </h3>

        {rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No payments found for the selected period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted print:bg-muted">
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
                  <th className="px-3 py-2 text-center font-semibold text-muted-foreground border-b border-border">
                    Mode
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
                    <td
                      className={`px-3 py-2 border-b border-border text-right font-medium ${
                        Number(row.amount) < 0
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {formatAmount(Number(row.amount))}
                    </td>
                    <td className="px-3 py-2 border-b border-border">
                      {PAYMENT_METHOD_LABELS[row.paymentMethod] ||
                        row.paymentMethod}
                    </td>
                    <td className="px-3 py-2 border-b border-border text-center">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          row.usageMode === "manual_only"
                            ? "bg-warning-tint text-warning"
                            : "bg-success-tint text-success"
                        }`}
                      >
                        {row.usageMode
                          ? USAGE_MODE_LABELS[row.usageMode]
                          : "—"}
                      </span>
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
                <tr className="bg-muted font-semibold print:bg-muted">
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
                    colSpan={4}
                    className="px-3 py-2 border-t-2 border-border"
                  />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Legacy export for backwards compatibility (can be removed once page.tsx is updated)
export { PaymentCollectionReportContent as PaymentCollectionReportPreview };
