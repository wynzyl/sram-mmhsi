"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import {
  createStudentColumn,
  createTextColumn,
  createStatusColumn,
  createCurrencyColumn,
} from "@/components/tables/column-factories";
import { buttonVariants } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { cn } from "@/lib/utils/cn";
import { ClientTablePagination } from "@/components/ui/ClientTablePagination";
import type { CashierQueueRow } from "../payments.queries";

// Re-export type for consumers of this component
export type { CashierQueueRow };

const PAGE_SIZE = 25;

interface CashierQueueStats {
  pendingPaymentsCount: number;
  totalCollectedToday: number;
  totalCollectibles: number;
}

interface CashierQueueTableProps {
  rows: CashierQueueRow[];
  stats?: CashierQueueStats;
  isFetching?: boolean;
}

export function CashierQueueTable({ rows, stats, isFetching }: CashierQueueTableProps) {
  const [filterMode, setFilterMode] = useState<"all" | "newly_assessed" | "with_balance">("newly_assessed");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();

    let filtered: CashierQueueRow[];

    if (filterMode === "newly_assessed") {
      filtered = rows.filter(
        (row) =>
          row.totalPaid <= 0 &&
          (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
      );
      // Keep server order for newly_assessed (by updatedAt)
      return filtered;
    }

    if (filterMode === "with_balance") {
      filtered = rows.filter(
        (row) =>
          row.totalPaid > 0 &&
          row.balance > 0 &&
          (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
      );
    } else {
      // "all" mode
      filtered = rows.filter((row) =>
        (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
      );
    }

    // Sort alphabetically by student name (A-Z) for "all" and "with_balance"
    return filtered.sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [filterMode, rows, debouncedSearch]);

  // Calculate pagination - clamp page to valid range
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const effectivePage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    const start = (effectivePage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, effectivePage]);

  // Filter mode change handler - reset page to 1
  const handleFilterModeChange = (mode: "all" | "newly_assessed" | "with_balance") => {
    setFilterMode(mode);
    setCurrentPage(1);
  };

  // Reset page when debounced search changes (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

  const columns: ColumnDef<CashierQueueRow>[] = [
    createStudentColumn<CashierQueueRow>({ refKey: "referenceNumber" }),
    createTextColumn<CashierQueueRow>("gradeLevel", {
      header: "Grade Level",
      className: "text-gray-600 dark:text-gray-400",
    }),
    createTextColumn<CashierQueueRow>("schoolYear", {
      header: "School Year",
      className: "text-gray-600 dark:text-gray-400",
    }),
    createStatusColumn<CashierQueueRow>("billingStatus", {
      header: "Status",
      type: "billing",
    }),
    createCurrencyColumn<CashierQueueRow>("balance", {
      header: "Balance",
      align: "right",
    }),
    {
      header: () => <span className="block text-right">Action</span>,
      id: "action",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Link
            href={`/staff/payments/process/${row.original.assessmentId}`}
            prefetch={false}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Process payment
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      {/* Card Header with Filters */}
      <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Title + Stats Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Pending Payments
          </h2>
          {stats && (
            <>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
                {stats.pendingPaymentsCount} Pending
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                Today: <CurrencyDisplay amount={stats.totalCollectedToday} />
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                Collectibles: <CurrencyDisplay amount={stats.totalCollectibles} />
              </span>
            </>
          )}
          {isFetching && (
            <span className="text-xs text-muted-foreground" aria-live="polite">
              Refreshing…
            </span>
          )}
        </div>

        {/* Right: Search + Filter Buttons */}
        <div className="filter-controls-inline">
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search..."
              className="filter-search-input"
              autoComplete="off"
            />
          </div>

          {/* Filter Buttons */}
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: filterMode === "all" ? "primary" : "secondary", size: "sm" })
            )}
            onClick={() => handleFilterModeChange("all")}
          >
            All
          </button>
          <button
            type="button"
            className={cn(
              buttonVariants({
                variant: filterMode === "newly_assessed" ? "primary" : "secondary",
                size: "sm",
              })
            )}
            onClick={() => handleFilterModeChange("newly_assessed")}
          >
            Newly Assessed
          </button>
          <button
            type="button"
            className={cn(
              buttonVariants({
                variant: filterMode === "with_balance" ? "primary" : "secondary",
                size: "sm",
              })
            )}
            onClick={() => handleFilterModeChange("with_balance")}
          >
            With Balance
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={paginatedRows}
        enablePagination={false}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-border px-4 py-3">
          <ClientTablePagination
            currentPage={effectivePage}
            totalPages={totalPages}
            totalRecords={filteredRows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="students"
          />
        </div>
      )}
    </div>
  );
}
