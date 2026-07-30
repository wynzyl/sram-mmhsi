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
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { ClientTablePagination } from "@/components/ui/ClientTablePagination";
import type { CashierQueueRow } from "../payments.queries";

// Re-export type for consumers of this component
export type { CashierQueueRow };

const PAGE_SIZE = 25;

interface CashierQueueTableProps {
  rows: CashierQueueRow[];
}

export function CashierQueueTable({ rows }: CashierQueueTableProps) {
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search student name / reference number..."
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: filterMode === "all" ? "primary" : "secondary", size: "sm" })
            )}
            onClick={() => handleFilterModeChange("all")}
          >
            All Queue
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
            Student with Balance
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={paginatedRows}
        enablePagination={false}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <ClientTablePagination
          currentPage={effectivePage}
          totalPages={totalPages}
          totalRecords={filteredRows.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="students"
        />
      )}
    </div>
  );
}
