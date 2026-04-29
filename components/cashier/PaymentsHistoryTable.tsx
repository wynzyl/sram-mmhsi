"use client";

import { useActionState, useState } from "react";
import { voidPaymentAction } from "@/actions/cashier";
import type { VoidPaymentFormState } from "@/lib/validators/cashier";

interface Payment {
  id: string;
  orNumber: string | null;
  amount: string;
  paymentMethod: string;
  paymentDate: Date;
  status: string;
  referenceNumber: string | null;
}

interface PaymentsHistoryTableProps {
  payments: Payment[];
  canVoid: boolean;
}

export default function PaymentsHistoryTable({
  payments,
  canVoid,
}: PaymentsHistoryTableProps) {
  const [voidId, setVoidId] = useState<string | null>(null);

  const initialState: VoidPaymentFormState = {};
  const [state, action, pending] = useActionState(voidPaymentAction, initialState);

  // Automatically reset voidId on success, handled loosely here
  // Next.js revalidation handles the UI refresh

  return (
    <div className="table-wrapper mt-6">
      {state.message && !state.success && (
        <div className="alert alert-error mb-4">{state.message}</div>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>OR Number</th>
            <th>Method</th>
            <th>Ref #</th>
            <th>Amount</th>
            <th>Status</th>
            {canVoid && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={canVoid ? 7 : 6} className="table-empty">
                No payments recorded yet.
              </td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id} className={payment.status === "voided" ? "table-row-dimmed" : ""}>
                <td>{payment.paymentDate.toLocaleDateString()}</td>
                <td style={{ fontWeight: "bold" }}>{payment.orNumber || "—"}</td>
                <td style={{ textTransform: "capitalize" }}>{payment.paymentMethod.replace("_", " ")}</td>
                <td>{payment.referenceNumber || "—"}</td>
                <td style={{ fontWeight: 500 }}>
                  ₱{Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <span
                    className={`badge ${
                      payment.status === "voided"
                        ? "badge-danger"
                        : "badge-success"
                    }`}
                  >
                    {payment.status.toUpperCase()}
                  </span>
                </td>
                {canVoid && (
                  <td>
                    {payment.status !== "voided" && voidId !== payment.id && (
                      <button
                        className="btn-danger btn-sm"
                        onClick={() => setVoidId(payment.id)}
                      >
                        Void
                      </button>
                    )}
                    {voidId === payment.id && (
                      <form action={action} style={{ display: "flex", gap: "0.5rem" }}>
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <input
                          type="text"
                          name="voidReason"
                          placeholder="Reason"
                          required
                          className="form-control"
                          style={{ padding: "0.2rem 0.5rem", fontSize: "0.8rem", width: "120px" }}
                        />
                        <button type="submit" className="btn-danger btn-sm" disabled={pending}>
                          {pending ? "..." : "Confirm"}
                        </button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setVoidId(null)}>
                          Cancel
                        </button>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
