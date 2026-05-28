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
import { Input } from "@/components/ui/input";
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
    onSuccess: () => setRejectingId(null),
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

          // Show reject form
          if (rejectingId === request.id) {
            return (
              <form action={rejectAction} className="flex gap-2 items-center">
                <input type="hidden" name="requestId" value={request.id} />
                <Input
                  type="text"
                  name="decisionRemarks"
                  placeholder="Rejection reason"
                  required
                  className="w-36 h-8 text-xs"
                />
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={rejectPending}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRejectingId(null)}
                >
                  Cancel
                </Button>
              </form>
            );
          }

          // Show approve confirmation
          if (approvingId === request.id) {
            return (
              <form action={approveAction} className="flex gap-2 items-center">
                <input type="hidden" name="requestId" value={request.id} />
                <span className="text-xs text-muted-foreground">Approve void?</span>
                <Button
                  type="submit"
                  variant="success"
                  size="sm"
                  loading={approvePending}
                >
                  Confirm
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setApprovingId(null)}
                >
                  Cancel
                </Button>
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
