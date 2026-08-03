"use client";

import { useState, useMemo, useCallback, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { useDebounce } from "@/hooks/useDebounce";
import type { ColumnDef } from "@tanstack/react-table";
import type { BfxTransferRow } from "../balance-forward-report.queries";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

interface BfxReportViewProps {
  data: BfxTransferRow[];
  schoolYears: SchoolYearOption[];
  defaults?: {
    startDate?: string;
    endDate?: string;
    schoolYearId?: string;
  };
  pagination?: PaginationProps;
  /** Header content (title + badges) to render on the left side of card header */
  headerContent?: ReactNode;
}

export function BfxReportView({
  data,
  schoolYears,
  defaults = {},
  pagination,
  headerContent,
}: BfxReportViewProps) {
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Filter data client-side based on search
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return data;
    const term = debouncedSearch.toLowerCase();
    return data.filter(
      (row) =>
        row.bfxNumber.toLowerCase().includes(term) ||
        row.studentName.toLowerCase().includes(term) ||
        row.studentRef.toLowerCase().includes(term)
    );
  }, [data, debouncedSearch]);

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
    setSearch("");
    router.push("/staff/reports/balance-forwards");
  };

  const hasFilters = startDate || endDate || schoolYearId || search;

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/balance-forwards/export";
  const exportParams = new URLSearchParams();
  if (defaults.startDate) exportParams.set("startDate", defaults.startDate);
  if (defaults.endDate) exportParams.set("endDate", defaults.endDate);
  if (defaults.schoolYearId) exportParams.set("schoolYearId", defaults.schoolYearId);

  const columns = useMemo<ColumnDef<BfxTransferRow>[]>(
    () => [
      {
        header: "BFX Number",
        accessorKey: "bfxNumber",
        cell: ({ row }) => (
          <Badge
            variant="info"
            className="bg-blue-100 text-blue-800 border-blue-200 font-mono"
          >
            {row.original.bfxNumber}
          </Badge>
        ),
      },
      {
        header: "Transfer Date",
        accessorKey: "transferDate",
        cell: ({ row }) => {
          return formatDate(row.original.transferDate, {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
        },
      },
      {
        header: "Student",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <Link
              href={`/staff/students/${row.original.studentId}`}
              className="text-primary hover:underline font-medium"
            >
              {row.original.studentName}
            </Link>
            <span className="text-xs text-muted-foreground">
              <ReferenceCode code={row.original.studentRef} />
            </span>
          </div>
        ),
      },
      {
        header: "Source Year",
        accessorKey: "sourceSchoolYearLabel",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.sourceSchoolYearLabel}</span>
        ),
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => {
          // BFX amounts are negative in source (transferred out)
          const amount = Math.abs(Number(row.original.amount));
          return (
            <span className="font-medium">
              <CurrencyDisplay amount={amount} />
            </span>
          );
        },
      },
      {
        header: "Remarks",
        accessorKey: "remarks",
        cell: ({ row }) =>
          row.original.remarks ? (
            <span className="text-sm text-muted-foreground truncate max-w-[280px] block">
              {row.original.remarks}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
    ],
    []
  );

  return (
    <div className="flex flex-col">
      {/* Card Header with Filters */}
      <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title + Stats Badges */}
        {headerContent && (
          <div className="flex items-center gap-3 flex-wrap">
            {headerContent}
          </div>
        )}

        {/* Right: Filters + Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="filter-search w-48">
            <span className="filter-search-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="filter-search-input"
              autoComplete="off"
            />
          </div>

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

          {/* Clear */}
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
      </div>

      {/* Data Table or Empty State */}
      {data.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            No balance forward transfers found for the selected period.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          pageSize={20}
        />
      )}

      {/* Server-side Pagination Info */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Showing {(pagination.currentPage - 1) * pagination.pageSize + 1} - {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)} of {pagination.totalCount} transfers
          </p>
          <div className="flex gap-2">
            {pagination.currentPage > 1 && (
              <a
                href={`?startDate=${defaults.startDate || ""}&endDate=${defaults.endDate || ""}&schoolYearId=${defaults.schoolYearId || ""}&page=${pagination.currentPage - 1}`}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
              >
                Previous
              </a>
            )}
            {pagination.currentPage < pagination.totalPages && (
              <a
                href={`?startDate=${defaults.startDate || ""}&endDate=${defaults.endDate || ""}&schoolYearId=${defaults.schoolYearId || ""}&page=${pagination.currentPage + 1}`}
                className="px-3 py-1 text-sm border border-border rounded hover:bg-muted"
              >
                Next
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
