"use client";

import { useActionState, useEffect, useState } from "react";
import { postPaymentAction } from "../payments.actions";
import type { PaymentFormState } from "../payments.schema";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatStoredOrNumber } from "@/lib/utils/or-number";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";

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
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <p className="font-display text-xl font-extrabold text-charcoal">Payment posted</p>
        <p className="mt-1 text-sm text-[var(--color-text-2)]">{state.message}</p>
        {onCancel && (
          <Button type="button" variant="secondary" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.errors?._form && (
        <div
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {state.message}
        </div>
      )}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--color-text-2)]">Amount due (balance)</span>
        <span className="font-display text-lg font-black text-[var(--color-primary)]">
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
            className="form-control"
            required
            disabled={activeBooklets.length === 0}
          >
            {activeBooklets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.series} — Next OR:{" "}
                {formatStoredOrNumber(b.prefix, b.nextNumber)}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            className="font-mono text-base"
          />
        </FormField>

        <FormField label="Payment method" required error={state.errors?.paymentMethod}>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="form-control"
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
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className="font-mono text-base"
                autoComplete="off"
              />
            </FormField>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
              <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Change
              </span>
              <span className="mt-2 block font-mono text-lg font-semibold text-[var(--color-text)]">
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

      <FormField
        label="Reference no."
        required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
        error={state.errors?.referenceNumber}
        hint={
          paymentMethod === "gcash" || paymentMethod === "bank_transfer"
            ? "GCash / bank transfer reference is required and must be unique — not used on any other payment."
            : "Required for GCash and bank transfer. If you enter a reference for other methods, it must still be unique across all payments."
        }
      >
        <Input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          placeholder={
            paymentMethod === "gcash" || paymentMethod === "bank_transfer"
              ? "Transaction reference"
              : "Check no., ref no., etc."
          }
          required={paymentMethod === "gcash" || paymentMethod === "bank_transfer"}
          error={!!state.errors?.referenceNumber}
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
