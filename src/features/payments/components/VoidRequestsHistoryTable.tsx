"use client";

import { useMemo } from "react";
import type { VoidRequestHistoryRow } from "../void-requests.queries";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";

interface VoidRequestsHistoryTableProps {
  requests: VoidRequestHistoryRow[];
}

export default function VoidRequestsHistoryTable({
  requests,
}: VoidRequestsHistoryTableProps) {
  const columns = useMemo<ColumnDef<VoidRequestHistoryRow>[]>(
    () => [
      {
        header: "OR Number",
        accessorKey: "orNumber",
        cell: ({ row }) =>
          row.original.orNumber ? (
            <ReferenceCode code={row.original.orNumber} />
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => (
          <CurrencyDisplay
            amount={Number(row.original.amount)}
            className="font-medium"
          />
        ),
      },
      {
        header: "Student",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.studentName}</div>
            <div className="text-helper">
              {row.original.studentRef}
            </div>
          </div>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const status = row.original.status;
          switch (status) {
            case "approved":
              return <Badge variant="success">APPROVED</Badge>;
            case "rejected":
              return <Badge variant="danger">REJECTED</Badge>;
            case "cancelled":
              return (
                <Badge variant="secondary" className="bg-muted text-muted-foreground">
                  CANCELLED
                </Badge>
              );
            default:
              return <Badge variant="secondary">{status.toUpperCase()}</Badge>;
          }
        },
      },
      {
        header: "Reason",
        accessorKey: "requestReason",
        cell: ({ row }) => (
          <span
            className="text-sm max-w-[150px] truncate block"
            title={row.original.requestReason}
          >
            {row.original.requestReason}
          </span>
        ),
      },
      {
        header: "Requested By",
        accessorKey: "requestedByUsername",
        cell: ({ row }) => (
          <div className="text-sm">
            <div>{row.original.requestedByUsername}</div>
            <div className="text-helper">
              {formatDate(row.original.requestedAt, { year: "numeric", month: "numeric", day: "numeric" })}
            </div>
          </div>
        ),
      },
      {
        header: "Decided By",
        accessorKey: "decidedByUsername",
        cell: ({ row }) => {
          const request = row.original;

          // Cancelled requests don't have a decider
          if (request.status === "cancelled") {
            return (
              <div className="text-sm">
                <div className="text-muted-foreground italic">Self-cancelled</div>
                {request.cancelledAt && (
                  <div className="text-helper">
                    {formatDate(request.cancelledAt, { year: "numeric", month: "numeric", day: "numeric" })}
                  </div>
                )}
              </div>
            );
          }

          if (!request.decidedByUsername) {
            return <span className="text-muted-foreground">-</span>;
          }

          return (
            <div className="text-sm">
              <div>{request.decidedByUsername}</div>
              {request.decidedAt && (
                <div className="text-helper">
                  {formatDate(request.decidedAt, { year: "numeric", month: "numeric", day: "numeric" })}
                </div>
              )}
            </div>
          );
        },
      },
      {
        header: "Remarks",
        accessorKey: "decisionRemarks",
        cell: ({ row }) =>
          row.original.decisionRemarks ? (
            <span
              className="text-sm max-w-[150px] truncate block"
              title={row.original.decisionRemarks}
            >
              {row.original.decisionRemarks}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
    ],
    []
  );

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground mb-2">No void request history</div>
        <p className="text-secondary">
          Processed void requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={requests}
      searchable={false}
      pageSize={20}
    />
  );
}
