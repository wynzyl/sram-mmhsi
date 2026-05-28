"use client";

import { useActionState, useState, useMemo } from "react";
import { cancelVoidRequestAction } from "../void-requests.actions";
import type { CancelVoidRequestFormState } from "../void-requests.schema";
import type { PendingVoidRequest } from "../void-requests.queries";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { useFormToast } from "@/hooks/useFormToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";

interface MyVoidRequestsTableProps {
  requests: PendingVoidRequest[];
}

export default function MyVoidRequestsTable({
  requests,
}: MyVoidRequestsTableProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const initialCancelState: CancelVoidRequestFormState = {};
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelVoidRequestAction,
    initialCancelState
  );

  useFormToast(cancelState, {
    successMessage: "Void request cancelled",
    onSuccess: () => setCancellingId(null),
  });

  const columns = useMemo<ColumnDef<PendingVoidRequest>[]>(
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
            <div className="text-xs text-muted-foreground">
              {row.original.studentRef}
            </div>
          </div>
        ),
      },
      {
        header: "Reason",
        accessorKey: "requestReason",
        cell: ({ row }) => (
          <span className="text-sm max-w-[200px] truncate block" title={row.original.requestReason}>
            {row.original.requestReason}
          </span>
        ),
      },
      {
        header: "Requested At",
        accessorKey: "requestedAt",
        cell: ({ row }) => {
          const date = new Date(row.original.requestedAt);
          return (
            <div className="text-sm">
              <div>{formatDate(date, { year: "numeric", month: "numeric", day: "numeric" })}</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(date, { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        },
      },
      {
        header: "Status",
        id: "status",
        cell: () => (
          <Badge variant="warning" className="bg-yellow-100 text-yellow-800 border-yellow-200">
            AWAITING APPROVAL
          </Badge>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const request = row.original;

          if (cancellingId === request.id) {
            return (
              <form action={cancelAction} className="flex gap-2 items-center">
                <input type="hidden" name="requestId" value={request.id} />
                <span className="text-xs text-muted-foreground">Cancel request?</span>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={cancelPending}
                >
                  Yes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCancellingId(null)}
                >
                  No
                </Button>
              </form>
            );
          }

          return (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCancellingId(request.id)}
            >
              Cancel
            </Button>
          );
        },
      },
    ],
    [cancellingId, cancelAction, cancelPending]
  );

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground mb-2">No pending void requests</div>
        <p className="text-sm text-muted-foreground">
          Your submitted void requests awaiting approval will appear here.
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
