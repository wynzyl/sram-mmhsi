"use client";

import { useActionState, useEffect, useState } from "react";
import { postPaymentAction } from "@/actions/cashier";
import type { PaymentFormState } from "@/lib/validators/cashier";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { CurrencyDisplay } from "@/components/data-display/CurrencyDisplay";

type PaymentMethod = "cash" | "check" | "bank_transfer" | "gcash" | "other";

interface PostPaymentFormProps {
  studentId: string;
  assessmentId: string;
  balance: number;
  activeBooklets: {
    id: string;
    series: string;
    prefix: string;
    nextNumber: number;
    endNumber: number;
  }[];
  onCancel?: () => void;
  /** Called after a successful post (e.g. close modal + refresh). */
  onPosted?: () => void;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export default function PostPaymentForm({
  studentId,
  assessmentId,
  balance,
  activeBooklets,
  onCancel,
  onPosted,
}: PostPaymentFormProps) {
  const initialState: PaymentFormState = {};
  const [state, action, pending] = useActionState(postPaymentAction, initialState);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountToPay, setAmountToPay] = useState(String(balance));
  const [amountTendered, setAmountTendered] = useState("");

  useEffect(() => {
    if (state.success && onPosted) {
      const t = window.setTimeout(() => onPosted(), 1600);
      return () => window.clearTimeout(t);
    }
  }, [state.success, onPosted]);

  const payNum = Number.parseFloat(amountToPay) || 0;
  const tenderNum = Number.parseFloat(amountTendered) || 0;
  const change =
    paymentMethod === "cash" && tenderNum >= payNum && payNum > 0
      ? roundMoney(tenderNum - payNum)
      : 0;

  if (state.success) {
    return (
      <div className="cashier-pay-success">
        <p className="cashier-pay-success-title">Payment posted</p>
        <p className="cashier-pay-success-msg">{state.message}</p>
        {onCancel && (
          <Button type="button" variant="secondary" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="cashier-pay-form space-y-4">
      {state.errors?._form && (
        <div className="cashier-pay-alert cashier-pay-alert-error" role="alert">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="cashier-pay-alert cashier-pay-alert-error" role="alert">
          {state.message}
        </div>
      )}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div className="cashier-pay-balance-banner">
        <span className="cashier-pay-balance-label">Amount due (balance)</span>
        <span className="cashier-pay-balance-value">
          <CurrencyDisplay amount={balance} />
        </span>
      </div>

      <FormField label="OR booklet" required error={state.errors?.bookletId}>
        {activeBooklets.length === 0 ? (
          <div className="cashier-pay-alert cashier-pay-alert-error" role="status">
            <p>
              No active receipt booklets. Ask Finance to activate a booklet before accepting
              payment.
            </p>
          </div>
        ) : (
          <select
            id="bookletId"
            name="bookletId"
            className="cashier-pay-select"
            required
            disabled={activeBooklets.length === 0}
          >
            {activeBooklets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.series} — Next OR:{" "}
                {formatStoredOrNumber(b.prefix, b.nextNumber, b.endNumber)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <div className="cashier-pay-grid-2">
        <FormField
          label="Amount to pay"
          required
          error={state.errors?.amount}
          hint={`Maximum ${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(balance)}`}
        >
          <Input
            type="number"
            id="amount"
            name="amount"
            step="0.01"
            min="0.01"
            max={balance}
            value={amountToPay}
            onChange={(e) => setAmountToPay(e.target.value)}
            error={!!state.errors?.amount}
            required
            className="cashier-pay-input-lg font-mono"
          />
        </FormField>

        <FormField label="Payment method" required error={state.errors?.paymentMethod}>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="cashier-pay-select"
            required
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
        </FormField>
      </div>

      {paymentMethod === "cash" && (
        <div className="cashier-pay-cash-panel">
          <div className="cashier-pay-grid-2">
            <FormField
              label="Amount tendered"
              required
              error={state.errors?.amountTendered}
              hint="Cash received · must be at least the amount to pay"
            >
              <Input
                type="number"
                id="amountTendered"
                name="amountTendered"
                step="0.01"
                min="0"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                error={!!state.errors?.amountTendered}
                className="cashier-pay-input-lg font-mono"
                autoComplete="off"
              />
            </FormField>
            <div className="cashier-pay-change-tile">
              <span className="cashier-pay-change-label">Change</span>
              <span className="cashier-pay-change-value font-mono">
                {payNum > 0 && tenderNum >= payNum ? (
                  <CurrencyDisplay amount={change} />
                ) : (
                  <span className="text-[var(--color-text-muted)]">—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      <FormField label="Reference no." hint="Check no., transfer ref, GCash ref, etc.">
        <Input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          placeholder="Optional"
          className="font-mono text-sm"
        />
      </FormField>

      <FormField label="Remarks">
        <Input type="text" id="remarks" name="remarks" placeholder="Optional" />
      </FormField>

      <FormActions
        submitLabel={pending ? "Posting…" : "Post payment & print OR"}
        cancelLabel="Cancel"
        onCancel={onCancel}
        loading={pending}
        submitDisabled={activeBooklets.length === 0}
      />
    </form>
  );
}
