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
import type { PaymentCollectionRow } from "../payment-collection-report.types";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
} from "../payment-collection-report.types";

interface PaymentCollectionTableProps {
  data: PaymentCollectionRow[];
}

function getMethodBadgeClass(method: string): string {
  switch (method) {
    case "cash":
      return "bg-success/15 text-success border-success/30";
    case "gcash":
      return "bg-info-tint text-info border-info/25";
    case "bank_transfer":
      return "bg-info-tint text-info border-info/25";
    case "check":
      return "bg-warning-tint text-warning border-warning/25";
    default:
      return "bg-muted text-foreground border-border";
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "posted":
      return "bg-success/15 text-success border-success/30";
    case "pending_confirmation":
      return "bg-warning-tint text-warning border-warning/25";
    case "reversal":
    case "reversed":
      return "bg-destructive/15 text-destructive border-destructive/30";
    default:
      return "bg-muted text-foreground border-border";
  }
}

export function PaymentCollectionTable({ data }: PaymentCollectionTableProps) {
  const columns = useMemo<ColumnDef<PaymentCollectionRow>[]>(
    () => [
      {
        header: "OR #",
        accessorKey: "orNumber",
        cell: ({ row }) => (
          <Badge
            variant="info"
            className="bg-info-tint text-info border-info/25 font-mono text-xs"
          >
            {row.original.orNumber || "—"}
          </Badge>
        ),
      },
      {
        header: "Date",
        accessorKey: "collectionDate",
        cell: ({ row }) =>
          formatDate(row.original.collectionDate, {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
      },
      {
        header: "Student",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="flex items-center">
              <Link
                href={`/staff/students/${row.original.studentRef}`}
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
        header: "Grade Level",
        accessorKey: "gradeLevel",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.gradeLevel}</span>
        ),
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => {
          const amount = Number(row.original.amount);
          return (
            <span className={`font-medium ${amount < 0 ? "text-destructive" : ""}`}>
              <CurrencyDisplay amount={amount} />
            </span>
          );
        },
      },
      {
        header: "Method",
        accessorKey: "paymentMethod",
        cell: ({ row }) => (
          <Badge
            variant="info"
            className={getMethodBadgeClass(row.original.paymentMethod)}
          >
            {PAYMENT_METHOD_LABELS[row.original.paymentMethod] ||
              row.original.paymentMethod}
          </Badge>
        ),
      },
      {
        header: "Reference #",
        accessorKey: "referenceNumber",
        cell: ({ row }) =>
          row.original.referenceNumber ? (
            <span className="text-sm font-mono">
              {row.original.referenceNumber}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: "Processed By",
        accessorKey: "processedBy",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.processedBy}</span>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge
            variant="info"
            className={getStatusBadgeClass(row.original.status)}
          >
            {PAYMENT_STATUS_LABELS[row.original.status] || row.original.status}
          </Badge>
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
      searchPlaceholder="Search by OR number, student name, reference..."
      pageSize={20}
    />
  );
}
