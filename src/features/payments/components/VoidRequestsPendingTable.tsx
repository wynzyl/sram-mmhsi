"use client";

import { useActionState, useState, useMemo } from "react";
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
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";
import { InlineConfirmButtons } from "@/components/shared/InlineConfirmButtons";
import type { ColumnDef } from "@tanstack/react-table";

interface VoidRequestsPendingTableProps {
  requests: PendingVoidRequest[];
  /** Current user ID - used to block self-approval UI */
  currentUserId: string;
}

export default function VoidRequestsPendingTable({
  requests,
  currentUserId,
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
        header: "Requested By",
        accessorKey: "requestedByUsername",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.requestedByUsername}</span>
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
                  onCancel={() => setRejectingId(null)}
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
                onClick={() => setRejectingId(request.id)}
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
    <DataTable
      columns={columns}
      data={requests}
      searchable={false}
      pageSize={20}
    />
  );
}
