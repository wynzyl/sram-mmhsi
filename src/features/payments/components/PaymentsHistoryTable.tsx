"use client";

import { useActionState, useMemo, memo } from "react";
import { requestVoidAction, cancelVoidRequestAction } from "../void-requests.actions";
import type { RequestVoidFormState, CancelVoidRequestFormState } from "../void-requests.schema";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { useFormToast } from "@/hooks/useFormToast";
import { useInlineConfirm } from "@/hooks/useInlineConfirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InlineConfirmButtons,
  InlineConfirmTrigger,
} from "@/components/shared/InlineConfirmButtons";
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

// ─────────────────────────────────────────────────────────────────────────────
// VoidActionsCell - Extracted to prevent column regeneration on state changes
// ─────────────────────────────────────────────────────────────────────────────

interface VoidActionsCellProps {
  payment: Payment;
  pendingRequest?: PendingVoidRequest;
  currentUserId?: string;
}

/**
 * Memoized cell component for void request/cancel actions.
 * Extracted from column definition to prevent entire column array from
 * regenerating when form state changes (requestVoidId, cancelRequestId, etc.).
 */
const VoidActionsCell = memo(function VoidActionsCell({
  payment,
  pendingRequest,
  currentUserId,
}: VoidActionsCellProps) {
  const requestConfirm = useInlineConfirm();
  const cancelConfirm = useInlineConfirm();

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

  useFormToast(requestState, {
    successMessage: "Void request submitted successfully",
    onSuccess: () => requestConfirm.reset(),
  });

  useFormToast(cancelState, {
    successMessage: "Void request cancelled",
    onSuccess: () => cancelConfirm.reset(),
  });

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
      if (cancelConfirm.isConfirming) {
        return (
          <form action={cancelAction}>
            <input type="hidden" name="requestId" value={pendingRequest.requestId} />
            <InlineConfirmButtons
              prompt="Cancel?"
              confirmLabel="Yes"
              cancelLabel="No"
              isLoading={cancelPending}
              variant="danger"
              onCancel={cancelConfirm.hideConfirm}
            />
          </form>
        );
      }

      return (
        <Button
          variant="secondary"
          size="sm"
          onClick={cancelConfirm.showConfirm}
        >
          Cancel Request
        </Button>
      );
    }

    // Show who requested it (for other users)
    return (
      <span className="text-xs text-muted-foreground">
        Requested by {pendingRequest.requestedByUsername}
      </span>
    );
  }

  // Show request void form with input
  if (requestConfirm.isConfirming) {
    return (
      <form action={requestAction}>
        <input type="hidden" name="paymentId" value={payment.id} />
        <InlineConfirmButtons
          confirmLabel="Submit"
          isLoading={requestPending}
          variant="danger"
          onCancel={requestConfirm.hideConfirm}
          inputConfig={{
            name: "requestReason",
            placeholder: "Reason for void",
            value: requestConfirm.inputValue,
            onChange: requestConfirm.setInputValue,
            required: true,
          }}
        />
      </form>
    );
  }

  // Show request void button
  return (
    <InlineConfirmTrigger
      label="Request Void"
      variant="danger"
      onClick={requestConfirm.showConfirm}
    />
  );
});

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
  // Columns are now stable - action state moved to VoidActionsCell component
  const columns = useMemo<ColumnDef<Payment>[]>(() => {
    const baseColumns: ColumnDef<Payment>[] = [
      {
        header: "Date",
        accessorKey: "paymentDate",
        cell: ({ row }) => {
          const d = row.original.paymentDate;
          const date = d instanceof Date ? d : new Date(d);
          return Number.isFinite(date.getTime())
            ? formatDate(date, { year: "numeric", month: "numeric", day: "numeric" })
            : "-";
        },
      },
      {
        header: "OR Number",
        accessorKey: "orNumber",
        cell: ({ row }) => {
          const payment = row.original;
          const isReversal = payment.kind === "reversal";
          const isBalanceForward =
            payment.kind === "balance_forward" ||
            payment.status === "balance_forward";

          if (isReversal) {
            return (
              <span className="text-muted-foreground italic text-sm">
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
            <span className="text-muted-foreground">-</span>
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
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        header: "Ref #",
        accessorKey: "referenceNumber",
        cell: ({ row }) =>
          row.original.referenceNumber ? (
            <code className="text-xs font-mono">
              {row.original.referenceNumber}
            </code>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        header: "Amount",
        accessorKey: "amount",
        cell: ({ row }) => {
          const payment = row.original;
          const amount = Number(payment.amount);
          const isBalanceForward = payment.kind === "balance_forward";
          // BFX amounts are stored as negative but should display as positive
          const displayAmount = isBalanceForward ? Math.abs(amount) : amount;
          const isNegative = displayAmount < 0;

          return (
            <span className={isNegative ? "text-red-600" : ""}>
              {isNegative && "-"}
              <CurrencyDisplay
                amount={Math.abs(displayAmount)}
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

    // Actions column - uses memoized VoidActionsCell to isolate state changes
    if (canRequestVoid) {
      baseColumns.push({
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const payment = row.original;
          const pendingRequest = pendingVoidByPaymentId[payment.id];
          return (
            <VoidActionsCell
              payment={payment}
              pendingRequest={pendingRequest}
              currentUserId={currentUserId}
            />
          );
        },
      });
    }

    return baseColumns;
  }, [canRequestVoid, pendingVoidByPaymentId, currentUserId]);

  return (
    <div className={embedded ? undefined : "mt-6"}>
      <DataTable
        columns={columns}
        data={payments}
        searchable={false}
        pageSize={10}
      />
    </div>
  );
}
