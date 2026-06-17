"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import type { ColumnDef } from "@tanstack/react-table";
import type { AccountsReceivableRow } from "../accounts-receivable-report.queries";

interface AccountsReceivableTableProps {
  data: AccountsReceivableRow[];
}

/** Right-aligned header so numeric/date columns line up with their cells.
 *  `flex-1` fills the DataTable's `flex items-center` header wrapper. */
function rightHeader(label: string) {
  const Header = () => <span className="flex-1 text-right">{label}</span>;
  Header.displayName = `RightHeader(${label})`;
  return Header;
}

export function AccountsReceivableTable({ data }: AccountsReceivableTableProps) {
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
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search by student ID or name..."
      enablePagination={false}
    />
  );
}
