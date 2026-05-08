"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-display/DataTable";
import { StatusBadge } from "@/components/data-display/StatusBadge";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";
import { ReferenceCode } from "@/components/data-display/ReferenceCode";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type CashierQueueRow = {
  assessmentId: string;
  studentName: string;
  referenceNumber: string;
  gradeLevel: string;
  schoolYear: string;
  billingStatus: string;
  balance: number;
  totalPaid: number;
};

interface CashierQueueTableProps {
  rows: CashierQueueRow[];
}

export function CashierQueueTable({ rows }: CashierQueueTableProps) {
  const [filterMode, setFilterMode] = useState<"all" | "newly_assessed" | "with_balance">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
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
  }, [filterMode, rows, searchQuery]);

  const columns: ColumnDef<CashierQueueRow>[] = [
    {
      header: "Student",
      accessorFn: (row) => `${row.studentName} ${row.referenceNumber}`,
      id: "student",
      cell: ({ row }) => (
        <div className="min-w-[16rem]">
          <div className="font-semibold text-[var(--color-text)]">{row.original.studentName}</div>
          <div className="mt-1">
            <ReferenceCode code={row.original.referenceNumber} />
          </div>
        </div>
      ),
    },
    {
      header: "Grade Level",
      accessorKey: "gradeLevel",
      cell: ({ row }) => <span className="text-[var(--color-text-2)]">{row.original.gradeLevel}</span>,
    },
    {
      header: "School Year",
      accessorKey: "schoolYear",
      cell: ({ row }) => <span className="text-[var(--color-text-2)]">{row.original.schoolYear}</span>,
    },
    {
      header: "Status",
      accessorKey: "billingStatus",
      cell: ({ row }) => <StatusBadge type="billing" status={row.original.billingStatus} />,
    },
    {
      header: () => <span className="block text-right">Balance</span>,
      accessorKey: "balance",
      cell: ({ row }) => (
        <div className="text-right font-semibold">
          <CurrencyDisplay amount={row.original.balance} />
        </div>
      ),
    },
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
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
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

