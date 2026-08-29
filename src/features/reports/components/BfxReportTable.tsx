"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { SpedBadge } from "@/components/shared/SpedBadge";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import type { BfxTransferRow } from "../balance-forward-report.queries";

interface BfxReportTableProps {
  data: BfxTransferRow[];
}

export function BfxReportTable({ data }: BfxReportTableProps) {
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
            <span className="flex items-center">
              <Link
                href={`/staff/students/${row.original.studentId}`}
                className="text-primary hover:underline font-medium"
              >
                {row.original.studentName}
              </Link>
              <SpedBadge isSped={row.original.isSpecialEducation} />
            </span>
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
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search by BFX number, student name..."
      pageSize={20}
    />
  );
}
