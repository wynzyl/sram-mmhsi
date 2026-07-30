"use client";

import { useActionState, useState, useMemo } from "react";
import { cancelVoidRequestAction } from "../void-requests.actions";
import type { CancelVoidRequestFormState } from "../void-requests.schema";
import type { PendingVoidRequest } from "../void-requests.queries";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { PaginationControls } from "@/components/shared/PaginationControls";
import {
  createORNumberColumn,
  createRemarksColumn,
  createActionDateColumn,
  createStudentColumn,
} from "@/components/tables/column-factories";
import { useFormToast } from "@/hooks/useFormToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginatedResult } from "@/lib/types/pagination";

interface MyVoidRequestsTableProps {
  requests: PendingVoidRequest[];
  /** Server-side pagination info */
  pagination?: PaginatedResult<unknown>["pagination"];
}

export default function MyVoidRequestsTable({
  requests,
  pagination,
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
      createORNumberColumn<PendingVoidRequest>("orNumber"),
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
      createStudentColumn<PendingVoidRequest>({ refKey: "studentRef" }),
      createRemarksColumn<PendingVoidRequest>("requestReason", { header: "Reason" }),
      createActionDateColumn<PendingVoidRequest>("requestedAt", { header: "Requested At" }),
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
    <div>
      <DataTable
        columns={columns}
        data={requests}
        searchable={false}
        pageSize={20}
        enablePagination={!pagination || pagination.totalPages <= 1}
      />
      {pagination && pagination.totalPages > 1 && (
        <PaginationControls pagination={pagination} basePath="/staff/approvals" />
      )}
    </div>
  );
}
