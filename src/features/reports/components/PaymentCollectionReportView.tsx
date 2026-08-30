"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { PaymentCollectionReportContent } from "./PaymentCollectionReportPreview";
import { TablePagination } from "@/components/ui/TablePagination";
import type {
  PaymentCollectionRow,
  PaymentCollectionSummary,
} from "../payment-collection-report.types";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, USAGE_MODE_LABELS } from "../payment-collection-report.types";

interface PaymentCollectionReportViewProps {
  rows: PaymentCollectionRow[];
  summary: PaymentCollectionSummary;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  currentFilters: {
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    usageMode?: string;
  };
  exportPath: string;
}

export function PaymentCollectionReportView({
  rows,
  summary,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  currentFilters,
  exportPath,
}: PaymentCollectionReportViewProps) {
  const router = useRouter();
  const basePath = "/staff/reports/payment-collection";

  // Local filter state
  const [startDate, setStartDate] = useState(currentFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(currentFilters.endDate ?? "");
  const [method, setMethod] = useState(currentFilters.paymentMethod ?? "");
  const [status, setStatus] = useState(currentFilters.paymentStatus ?? "");
  const [mode, setMode] = useState(currentFilters.usageMode ?? "");
  const [isExporting, setIsExporting] = useState<"pdf" | "xlsx" | null>(null);

  // Debounce date inputs
  const debouncedStartDate = useDebounce(startDate, 500);
  const debouncedEndDate = useDebounce(endDate, 500);

  // Sync local state when URL changes externally (back/forward navigation)
  const [syncedFilters, setSyncedFilters] = useState(currentFilters);
  if (
    currentFilters.startDate !== syncedFilters.startDate ||
    currentFilters.endDate !== syncedFilters.endDate ||
    currentFilters.paymentMethod !== syncedFilters.paymentMethod ||
    currentFilters.paymentStatus !== syncedFilters.paymentStatus ||
    currentFilters.usageMode !== syncedFilters.usageMode
  ) {
    setSyncedFilters(currentFilters);
    setStartDate(currentFilters.startDate ?? "");
    setEndDate(currentFilters.endDate ?? "");
    setMethod(currentFilters.paymentMethod ?? "");
    setStatus(currentFilters.paymentStatus ?? "");
    setMode(currentFilters.usageMode ?? "");
  }

  // Check if any filters are active
  const hasFilters =
    startDate !== "" || endDate !== "" || method !== "" || status !== "" || mode !== "";

  // Build URL from filters
  function buildFilterUrl(overrides: Partial<typeof currentFilters> = {}) {
    const params = new URLSearchParams();
    const effectiveStart = overrides.startDate ?? startDate;
    const effectiveEnd = overrides.endDate ?? endDate;
    const effectiveMethod = overrides.paymentMethod ?? method;
    const effectiveStatus = overrides.paymentStatus ?? status;
    const effectiveMode = overrides.usageMode ?? mode;

    if (effectiveStart) params.set("startDate", effectiveStart);
    if (effectiveEnd) params.set("endDate", effectiveEnd);
    if (effectiveMethod) params.set("paymentMethod", effectiveMethod);
    if (effectiveStatus) params.set("paymentStatus", effectiveStatus);
    if (effectiveMode) params.set("usageMode", effectiveMode);

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  // Push to URL when debounced date changes
  useEffect(() => {
    // Only push if values differ from current URL state
    if (
      debouncedStartDate !== (currentFilters.startDate ?? "") ||
      debouncedEndDate !== (currentFilters.endDate ?? "")
    ) {
      router.push(
        buildFilterUrl({
          startDate: debouncedStartDate || undefined,
          endDate: debouncedEndDate || undefined,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedStartDate, debouncedEndDate]);

  // Immediate push for select changes
  function handleMethodChange(newMethod: string) {
    setMethod(newMethod);
    router.push(buildFilterUrl({ paymentMethod: newMethod || undefined }));
  }

  function handleStatusChange(newStatus: string) {
    setStatus(newStatus);
    router.push(buildFilterUrl({ paymentStatus: newStatus || undefined }));
  }

  function handleModeChange(newMode: string) {
    setMode(newMode);
    router.push(buildFilterUrl({ usageMode: newMode || undefined }));
  }

  // Export handlers
  async function handleExport(format: "pdf" | "xlsx") {
    setIsExporting(format);
    try {
      const params = new URLSearchParams();
      params.set("format", format);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (method) params.set("paymentMethod", method);
      if (status) params.set("paymentStatus", status);
      if (mode) params.set("usageMode", mode);

      const url = `${exportPath}?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Export failed");
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      const filename =
        filenameMatch?.[1] ??
        `payment-collection-report.${format === "pdf" ? "pdf" : "xlsx"}`;

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(null);
    }
  }

  // Build pagination base URL
  const paginationBaseUrl = buildFilterUrl();

  return (
    <section
      className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
      aria-labelledby="report-heading"
    >
      {/* Card Header with gradient - ALL controls in one row */}
      <div className="bg-muted border-b border-border px-4 py-3 no-print">
        <div className="flex items-center gap-3">
          {/* Title + Count Badge */}
          <h2
            id="report-heading"
            className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary shrink-0"
          >
            Payment Collection
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border shrink-0">
            {totalCount} Payment{totalCount !== 1 ? "s" : ""}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* All Filters + Export in single row */}
          <div className="flex items-center gap-2">
            {/* Date Range - compact */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-control h-9 w-[130px] bg-muted text-foreground text-xs px-2"
              aria-label="Start date"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-control h-9 w-[130px] bg-muted text-foreground text-xs px-2"
              aria-label="End date"
            />

            {/* Method Filter */}
            <select
              value={method}
              onChange={(e) => handleMethodChange(e.target.value)}
              className="form-control h-9 w-[110px] bg-muted text-foreground text-xs px-2 [&>option]:bg-card [&>option]:text-foreground"
              aria-label="Payment method"
            >
              <option value="">All methods</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="form-control h-9 w-[90px] bg-muted text-foreground text-xs px-2 [&>option]:bg-card [&>option]:text-foreground"
              aria-label="Payment status"
            >
              <option value="">All</option>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
              </option>
              ))}
            </select>

            {/* Mode Filter */}
            <select
              value={mode}
              onChange={(e) => handleModeChange(e.target.value)}
              className="form-control h-9 w-[80px] bg-muted text-foreground text-xs px-2 [&>option]:bg-card [&>option]:text-foreground"
              aria-label="Booklet mode"
            >
              <option value="">All</option>
              {Object.entries(USAGE_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Clear link (if any filter active) */}
            {hasFilters && (
              <Link
                href={basePath}
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setMethod("");
                  setStatus("");
                  setMode("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Clear
              </Link>
            )}

            {/* Export Buttons */}
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              disabled={isExporting !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 h-9 text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {isExporting === "pdf" ? "..." : "PDF"}
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx")}
              disabled={isExporting !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 h-9 text-xs font-semibold text-foreground hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {isExporting === "xlsx" ? "..." : "Excel"}
            </button>
          </div>
        </div>
      </div>

      {/* Report Content (summary + table) */}
      <PaymentCollectionReportContent rows={rows} summary={summary} />

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div className="border-t border-border no-print">
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalCount}
            pageSize={pageSize}
            baseUrl={paginationBaseUrl}
            itemLabel="payments"
          />
        </div>
      )}
    </section>
  );
}
