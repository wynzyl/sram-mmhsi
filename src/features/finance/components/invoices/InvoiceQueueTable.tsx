"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { FileText, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { TablePagination } from "@/components/ui/TablePagination";
import type { InvoiceListRow } from "../../invoices/invoices.queries";
import type { PaginatedResult } from "@/lib/types/pagination";

type InvoiceQueueTableProps = {
  paginatedData: PaginatedResult<InvoiceListRow>;
  basePath: string;
  searchQuery?: string;
  gradeLevelFilter?: string;
};

/**
 * Invoice list table with pagination.
 * Displays invoices in a consistent format matching Enrollment Queue style.
 */
export default function InvoiceQueueTable({
  paginatedData,
  basePath,
  searchQuery = "",
  gradeLevelFilter = "",
}: InvoiceQueueTableProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: invoices, pagination } = paginatedData;

  // Build base URL for pagination (preserving current filters)
  const paginationBaseUrl = useMemo(() => {
    const params = new URLSearchParams();
    const currentTab = searchParams.get("tab");
    if (currentTab) params.set("tab", currentTab);
    if (searchQuery) params.set("search", searchQuery);
    if (gradeLevelFilter && gradeLevelFilter !== "all") params.set("gradeLevel", gradeLevelFilter);
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams, searchQuery, gradeLevelFilter]);

  /**
   * Get status badge styling
   */
  function getStatusBadge(status: InvoiceListRow["status"]) {
    const baseClasses = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide";

    switch (status) {
      case "draft":
        return `${baseClasses} bg-muted text-muted-foreground`;
      case "sent":
        return `${baseClasses} bg-primary/10 text-primary`;
      case "viewed":
        return `${baseClasses} bg-success/10 text-success`;
      case "overdue":
        return `${baseClasses} bg-destructive/10 text-destructive`;
      case "settled":
        return `${baseClasses} bg-success/20 text-success`;
      default:
        return `${baseClasses} bg-muted text-muted-foreground`;
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-sm font-medium text-foreground">No invoices found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {searchQuery || gradeLevelFilter
            ? "Try adjusting your search or filter criteria."
            : "No invoices in this status yet."}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Info Banner */}
      <div className="mx-4 mt-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium text-primary">Invoice Queue</p>
            <p className="text-sm text-muted-foreground">
              Review invoice details and click <span className="font-medium text-primary">View</span> to see full details and send to guardians.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Invoice #
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Student Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Grade / Section
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Amount Due
              </th>
              <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invoices.map((invoice) => (
              <tr
                key={invoice.id}
                className="transition-colors hover:bg-muted/30"
              >
                {/* Invoice Number */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {invoice.invoiceNumber}
                  </span>
                </td>

                {/* Student Name */}
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">
                    {invoice.studentName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {invoice.studentRef}
                  </div>
                </td>

                {/* Grade / Section */}
                <td className="px-4 py-3">
                  <div className="text-sm text-foreground">
                    {invoice.gradeLevelName}
                  </div>
                  {invoice.sectionName && (
                    <div className="text-xs text-muted-foreground">
                      {invoice.sectionName}
                    </div>
                  )}
                </td>

                {/* Amount Due */}
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-foreground">
                    {formatCurrency(invoice.amountDue)}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 text-center">
                  <span className={getStatusBadge(invoice.status)}>
                    {invoice.status}
                  </span>
                </td>

                {/* Created Date */}
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(invoice.createdAt)}
                </td>

                {/* Action */}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${basePath}/${invoice.id}`}
                    className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="px-4 pb-4 pt-2">
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          pageSize={pagination.pageSize}
          baseUrl={paginationBaseUrl}
          itemLabel="invoices"
        />
      </div>
    </>
  );
}
