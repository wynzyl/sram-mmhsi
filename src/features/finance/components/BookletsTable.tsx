"use client";

import { useMemo } from "react";
import { Download, Pencil, SlidersHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { formatStoredOrNumber, orNumberPadWidth } from "@/lib/utils/or-number";
import { getReceiptStatusClasses } from "@/lib/utils/receipt-theme";
import { formatDate } from "@/lib/utils/date";

interface ReceiptBooklet {
  id: string;
  series: string;
  prefix: string;
  startNumber: number;
  endNumber: number;
  nextNumber: number;
  status: string;
  usageMode: "auto_only" | "manual_only";
  createdAt: Date;
  assignedToUsername: string | null;
}

interface BookletsTableProps {
  booklets: ReceiptBooklet[];
  variant?: "default" | "dashboard";
}

/**
 * Reusable receipt booklets table with two display variants:
 * - "default": Full table for finance management pages
 * - "dashboard": Card-style with header for dashboard widgets
 */
export default function BookletsTable({ booklets, variant = "default" }: BookletsTableProps) {
  const w = orNumberPadWidth();

  // Default variant columns (full details)
  const defaultColumns = useMemo<ColumnDef<ReceiptBooklet>[]>(
    () => [
      {
        header: "Series",
        id: "series",
        accessorKey: "series",
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.series}</span>
        ),
      },
      {
        header: "OR Prefix",
        id: "prefix",
        accessorKey: "prefix",
        cell: ({ row }) => (
          <span className="font-semibold">{row.original.prefix}</span>
        ),
      },
      {
        header: "Start Number",
        id: "startNumber",
        accessorKey: "startNumber",
        cell: ({ row }) => (
          <span className="font-mono">
            {String(row.original.startNumber).padStart(w, "0")}
          </span>
        ),
      },
      {
        header: "End Number",
        id: "endNumber",
        accessorKey: "endNumber",
        cell: ({ row }) => (
          <span className="font-mono">
            {String(row.original.endNumber).padStart(w, "0")}
          </span>
        ),
      },
      {
        header: "Next OR",
        id: "nextNumber",
        accessorKey: "nextNumber",
        cell: ({ row }) => {
          const booklet = row.original;
          if (booklet.status !== "active") {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <span className="font-mono text-primary">
              {formatStoredOrNumber(booklet.prefix, booklet.nextNumber)}
            </span>
          );
        },
      },
      {
        header: "Mode",
        id: "usageMode",
        accessorKey: "usageMode",
        cell: ({ row }) => {
          const isAuto = row.original.usageMode === "auto_only";
          return (
            <span className={`badge ${isAuto ? "badge-info" : "badge-warning"}`}>
              {isAuto ? "Auto" : "Manual"}
            </span>
          );
        },
      },
      {
        header: "Assigned To",
        id: "assignedTo",
        accessorKey: "assignedToUsername",
        cell: ({ row }) => {
          const username = row.original.assignedToUsername;
          if (!username) {
            return <span className="text-muted-foreground">—</span>;
          }
          return <span className="badge badge-purple">{username}</span>;
        },
      },
      {
        header: "Status",
        id: "status",
        accessorKey: "status",
        cell: ({ row }) => (
          <span
            className={`badge capitalize ${getReceiptStatusClasses(row.original.status)}`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        header: "Created At",
        id: "createdAt",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.createdAt, {
              year: "numeric",
              month: "numeric",
              day: "numeric",
            })}
          </span>
        ),
      },
    ],
    [w]
  );

  // Dashboard variant columns (compact with combined fields)
  const dashboardColumns = useMemo<ColumnDef<ReceiptBooklet>[]>(
    () => [
      {
        header: "Booklet ID",
        id: "bookletId",
        accessorFn: (row) => `${row.prefix} ${row.series}`,
        cell: ({ row }) => (
          <div>
            <p className="font-semibold tracking-wide text-foreground">
              {row.original.prefix}
            </p>
            <p className="mt-1 font-mono text-[13px] text-muted-foreground">
              {row.original.series}
            </p>
          </div>
        ),
      },
      {
        header: "Range",
        id: "range",
        accessorFn: (row) => `${row.startNumber}-${row.endNumber}`,
        cell: ({ row }) => (
          <span className="font-mono text-foreground">
            {String(row.original.startNumber).padStart(w, "0")}
            <span className="text-muted-foreground">
              {" "}– {String(row.original.endNumber).padStart(w, "0")}
            </span>
          </span>
        ),
      },
      {
        header: "Current",
        id: "current",
        accessorKey: "nextNumber",
        cell: ({ row }) => {
          const booklet = row.original;
          return (
            <span className="inline-flex min-w-[92px] items-center justify-center border border-border bg-muted px-2 py-1 font-mono text-[13px] text-foreground">
              {booklet.status === "active"
                ? formatStoredOrNumber(booklet.prefix, booklet.nextNumber)
                : "--"}
            </span>
          );
        },
      },
      {
        header: "Mode",
        id: "usageMode",
        accessorKey: "usageMode",
        cell: ({ row }) => {
          const isAuto = row.original.usageMode === "auto_only";
          return (
            <span
              className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium ${
                isAuto
                  ? "border-info/30 bg-info/10 text-info"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}
            >
              {isAuto ? "Auto" : "Manual"}
            </span>
          );
        },
      },
      {
        header: "Assigned To",
        id: "assignedTo",
        accessorKey: "assignedToUsername",
        cell: ({ row }) => {
          const username = row.original.assignedToUsername;
          if (!username) {
            return <span className="text-secondary">—</span>;
          }
          return (
            <span className="inline-flex items-center rounded-md border border-info/30 bg-info/10 px-3 py-1 text-xs font-medium text-info">
              {username}
            </span>
          );
        },
      },
      {
        header: "Date Issued",
        id: "dateIssued",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-secondary">
            {formatDate(row.original.createdAt, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        ),
      },
      {
        header: "Status",
        id: "status",
        accessorKey: "status",
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium capitalize ${getReceiptStatusClasses(row.original.status)}`}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        header: "",
        id: "actions",
        cell: () => (
          <div className="text-right">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [w]
  );

  // Dashboard variant with card wrapper
  if (variant === "dashboard") {
    return (
      <div className="bg-card border border-border rounded-md p-0">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-3xl text-foreground">
            Active Booklets
          </h2>
          <div className="flex-row-2">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted"
              aria-label="Filter"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 text-muted-foreground bg-transparent border-none rounded-md cursor-pointer transition-colors hover:text-foreground hover:bg-muted"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
        <DataTable
          columns={dashboardColumns}
          data={booklets}
          searchable={false}
          enablePagination={false}
        />
      </div>
    );
  }

  // Default variant
  return (
    <DataTable
      columns={defaultColumns}
      data={booklets}
      searchable={false}
      enablePagination={booklets.length > 20}
      pageSize={20}
    />
  );
}
