"use client";

import { Button } from "@/components/ui/button";

// SVG icons for export buttons
const PrinterIcon = () => (
  <svg
    className="w-4 h-4 mr-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const SpreadsheetIcon = () => (
  <svg
    className="w-4 h-4 mr-2"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13l6 6M15 13l-6 6" />
  </svg>
);

/**
 * Common filter values type used for report exports
 */
export interface ReportFilterValues {
  startDate?: string;
  endDate?: string;
  schoolYearId?: string;
  gradeLevelId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  [key: string]: string | undefined;
}

interface ReportExportActionsProps {
  /**
   * The export route path (without query params)
   * e.g., "/staff/reports/payment-collection/export"
   */
  exportPath: string;
  /**
   * Filter values to include in the export request
   */
  filters: ReportFilterValues;
  /**
   * Optional className for the container
   */
  className?: string;
}

/**
 * Generic report export actions component
 *
 * Provides PDF and Excel export buttons that trigger downloads via the specified
 * export route. Filters are passed as query parameters.
 *
 * @example
 * ```tsx
 * <ReportExportActions
 *   exportPath="/staff/reports/payment-collection/export"
 *   filters={{
 *     startDate: "2026-01-01",
 *     endDate: "2026-01-31",
 *     schoolYearId: "abc-123",
 *   }}
 * />
 * ```
 */
export function ReportExportActions({
  exportPath,
  filters,
  className,
}: ReportExportActionsProps) {
  const download = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("format", format);

    // Add all defined filter values to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    // Trigger download without navigating
    // Server sets filename via Content-Disposition header
    const a = document.createElement("a");
    a.href = `${exportPath}?${params.toString()}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className={`flex items-center gap-2 no-print ${className ?? ""}`}>
      <Button type="button" variant="secondary" onClick={() => download("pdf")}>
        <PrinterIcon />
        Export PDF
      </Button>
      <Button type="button" variant="secondary" onClick={() => download("xlsx")}>
        <SpreadsheetIcon />
        Export Excel
      </Button>
    </div>
  );
}
