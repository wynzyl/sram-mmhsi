"use client";

import { useActionState, useState, useMemo } from "react";
import { requestVoidAction, cancelVoidRequestAction } from "../void-requests.actions";
import type { RequestVoidFormState, CancelVoidRequestFormState } from "../void-requests.schema";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { FormStateAlert } from "@/components/forms/FormStateAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ColumnDef } from "@tanstack/react-table";

interface Payment {
  id: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: Date | string;
  status: string;
  referenceNumber: string | null;
  processedBy: string | null;
  /** Payment kind: 'payment' (original) or 'reversal' (offsetting entry) */
  kind?: string;
  /** For reversal rows: links to the original payment */
  reversesPaymentId?: string | null;
}

interface PendingVoidRequest {
  requestId: string;
  requestedBy: string;
  requestedByUsername: string;
}

interface PaymentsHistoryTableProps {
  payments: Payment[];
  /** Whether the current user can request voids (replaces legacy canVoid) */
  canRequestVoid: boolean;
  /** Map of paymentId -> pending void request info */
  pendingVoidByPaymentId?: Record<string, PendingVoidRequest>;
  /** Current user ID (for showing cancel button on own requests) */
  currentUserId?: string;
  /** Lay flush inside ledger (no extra top margin). */
  embedded?: boolean;
}

export default function PaymentsHistoryTable({
  payments,
  canRequestVoid,
  pendingVoidByPaymentId = {},
  currentUserId,
  embedded = false,
}: PaymentsHistoryTableProps) {
  // State for which payment's void request form is open
  const [requestVoidId, setRequestVoidId] = useState<string | null>(null);
  // State for which cancel request is pending confirmation
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);

  // Form states
  const initialRequestState: RequestVoidFormState = {};
  const [requestState, requestAction, requestPending] = useActionState(
    requestVoidAction,
    initialRequestState
  );

  const initialCancelState: CancelVoidRequestFormState = {};
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelVoidRequestAction,
    initialCancelState
  );

  const columns = useMemo<ColumnDef<Payment>[]>(() => {
    const baseColumns: ColumnDef<Payment>[] = [
      {
        header: "Date",
        accessorKey: "paymentDate",
        cell: ({ row }) => {
          const d = row.original.paymentDate;
          const date = d instanceof Date ? d : new Date(d);
          return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-PH") : "-";
        },
      },
      {
        header: "OR Number",
        accessorKey: "orNumber",
        cell: ({ row }) => {
          const payment = row.original;
          const isReversal = payment.kind === "reversal";
          const isBalanceForward = payment.kind === "balance_forward";

          if (isReversal) {
            return (
              <span className="text-[var(--color-text-muted)] italic text-sm">
                Reversal
              </span>
            );
          }

          if (isBalanceForward) {
            return (
              <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-200">
                BFX
              </Badge>
            );
          }

          return payment.orNumber ? (
            <ReferenceCode code={payment.orNumber} />
          ) : (
            <span className="text-[var(--color-text-muted)]">-</span>
          );
        },
      },
      {
        header: "Method",
        accessorKey: "paymentMethod",
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.paymentMethod.replace("_", " ")}
          </span>
        ),
      },
      {
        header: "Processed by",
        accessorKey: "processedBy",
        cell: ({ row }) =>
          row.original.processedBy ? (
            <span className="text-sm">{row.original.processedBy}</span>
          ) : (
            <span className="text-[var(--color-text-muted)]">-</span>
          ),
      },
      {
        header: "Ref #",
        accessorKey: "referenceNumber",
        cell: ({ row }) =>
          row.original.referenceNumber ? (
            <code className="text-xs font-[family-name:var(--font-mono)]">
              {row.original.referenceNumber}
            </code>
          ) : (
            <span className="text-[var(--color-text-muted)]">-</span>
          ),
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => {
          const payment = row.original;
          const amount = Number(payment.amount);
          const isNegative = amount < 0;

          return (
            <span className={isNegative ? "text-red-600" : ""}>
              {isNegative && "-"}
              <CurrencyDisplay
                amount={Math.abs(amount)}
                className="font-medium"
              />
            </span>
          );
        },
      },
      {
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => {
          const payment = row.original;
          const pendingRequest = pendingVoidByPaymentId[payment.id];
          const isReversal = payment.kind === "reversal";
          const isBalanceForward = payment.kind === "balance_forward";

          // Balance Forward entry
          if (isBalanceForward || payment.status === "balance_forward") {
            return (
              <Badge variant="info" className="bg-blue-100 text-blue-800 border-blue-200">
                TRANSFERRED
              </Badge>
            );
          }

          // Reversal entry
          if (isReversal || payment.status === "reversal") {
            return (
              <Badge variant="danger" className="bg-red-100 text-red-800 border-red-200">
                REVERSAL
              </Badge>
            );
          }

          // Original payment that was reversed
          if (payment.status === "reversed") {
            return (
              <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">
                REVERSED
              </Badge>
            );
          }

          // Legacy voided status
          if (payment.status === "voided") {
            return <Badge variant="danger">VOIDED</Badge>;
          }

          // Pending void request
          if (pendingRequest) {
            return (
              <Badge variant="warning" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                PENDING APPROVAL
              </Badge>
            );
          }

          // Posted
          return <Badge variant="success">POSTED</Badge>;
        },
      },
    ];

    // Actions column (for void request/cancel)
    if (canRequestVoid) {
      baseColumns.push({
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const payment = row.original;
          const pendingRequest = pendingVoidByPaymentId[payment.id];
          const isReversal = payment.kind === "reversal";
          const isBalanceForward = payment.kind === "balance_forward";

          // No actions for reversal rows
          if (isReversal || payment.status === "reversal") {
            return null;
          }

          // No actions for balance forward rows (cannot void BFX receipts)
          if (isBalanceForward || payment.status === "balance_forward") {
            return null;
          }

          // No actions for already voided/reversed
          if (payment.status === "voided" || payment.status === "reversed") {
            return null;
          }

          // If there's a pending request
          if (pendingRequest) {
            // Show cancel button if current user is the requester
            if (currentUserId && pendingRequest.requestedBy === currentUserId) {
              if (cancelRequestId === pendingRequest.requestId) {
                return (
                  <form action={cancelAction} className="flex gap-2 items-center">
                    <input type="hidden" name="requestId" value={pendingRequest.requestId} />
                    <span className="text-xs text-[var(--color-text-muted)]">Cancel?</span>
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
                      onClick={() => setCancelRequestId(null)}
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
                  onClick={() => setCancelRequestId(pendingRequest.requestId)}
                >
                  Cancel Request
                </Button>
              );
            }

            // Show who requested it (for other users)
            return (
              <span className="text-xs text-[var(--color-text-muted)]">
                Requested by {pendingRequest.requestedByUsername}
              </span>
            );
          }

          // Show request void form
          if (requestVoidId === payment.id) {
            return (
              <form action={requestAction} className="flex gap-2">
                <input type="hidden" name="paymentId" value={payment.id} />
                <Input
                  type="text"
                  name="requestReason"
                  placeholder="Reason for void"
                  required
                  className="w-40 h-8 text-xs"
                />
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  loading={requestPending}
                >
                  Submit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRequestVoidId(null)}
                >
                  Cancel
                </Button>
              </form>
            );
          }

          // Show request void button
          return (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setRequestVoidId(payment.id)}
            >
              Request Void
            </Button>
          );
        },
      });
    }

    return baseColumns;
  }, [
    canRequestVoid,
    requestVoidId,
    cancelRequestId,
    pendingVoidByPaymentId,
    currentUserId,
    requestAction,
    requestPending,
    cancelAction,
    cancelPending,
  ]);

  return (
    <div className={embedded ? undefined : "mt-6"}>
      <div className="mx-4 mt-4 space-y-2">
        <FormStateAlert state={requestState} />
        <FormStateAlert state={cancelState} />
      </div>

      <DataTable
        columns={columns}
        data={payments}
        searchable={false}
        pageSize={10}
      />
    </div>
  );
}
