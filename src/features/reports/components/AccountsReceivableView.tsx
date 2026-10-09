"use client";

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils/date";
import { useDebounce } from "@/hooks/useDebounce";
import { studentDetailUrl } from "@/lib/utils/student-routes";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  AccountsReceivableRow,
  AccountsReceivableGrouped,
} from "../accounts-receivable-report.queries";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface GradeLevelOption {
  id: string;
  name: string;
  order: number;
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
  groupedData: AccountsReceivableGrouped[];
  schoolYears: SchoolYearOption[];
  gradeLevels: GradeLevelOption[];
  defaultSchoolYearId?: string;
  defaultGradeLevelId?: string;
  defaultSearch?: string;
  pagination?: PaginationProps;
  /** Header content (title + badges) to render on the left side of card header */
  headerContent?: ReactNode;
}

/**
 * Column sizes in pixels for consistent widths across data rows and totals.
 * These must match the column definitions used in the DataTable.
 */
const COL_SIZES = {
  studentId: 100,
  studentName: 220,
  schoolYear: 100,
  totalAssessed: 130,
  amountPaid: 130,
  balance: 120,
  lastOr: 100,
  orDate: 100,
};

/** Right-aligned header for numeric columns */
function rightHeader(label: string) {
  const Header = () => <span className="flex-1 text-right">{label}</span>;
  Header.displayName = `RightHeader(${label})`;
  return Header;
}

function GradeLevelHeader({
  name,
  count,
}: {
  name: string;
  count: number;
}) {
  return (
    <div className="bg-muted/60 border-y border-border px-4 py-2 flex items-center justify-between">
      <span className="font-semibold text-sm text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">
        {count} student{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

/**
 * Subtotal row that aligns with the DataTable columns.
 * Uses fixed table layout with COL_SIZES for consistent column widths.
 */
function SubtotalRow({
  subtotal,
}: {
  subtotal: AccountsReceivableGrouped["subtotal"];
}) {
  return (
    <div className="bg-muted/40 border-b border-border">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: COL_SIZES.studentId }} />
          <col style={{ width: COL_SIZES.studentName }} />
          <col style={{ width: COL_SIZES.schoolYear }} />
          <col style={{ width: COL_SIZES.totalAssessed }} />
          <col style={{ width: COL_SIZES.amountPaid }} />
          <col style={{ width: COL_SIZES.balance }} />
          <col style={{ width: COL_SIZES.lastOr }} />
          <col style={{ width: COL_SIZES.orDate }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="px-5 py-3" />
            <td className="px-5 py-3 font-medium text-muted-foreground">Subtotal</td>
            <td className="px-5 py-3" />
            <td className="px-5 py-3 text-right">
              <CurrencyDisplay amount={subtotal.totalAmount} className="text-muted-foreground" />
            </td>
            <td className="px-5 py-3 text-right">
              <CurrencyDisplay amount={subtotal.totalPaid} className="text-muted-foreground" />
            </td>
            <td className="px-5 py-3 text-right">
              <CurrencyDisplay amount={subtotal.totalBalance} className="font-semibold text-foreground" />
            </td>
            <td className="px-5 py-3" />
            <td className="px-5 py-3" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Grand total row that aligns with the DataTable columns.
 * Uses fixed table layout with COL_SIZES for consistent column widths.
 */
function GrandTotalRow({
  summary,
}: {
  summary: {
    totalAccounts: number;
    totalAssessed: number;
    totalPaid: number;
    totalOutstanding: number;
  };
}) {
  return (
    <div className="bg-primary text-primary-foreground rounded-b-lg overflow-hidden">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col style={{ width: COL_SIZES.studentId }} />
          <col style={{ width: COL_SIZES.studentName }} />
          <col style={{ width: COL_SIZES.schoolYear }} />
          <col style={{ width: COL_SIZES.totalAssessed }} />
          <col style={{ width: COL_SIZES.amountPaid }} />
          <col style={{ width: COL_SIZES.balance }} />
          <col style={{ width: COL_SIZES.lastOr }} />
          <col style={{ width: COL_SIZES.orDate }} />
        </colgroup>
        <tbody>
          <tr>
            <td className="px-5 py-3" />
            <td className="px-5 py-3 font-semibold">
              GRAND TOTAL ({summary.totalAccounts} student{summary.totalAccounts !== 1 ? "s" : ""})
            </td>
            <td className="px-5 py-3" />
            <td className="px-5 py-3 text-right font-semibold">
              <CurrencyDisplay amount={summary.totalAssessed} />
            </td>
            <td className="px-5 py-3 text-right font-semibold">
              <CurrencyDisplay amount={summary.totalPaid} />
            </td>
            <td className="px-5 py-3 text-right font-bold">
              <CurrencyDisplay amount={summary.totalOutstanding} />
            </td>
            <td className="px-5 py-3" />
            <td className="px-5 py-3" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function AccountsReceivableView({
  data,
  groupedData,
  schoolYears,
  gradeLevels,
  defaultSchoolYearId = "",
  defaultGradeLevelId = "",
  defaultSearch = "",
  pagination,
  headerContent,
}: AccountsReceivableViewProps) {
  // Search input state - synced with URL param, navigates on change
  const [search, setSearch] = useState(defaultSearch);
  const debouncedSearch = useDebounce(search, 500);

  // Track if this is the initial mount to avoid navigating on first render
  const isInitialMount = useRef(true);

  // Calculate grand total from server-filtered data
  const grandTotal = useMemo(() => {
    return {
      totalAccounts: data.length,
      totalAssessed: data.reduce((sum, r) => sum + r.totalAmount, 0),
      totalPaid: data.reduce((sum, r) => sum + r.totalPaid, 0),
      totalOutstanding: data.reduce((sum, r) => sum + r.balance, 0),
    };
  }, [data]);

  /**
   * Navigate with the given filter values. Used by dropdowns and search for auto-apply.
   */
  const navigateWithFilters = (
    newSchoolYearId: string,
    newGradeLevelId: string,
    newSearch: string,
  ) => {
    const params = new URLSearchParams();
    if (newSchoolYearId) params.set("schoolYearId", newSchoolYearId);
    if (newGradeLevelId) params.set("gradeLevelId", newGradeLevelId);
    if (newSearch.trim()) params.set("search", newSearch.trim());
    const queryString = params.toString();
    const targetUrl = queryString
      ? `/staff/reports/accounts-receivable?${queryString}`
      : "/staff/reports/accounts-receivable";
    window.location.href = targetUrl;
  };

  // Navigate when debounced search changes (server-side search)
  useEffect(() => {
    // Skip navigation on initial mount - we already have the correct data
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Only navigate if the search actually changed from what's in the URL
    if (debouncedSearch !== defaultSearch) {
      navigateWithFilters(defaultSchoolYearId, defaultGradeLevelId, debouncedSearch);
    }
  }, [debouncedSearch, defaultSchoolYearId, defaultGradeLevelId, defaultSearch]);

  const handleSchoolYearChange = (value: string) => {
    const newSchoolYearId = value === "all" ? "" : value;
    navigateWithFilters(newSchoolYearId, defaultGradeLevelId, search);
  };

  const handleGradeLevelChange = (value: string) => {
    const newGradeLevelId = value === "all" ? "" : value;
    navigateWithFilters(defaultSchoolYearId, newGradeLevelId, search);
  };

  const handleReset = () => {
    setSearch("");
    window.location.href = "/staff/reports/accounts-receivable";
  };

  const hasFilters = defaultSchoolYearId !== "" || defaultGradeLevelId !== "" || defaultSearch !== "";

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/accounts-receivable/export";
  const buildExportUrl = (format: "pdf" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("format", format);
    if (defaultSchoolYearId) params.set("schoolYearId", defaultSchoolYearId);
    if (defaultGradeLevelId) params.set("gradeLevelId", defaultGradeLevelId);
    return `${exportBaseUrl}?${params.toString()}`;
  };

  const columns = useMemo<ColumnDef<AccountsReceivableRow>[]>(
    () => [
      {
        header: "Student ID",
        accessorKey: "studentRef",
        size: COL_SIZES.studentId,
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-mono)] text-sm">
            {row.original.studentRef}
          </span>
        ),
      },
      {
        header: "Student Name",
        accessorKey: "studentName",
        size: COL_SIZES.studentName,
        cell: ({ row }) => (
          <Link
            href={studentDetailUrl({ referenceNumber: row.original.studentRef })}
            className="text-primary hover:underline font-medium"
          >
            {row.original.studentName}
          </Link>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        size: COL_SIZES.schoolYear,
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {row.original.schoolYearLabel}
          </span>
        ),
      },
      {
        header: rightHeader("Total Assessed"),
        accessorKey: "totalAmount",
        size: COL_SIZES.totalAssessed,
        cell: ({ row }) => (
          <span className="block text-right">
            <CurrencyDisplay
              amount={row.original.totalAmount}
              className="text-sm text-muted-foreground"
            />
          </span>
        ),
      },
      {
        header: rightHeader("Amount Paid"),
        accessorKey: "totalPaid",
        size: COL_SIZES.amountPaid,
        cell: ({ row }) => (
          <span className="block text-right">
            <CurrencyDisplay
              amount={row.original.totalPaid}
              className="text-sm text-muted-foreground"
            />
          </span>
        ),
      },
      {
        header: rightHeader("Balance"),
        accessorKey: "balance",
        size: COL_SIZES.balance,
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
        header: "Last OR#",
        accessorKey: "lastOrNumber",
        size: COL_SIZES.lastOr,
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-mono)] text-sm">
            {row.original.lastOrNumber ?? "—"}
          </span>
        ),
      },
      {
        header: rightHeader("OR Date"),
        accessorKey: "orDate",
        size: COL_SIZES.orDate,
        cell: ({ row }) => (
          <span className="block text-right text-sm text-muted-foreground whitespace-nowrap">
            {row.original.orDate ? formatDate(row.original.orDate) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  // Determine if we should show grouped view (no grade level filter)
  // Show grouped view when no grade level filter is applied
  const showGrouped = !defaultGradeLevelId;

  return (
    <div className="flex flex-col">
      {/* Card Header with Filters */}
      <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title + Stats Badges */}
        {headerContent && (
          <div className="flex items-center gap-3 flex-wrap">{headerContent}</div>
        )}

        {/* Right: Filters + Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="filter-search w-48">
            <span className="filter-search-icon">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4 shrink-0"
                aria-hidden
              >
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

          {/* School Year Filter - auto-applies on change */}
          <Select
            value={defaultSchoolYearId || "all"}
            onValueChange={handleSchoolYearChange}
          >
            <SelectTrigger className="w-44 h-10" aria-label="School year">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {schoolYears.map((sy) => (
                <SelectItem key={sy.id} value={sy.id}>
                  {sy.label}
                  {sy.isActive && <span className="text-success ml-1">(Active)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Grade Level Filter - auto-applies on change */}
          <Select
            value={defaultGradeLevelId || "all"}
            onValueChange={handleGradeLevelChange}
          >
            <SelectTrigger className="w-40 h-10" aria-label="Grade level">
              <SelectValue placeholder="All Grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {gradeLevels.map((gl) => (
                <SelectItem key={gl.id} value={gl.id}>
                  {gl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear */}
          {hasFilters && (
            <button type="button" onClick={handleReset} className="filter-clear">
              Clear
            </button>
          )}

          {/* Separator */}
          <div className="filter-separator" />

          {/* Export Buttons */}
          <Link
            href={buildExportUrl("pdf")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            PDF
          </Link>
          <Link
            href={buildExportUrl("xlsx")}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0"
              aria-hidden
            >
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
      ) : showGrouped ? (
        /* Grouped view - show grade level headers with subtotals */
        <div className="flex flex-col">
          {groupedData.map((group) => (
            <div key={group.gradeLevelId}>
              <GradeLevelHeader name={group.gradeLevelName} count={group.rows.length} />
              <DataTable columns={columns} data={group.rows} enablePagination={false} useFixedLayout />
              <SubtotalRow subtotal={group.subtotal} />
            </div>
          ))}
          {groupedData.length > 0 && <GrandTotalRow summary={grandTotal} />}
        </div>
      ) : (
        /* Flat view - single grade level selected */
        <>
          <DataTable columns={columns} data={data} enablePagination={false} useFixedLayout />
          {data.length > 0 && <GrandTotalRow summary={grandTotal} />}
        </>
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
