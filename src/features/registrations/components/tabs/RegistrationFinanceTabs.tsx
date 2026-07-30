"use client";

import Link from "next/link";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { DataCard } from "@/components/ui/editorial/DataCard";
import { formatDate } from "@/lib/utils/date";
import { Tag } from "lucide-react";
import type {
  AssessmentSummaryRow,
  InvoiceSummaryRow,
  StudentRecordFlags,
} from "@/features/students/components/StudentRecordProfile";
import type { DiscountRequestView, DiscountTypeView } from "@/features/discounts/discounts.schema";
import DiscountRequestForm from "@/features/discounts/components/DiscountRequestForm";

function invoiceStatusVariant(
  status: string
): "secondary" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "settled":
      return "success";
    case "sent":
      return "info";
    case "viewed":
      return "secondary";
    case "overdue":
      return "danger";
    default:
      return "warning";
  }
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

export type RegistrationBillingTabProps = {
  assessmentSummaries: AssessmentSummaryRow[];
};

/**
 * Billing/assessments table tab for RegistrationDetailView.
 * Extracted for maintainability (audit 2026-07).
 */
export function RegistrationBillingTab({
  assessmentSummaries,
}: RegistrationBillingTabProps) {
  return (
    <DataCard className="overflow-hidden">
      {assessmentSummaries.length === 0 ? (
        <p className="p-6 text-muted-foreground">No assessment ledgers for this student.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">School year</th>
                <th className="px-4 py-3">Assessed</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assessmentSummaries.map((a) => (
                <tr key={a.id} className="border-b border-border">
                  <td className="px-4 py-3">{a.schoolYear}</td>
                  <td className="px-4 py-3">
                    <CurrencyDisplay amount={Number(a.totalAmount)} />
                  </td>
                  <td className="px-4 py-3">
                    <CurrencyDisplay amount={Number(a.totalPaid)} />
                  </td>
                  <td className="px-4 py-3">
                    <CurrencyDisplay amount={Number(a.balance)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge type="billing" status={a.billingStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/staff/assessments/${a.id}`}
                      className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                    >
                      Ledger
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

export type RegistrationInvoicesTabProps = {
  invoices: InvoiceSummaryRow[];
};

/**
 * Invoices table tab for RegistrationDetailView.
 * Extracted for maintainability (audit 2026-07).
 */
export function RegistrationInvoicesTab({
  invoices,
}: RegistrationInvoicesTabProps) {
  return (
    <DataCard className="overflow-hidden">
      {invoices.length === 0 ? (
        <p className="p-6 text-muted-foreground">No invoices for this student.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border">
                  <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">
                    <CurrencyDisplay amount={Number(inv.amountDue)} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={invoiceStatusVariant(inv.status)} className="text-xs capitalize">
                      {inv.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {inv.dueDate
                      ? formatDate(inv.dueDate, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(inv.createdAt, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/staff/finance/invoices/${inv.id}`}
                      className="font-mono text-sm text-primary underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}

// ─── Discounts Tab ────────────────────────────────────────────────────────────

export type RegistrationDiscountsTabProps = {
  studentId: string;
  discountRequests: DiscountRequestView[];
  discountTypes: DiscountTypeView[];
  activeEnrollmentId?: string;
  flags: StudentRecordFlags;
};

/**
 * Discounts tab for RegistrationDetailView.
 * Extracted for maintainability (audit 2026-07).
 */
export function RegistrationDiscountsTab({
  studentId,
  discountRequests,
  discountTypes,
  activeEnrollmentId,
  flags,
}: RegistrationDiscountsTabProps) {
  return (
    <div className="space-y-6">
      {/* Status summary banner */}
      {discountRequests.length > 0 && (() => {
        const counts = discountRequests.reduce(
          (acc, r) => {
            acc[r.status] = (acc[r.status] ?? 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
        const reversedCount = counts.reversed ?? 0;
        return (
          <DataCard
            className={
              reversedCount > 0
                ? "p-4 border-destructive/40 bg-destructive/5"
                : "p-4"
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                Discount status:
              </span>
              {counts.pending ? (
                <Badge variant="warning" className="text-xs">
                  {counts.pending} Pending
                </Badge>
              ) : null}
              {counts.approved ? (
                <Badge variant="success" className="text-xs">
                  {counts.approved} Approved
                </Badge>
              ) : null}
              {counts.rejected ? (
                <Badge variant="danger" className="text-xs">
                  {counts.rejected} Rejected
                </Badge>
              ) : null}
              {counts.cancelled ? (
                <Badge variant="secondary" className="text-xs">
                  {counts.cancelled} Cancelled
                </Badge>
              ) : null}
              {reversedCount ? (
                <Badge variant="danger" className="text-xs">
                  {reversedCount} Reversed
                </Badge>
              ) : null}
            </div>
            {reversedCount > 0 && (
              <p className="mt-2 text-helper">
                This student has reversed discount(s). New discount
                requests are locked on any assessment where payment
                activity has been recorded.
              </p>
            )}
          </DataCard>
        );
      })()}

      {/* Request New Discount Form */}
      {flags.canRequestDiscounts && activeEnrollmentId && discountTypes.length > 0 && (
        <DataCard className="p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground mb-4">
            <Tag className="h-5 w-5 text-primary" aria-hidden />
            Request Discount
          </h2>
          <p className="text-secondary mb-4">
            Submit a discount request for approval by finance.
          </p>
          <DiscountRequestForm
            studentId={studentId}
            enrollmentId={activeEnrollmentId}
            discountTypes={discountTypes}
          />
        </DataCard>
      )}

      {/* No eligible enrollment warning */}
      {flags.canRequestDiscounts && !activeEnrollmentId && (
        <DataCard className="p-6 border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-600">
            Discount requests are only allowed for pending enrollments before an assessment is created.
            Once enrolled or assessed, discounts cannot be requested.
          </p>
        </DataCard>
      )}

      {/* Discount Requests List */}
      <DataCard className="overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-xl font-bold text-foreground">
            Discount Requests
          </h2>
          <p className="mt-1 text-secondary">
            History of discount requests for this student
          </p>
        </div>
        {discountRequests.length === 0 ? (
          <p className="p-6 text-muted-foreground">No discount requests for this student.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">School Year</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Decision</th>
                </tr>
              </thead>
              <tbody>
                {discountRequests.map((req) => (
                  <tr key={req.id} className="border-b border-border">
                    <td className="px-4 py-3">{req.schoolYearLabel}</td>
                    <td className="px-4 py-3">{req.gradeLevelName}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{req.discountTypeName}</div>
                      <div className="text-helper">{req.discountTypeCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs">
                        {req.calculationType === "percentage"
                          ? `${Number(req.overrideValue ?? req.defaultValue)}%`
                          : <CurrencyDisplay amount={Number(req.overrideValue ?? req.defaultValue)} className="inline" />}
                      </Badge>
                      <div className="text-helper mt-0.5">
                        {req.baseType === "tuition_only" ? "Tuition" : "Full"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === "pending" && (
                        <Badge variant="warning" className="text-xs">Pending</Badge>
                      )}
                      {req.status === "approved" && (
                        <Badge variant="success" className="text-xs">Approved</Badge>
                      )}
                      {req.status === "rejected" && (
                        <Badge variant="danger" className="text-xs">Rejected</Badge>
                      )}
                      {req.status === "cancelled" && (
                        <Badge variant="secondary" className="text-xs">Cancelled</Badge>
                      )}
                      {req.status === "reversed" && (
                        <Badge variant="danger" className="text-xs">Reversed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div>
                        {formatDate(req.requestedAt, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="text-xs">by {req.requestedByName}</div>
                      {req.requestReason && (
                        <div className="text-xs italic mt-1 max-w-[150px] truncate" title={req.requestReason}>
                          {req.requestReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.decidedAt ? (
                        <>
                          <div>
                            {formatDate(req.decidedAt, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          {req.decidedByName && <div className="text-xs">by {req.decidedByName}</div>}
                          {req.decisionRemarks && (
                            <div className="text-xs italic mt-1 max-w-[150px] truncate" title={req.decisionRemarks}>
                              {req.decisionRemarks}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
