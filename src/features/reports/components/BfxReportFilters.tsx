"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface BfxReportFiltersProps {
  schoolYears: SchoolYearOption[];
  defaults?: {
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
  };
}

export function BfxReportFilters({ schoolYears, defaults = {} }: BfxReportFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const getInitialValue = useCallback(
    (key: "startDate" | "endDate" | "schoolYearId"): string => {
      return defaults[key] ?? searchParams.get(key) ?? "";
    },
    [defaults, searchParams]
  );

  const [startDate, setStartDate] = useState(getInitialValue("startDate"));
  const [endDate, setEndDate] = useState(getInitialValue("endDate"));
  const [schoolYearId, setSchoolYearId] = useState(getInitialValue("schoolYearId"));

  const handleApply = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : "/staff/reports/balance-forwards");
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSchoolYearId("");
    router.push("/staff/reports/balance-forwards");
  };

  const hasFilters = startDate || endDate || schoolYearId;

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/balance-forwards/export";
  const exportParams = new URLSearchParams();
  if (defaults.startDate) exportParams.set("startDate", defaults.startDate);
  if (defaults.endDate) exportParams.set("endDate", defaults.endDate);
  if (defaults.schoolYearId) exportParams.set("schoolYearId", defaults.schoolYearId);

  return (
    <div className="filter-controls-inline">
      {/* Date Range Inputs */}
      <input
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
        className="filter-select w-32"
        aria-label="Start date"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <input
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
        className="filter-select w-32"
        aria-label="End date"
      />

      {/* School Year Filter */}
      <select
        value={schoolYearId}
        onChange={(e) => setSchoolYearId(e.target.value)}
        className="filter-select w-28"
        aria-label="Source school year"
      >
        <option value="">All Years</option>
        {schoolYears.map((sy) => (
          <option key={sy.id} value={sy.id}>
            {sy.label}
          </option>
        ))}
      </select>

      {/* Apply Button */}
      <button
        type="button"
        onClick={handleApply}
        className="inline-flex items-center justify-center min-h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
      >
        Apply
      </button>

      {/* Clear Link */}
      {hasFilters && (
        <button
          type="button"
          onClick={handleReset}
          className="filter-clear"
        >
          Clear
        </button>
      )}

      {/* Separator */}
      <div className="filter-separator" />

      {/* Export Buttons */}
      <Link
        href={`${exportBaseUrl}?format=pdf&${exportParams.toString()}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <path
            fillRule="evenodd"
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        PDF
      </Link>
      <Link
        href={`${exportBaseUrl}?format=xlsx&${exportParams.toString()}`}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
          <path
            fillRule="evenodd"
            d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
        Excel
      </Link>
    </div>
  );
}
