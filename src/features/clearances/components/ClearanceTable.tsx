"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ClearanceListItem } from "../clearances.queries";
import { CLEARANCE_TYPE_LABELS, type ClearanceType } from "../clearances.schema";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";

interface ClearanceTableProps {
  clearances: ClearanceListItem[];
  /**
   * Whether to show action links
   */
  showActions?: boolean;
}

// Clearance status colors are mapped internally in Badge component

export default function ClearanceTable({
  clearances,
  showActions = true,
}: ClearanceTableProps) {
  const columns = useMemo<ColumnDef<ClearanceListItem>[]>(
    () => [
      {
        header: "Student",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.studentName}</div>
            <div className="text-xs text-muted-foreground">
              <ReferenceCode code={row.original.studentRef} />
            </div>
          </div>
        ),
      },
      {
        header: "Type",
        accessorKey: "clearanceType",
        cell: ({ row }) => (
          <div className="text-sm">
            <div className="font-medium">
              {CLEARANCE_TYPE_LABELS[row.original.clearanceType as ClearanceType]}
            </div>
            {row.original.schoolYearLabel && (
              <div className="text-xs text-muted-foreground">
                {row.original.schoolYearLabel}
              </div>
            )}
          </div>
        ),
      },
      {
        header: "Outstanding",
        accessorKey: "outstandingAmount",
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={Number(row.original.outstandingAmount)}
            className={Number(row.original.outstandingAmount) > 0 ? "font-medium text-warning" : "text-success"}
          />
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          // Map clearance status to badge variant
          const status = row.original.status;
          const variantMap: Record<string, "success" | "warning" | "info"> = {
            cleared: "success",
            pending: "warning",
            waived: "info",
          };
          return (
            <Badge variant={variantMap[status] || "secondary"}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      },
      {
        header: "Created",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <div className="text-sm">
            {formatDate(row.original.createdAt, { year: "numeric", month: "numeric", day: "numeric" })}
          </div>
        ),
      },
      ...(showActions
        ? [
            {
              header: "Actions",
              id: "actions",
              cell: ({ row }: { row: { original: ClearanceListItem } }) => (
                <Link href={`/admin/clearances/${row.original.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {row.original.status === "pending" ? "Resolve" : "View"}
                  </Button>
                </Link>
              ),
            } as ColumnDef<ClearanceListItem>,
          ]
        : []),
    ],
    [showActions]
  );

  return (
    <DataTable
      columns={columns}
      data={clearances}
      searchable
      searchPlaceholder="Search by student name or reference..."
    />
  );
}
