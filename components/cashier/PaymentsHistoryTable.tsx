"use client";

import { useActionState, useState, useMemo } from "react";
import { voidPaymentAction } from "@/actions/cashier";
import type { VoidPaymentFormState } from "@/lib/validators/cashier";
import { DataTable } from "@/components/data-display/DataTable";
import { ReferenceCode } from "@/components/data-display/ReferenceCode";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";
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
}

interface PaymentsHistoryTableProps {
  payments: Payment[];
  canVoid: boolean;
  /** Lay flush inside ledger (no extra top margin). */
  embedded?: boolean;
}

export default function PaymentsHistoryTable({
  payments,
  canVoid,
  embedded = false,
}: PaymentsHistoryTableProps) {
  const [voidId, setVoidId] = useState<string | null>(null);

  const initialState: VoidPaymentFormState = {};
  const [state, action, pending] = useActionState(
    voidPaymentAction,
    initialState
  );

  const columns = useMemo<ColumnDef<Payment>[]>(() => {
    const baseColumns: ColumnDef<Payment>[] = [
      {
        header: "Date",
        accessorKey: "paymentDate",
        cell: ({ row }) => {
          const d = row.original.paymentDate;
          const date = d instanceof Date ? d : new Date(d);
          return Number.isFinite(date.getTime()) ? date.toLocaleDateString("en-PH") : "—";
        },
      },
      {
        header: "OR Number",
        accessorKey: "orNumber",
        cell: ({ row }) =>
          row.original.orNumber ? (
            <ReferenceCode code={row.original.orNumber} />
          ) : (
            <span className="text-[var(--color-text-muted)]">—</span>
          ),
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
            <span className="text-[var(--color-text-muted)]">—</span>
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
            <span className="text-[var(--color-text-muted)]">—</span>
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
        header: "Status",
        accessorKey: "status",
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "voided" ? "danger" : "success"
            }
          >
            {row.original.status.toUpperCase()}
          </Badge>
        ),
      },
    ];

    if (canVoid) {
      baseColumns.push({
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const payment = row.original;

          if (payment.status === "voided" || voidId !== payment.id) {
            return payment.status !== "voided" ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setVoidId(payment.id)}
              >
                Void
              </Button>
            ) : null;
          }

          return (
            <form action={action} className="flex gap-2">
              <input type="hidden" name="paymentId" value={payment.id} />
              <Input
                type="text"
                name="voidReason"
                placeholder="Reason"
                required
                className="w-32 h-8 text-xs"
              />
              <Button
                type="submit"
                variant="danger"
                size="sm"
                loading={pending}
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVoidId(null)}
              >
                Cancel
              </Button>
            </form>
          );
        },
      });
    }

    return baseColumns;
  }, [canVoid, voidId, action, pending]);

  return (
    <div className={embedded ? undefined : "mt-6"}>
      {state.message && !state.success && (
        <div className="bg-red-100 text-red-700 border border-red-200 rounded-md p-4 mb-4 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {state.message}
        </div>
      )}

      <DataTable
        columns={columns}
        data={payments}
        searchable={false}
        pageSize={10}
      />
    </div>
  );
}
