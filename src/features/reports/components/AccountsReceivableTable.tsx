"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { studentDetailUrl } from "@/lib/utils/student-routes";
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
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {row.original.schoolYearLabel}
          </span>
        ),
      },
      {
        header: rightHeader("Total Assessed"),
        accessorKey: "totalAmount",
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
        cell: ({ row }) => (
          <span className="font-[family-name:var(--font-mono)] text-sm">
            {row.original.lastOrNumber ?? "—"}
          </span>
        ),
      },
      {
        header: rightHeader("OR Date"),
        accessorKey: "orDate",
        cell: ({ row }) => (
          <span className="block text-right text-sm text-muted-foreground whitespace-nowrap">
            {row.original.orDate ? formatDate(row.original.orDate) : "—"}
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
