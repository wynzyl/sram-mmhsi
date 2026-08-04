"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface AccountsReceivableFiltersProps {
  schoolYears: SchoolYearOption[];
  defaultSchoolYearId?: string;
}

export function AccountsReceivableFilters({
  schoolYears,
  defaultSchoolYearId = "",
}: AccountsReceivableFiltersProps) {
  const router = useRouter();
  const [schoolYearId, setSchoolYearId] = useState(defaultSchoolYearId);

  const handleApply = () => {
    const params = new URLSearchParams();
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : "/staff/reports/accounts-receivable");
  };

  const handleReset = () => {
    setSchoolYearId("");
    router.push("/staff/reports/accounts-receivable");
  };

  const hasFilters = schoolYearId !== "";

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/accounts-receivable/export";
  const exportParams = new URLSearchParams();
  if (defaultSchoolYearId) exportParams.set("schoolYearId", defaultSchoolYearId);

  return (
    <div className="filter-controls-inline">
      {/* School Year Filter */}
      <select
        value={schoolYearId}
        onChange={(e) => setSchoolYearId(e.target.value)}
        className="filter-select w-32"
        aria-label="School year"
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
