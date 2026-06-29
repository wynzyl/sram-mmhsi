"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { useDebounce } from "@/hooks/useDebounce";
import type { CashierQueueRow } from "../payments.queries";

// Re-export type for consumers of this component
export type { CashierQueueRow };

interface CashierQueueTableProps {
  rows: CashierQueueRow[];
}

export function CashierQueueTable({ rows }: CashierQueueTableProps) {
  const [filterMode, setFilterMode] = useState<"all" | "newly_assessed" | "with_balance">("newly_assessed");
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const filteredRows = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
    if (filterMode === "newly_assessed") {
      return rows.filter(
        (row) =>
          row.totalPaid <= 0 &&
          (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
      );
    }
    if (filterMode === "with_balance") {
      return rows.filter(
        (row) =>
          row.totalPaid > 0 &&
          row.balance > 0 &&
          (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
      );
    }
    return rows.filter((row) =>
      (`${row.studentName} ${row.referenceNumber}`).toLowerCase().includes(normalizedSearch)
    );
  }, [filterMode, rows, debouncedSearch]);

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
            onClick={() => setFilterMode("all")}
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
            onClick={() => setFilterMode("newly_assessed")}
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
            onClick={() => setFilterMode("with_balance")}
          >
            Student with Balance
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        pageSize={12}
      />
    </div>
  );
}
