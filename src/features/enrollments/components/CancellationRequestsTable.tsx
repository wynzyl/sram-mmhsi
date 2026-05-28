"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { CancellationRequestListItem } from "../enrollment-cancellation.queries";
import { CANCELLATION_REASON_LABELS, type CancellationReason } from "@/lib/constants/cancellation-reasons";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";

interface CancellationRequestsTableProps {
  requests: CancellationRequestListItem[];
  /**
   * Whether to show action links (admin only)
   */
  showActions?: boolean;
}

const STATUS_VARIANT_MAP: Record<string, "warning" | "success" | "danger" | "secondary"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "secondary",
};

export default function CancellationRequestsTable({
  requests,
  showActions = true,
}: CancellationRequestsTableProps) {
  const columns = useMemo<ColumnDef<CancellationRequestListItem>[]>(
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
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.gradeLevelName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.schoolYearLabel}
            </div>
          </div>
        ),
      },
      {
        header: "Reason",
        accessorKey: "reasonType",
        cell: ({ row }) => {
          const reasonType = row.original.reasonType as CancellationReason;
          return (
            <div className="max-w-[200px]">
              <div className="text-sm font-medium">
                {CANCELLATION_REASON_LABELS[reasonType]}
              </div>
              {row.original.remarks && (
                <div className="text-xs text-muted-foreground truncate" title={row.original.remarks}>
                  {row.original.remarks}
                </div>
              )}
            </div>
          );
        },
      },
      {
        header: "Requested By",
        accessorKey: "requestedByName",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.requestedByName}</div>
            <div className="text-xs text-muted-foreground">
              {new Date(row.original.requestedAt).toLocaleDateString("en-PH")}
            </div>
          </div>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const status = row.original.status;
          return (
            <Badge variant={STATUS_VARIANT_MAP[status] || "secondary"}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          );
        },
      },
      ...(showActions
        ? [
            {
              header: "Actions",
              id: "actions",
              cell: ({ row }: { row: { original: CancellationRequestListItem } }) => (
                <Link href={`/admin/cancellation-requests/${row.original.id}`}>
                  <Button variant="ghost" size="sm" className="h-8 gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </Button>
                </Link>
              ),
            } as ColumnDef<CancellationRequestListItem>,
          ]
        : []),
    ],
    [showActions]
  );

  return (
    <DataTable
      columns={columns}
      data={requests}
      searchable
      searchPlaceholder="Search by student name or reference..."
    />
  );
}
