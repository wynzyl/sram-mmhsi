"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { TablePagination } from "@/components/ui/TablePagination";
import { formatDate } from "@/lib/utils/date";
import { useDebounce } from "@/hooks/useDebounce";
import type { ColumnDef } from "@tanstack/react-table";
import type { AccountsReceivableRow } from "../accounts-receivable-report.queries";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  baseUrl: string;
}

interface AccountsReceivableViewProps {
  data: AccountsReceivableRow[];
  schoolYears: SchoolYearOption[];
  defaultSchoolYearId?: string;
  pagination?: PaginationProps;
  /** Header content (title + badges) to render on the left side of card header */
  headerContent?: ReactNode;
}

/** Right-aligned header for numeric columns */
function rightHeader(label: string) {
  const Header = () => <span className="flex-1 text-right">{label}</span>;
  Header.displayName = `RightHeader(${label})`;
  return Header;
}

export function AccountsReceivableView({
  data,
  schoolYears,
  defaultSchoolYearId = "",
  pagination,
  headerContent,
}: AccountsReceivableViewProps) {
  const router = useRouter();
  const [schoolYearId, setSchoolYearId] = useState(defaultSchoolYearId);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Filter data client-side based on search
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return data;
    const term = debouncedSearch.toLowerCase();
    return data.filter(
      (row) =>
        row.studentRef.toLowerCase().includes(term) ||
        row.studentName.toLowerCase().includes(term)
    );
  }, [data, debouncedSearch]);

  const handleApply = () => {
    const params = new URLSearchParams();
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : "/staff/reports/accounts-receivable");
  };

  const handleReset = () => {
    setSchoolYearId("");
    setSearch("");
    router.push("/staff/reports/accounts-receivable");
  };

  const hasFilters = schoolYearId !== "" || search !== "";

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/accounts-receivable/export";
  const exportParams = new URLSearchParams();
  if (defaultSchoolYearId) exportParams.set("schoolYearId", defaultSchoolYearId);

  const columns = useMemo<ColumnDef<AccountsReceivableRow>[]>(
    () => [
      {
        header: "Student ID",
        accessorKey: "studentRef",
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-mono)] text-sm">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        header: "Student Name",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <Link
            href={`/staff/students/${row.original.studentId}`}
            className="text-primary hover:underline font-medium"
          >
            {row.original.studentName}
          </Link>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {row.original.schoolYearLabel}
          </span>
        ),
      },
      {
        header: rightHeader("Balance"),
        accessorKey: "balance",
        cell: ({ row }) => (
          <span className="block text-right">
            <CurrencyDisplay
              amount={row.original.balance}
              className="text-sm font-medium text-primary"
            />
          </span>
        ),
      },
      {
        header: rightHeader("Last Payment"),
        accessorKey: "lastPaymentDate",
        cell: ({ row }) => (
          <span className="block text-right text-sm text-muted-foreground whitespace-nowrap">
            {row.original.lastPaymentDate
              ? formatDate(row.original.lastPaymentDate)
              : "—"}
          </span>
        ),
      },
      {
        header: rightHeader("Aging (Days)"),
        accessorKey: "agingDays",
        cell: ({ row }) => (
          <span className="block text-right text-sm tabular-nums">
            {row.original.agingDays}
          </span>
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
            No outstanding balances found for the selected filters.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filteredData}
          enablePagination={false}
        />
      )}

      {/* Pagination */}
      {pagination && pagination.totalCount > 0 && (
        <div className="border-t border-border px-4 py-3 no-print">
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalRecords={pagination.totalCount}
            pageSize={pagination.pageSize}
            baseUrl={pagination.baseUrl}
            itemLabel="accounts"
          />
        </div>
      )}
    </div>
  );
}
