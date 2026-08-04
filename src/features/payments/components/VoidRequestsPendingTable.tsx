"use client";

import { useActionState, useState, useMemo, memo } from "react";
import {
  approveVoidRequestAction,
  rejectVoidRequestAction,
} from "../void-requests.actions";
import type {
  ApproveVoidRequestFormState,
  RejectVoidRequestFormState,
} from "../void-requests.schema";
import type { PendingVoidRequest } from "../void-requests.queries";
import { DataTable } from "@/components/shared/DataTable";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  createORNumberColumn,
  createRemarksColumn,
  createActionDateColumn,
  createStudentColumn,
} from "@/components/tables/column-factories";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { InlineConfirmButtons } from "@/components/shared/InlineConfirmButtons";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginatedResult } from "@/lib/types/pagination";

interface VoidRequestsPendingTableProps {
  requests: PendingVoidRequest[];
  /** Current user ID - used to block self-approval UI */
  currentUserId: string;
  /** Server-side pagination info */
  pagination?: PaginatedResult<unknown>["pagination"];
}

export default function VoidRequestsPendingTable({
  requests,
  currentUserId,
  pagination,
}: VoidRequestsPendingTableProps) {
  // State for which request's reject form is open
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  // State for rejection reason input value
  const [rejectReasonValue, setRejectReasonValue] = useState("");
  // State for which request's approve confirmation is open
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Form states
  const initialApproveState: ApproveVoidRequestFormState = {};
  const [approveState, approveAction, approvePending] = useActionState(
    approveVoidRequestAction,
    initialApproveState
  );

  const initialRejectState: RejectVoidRequestFormState = {};
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectVoidRequestAction,
    initialRejectState
  );

  useFormToast(approveState, {
    successMessage: "Void request approved successfully",
    onSuccess: () => setApprovingId(null),
  });

  useFormToast(rejectState, {
    successMessage: "Void request rejected",
    onSuccess: () => {
      setRejectingId(null);
      setRejectReasonValue("");
    },
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
      {
        header: "Requested By",
        accessorKey: "requestedByUsername",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.requestedByUsername}</span>
        ),
      },
      createActionDateColumn<PendingVoidRequest>("requestedAt", { header: "Requested At" }),
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const request = row.original;
          const isSelfRequest = request.requestedBy === currentUserId;

          // Block self-approval at UI level
          if (isSelfRequest) {
            return (
              <span className="text-xs text-muted-foreground italic">
                Cannot approve own request
              </span>
            );
          }

          // Show reject form with input
          if (rejectingId === request.id) {
            return (
              <form action={rejectAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <InlineConfirmButtons
                  confirmLabel="Reject"
                  isLoading={rejectPending}
                  variant="danger"
                  onCancel={() => {
                    setRejectingId(null);
                    setRejectReasonValue("");
                  }}
                  inputConfig={{
                    name: "decisionRemarks",
                    placeholder: "Rejection reason",
                    value: rejectReasonValue,
                    onChange: setRejectReasonValue,
                    required: true,
                  }}
                />
              </form>
            );
          }

          // Show approve confirmation
          if (approvingId === request.id) {
            return (
              <form action={approveAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <InlineConfirmButtons
                  prompt="Approve void?"
                  confirmLabel="Confirm"
                  isLoading={approvePending}
                  variant="success"
                  onCancel={() => setApprovingId(null)}
                />
              </form>
            );
          }

          // Default action buttons
          return (
            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => setApprovingId(request.id)}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setRejectReasonValue("");
                  setRejectingId(request.id);
                }}
              >
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    [
      currentUserId,
      rejectingId,
      rejectReasonValue,
      approvingId,
      approveAction,
      approvePending,
      rejectAction,
      rejectPending,
    ]
  );

  if (requests.length === 0) {
    return (
      <div className="p-8 text-center">
        <div className="text-muted-foreground mb-2">No pending void requests</div>
        <p className="text-sm text-muted-foreground">
          Void requests from cashiers and registrars will appear here for approval.
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
      {pagination && (
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalRecords={pagination.totalRecords}
          pageSize={pagination.pageSize}
          baseUrl="/staff/approvals?tab=void"
          itemLabel="requests"
        />
      )}
    </div>
  );
}
