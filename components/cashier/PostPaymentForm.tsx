"use client";

import { useActionState } from "react";
import { postPaymentAction } from "@/actions/cashier";
import type { PaymentFormState } from "@/lib/validators/cashier";
import { FormField } from "@/components/forms/FormField";
import { FormActions } from "@/components/forms/FormActions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatStoredOrNumber } from "@/lib/utils/or-number";

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
}

export default function PostPaymentForm({
  studentId,
  assessmentId,
  balance,
  activeBooklets,
  onCancel,
}: PostPaymentFormProps) {
  const initialState: PaymentFormState = {};
  const [state, action, pending] = useActionState(
    postPaymentAction,
    initialState
  );

  if (state.success) {
    return (
      <div className="bg-green-100 text-green-700 border border-green-200 rounded-md p-4 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <p>{state.message}</p>
        {onCancel && (
          <Button variant="secondary" className="mt-4" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      {state.errors?._form && (
        <div className="bg-red-100 text-red-700 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="bg-red-100 text-red-700 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
          {state.message}
        </div>
      )}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <FormField
        label="OR Booklet to Use"
        required
        error={state.errors?.bookletId}
      >
        {activeBooklets.length === 0 ? (
          <div className="bg-red-100 text-red-700 border border-red-200 rounded-md p-4 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
            <p>
              No active receipt booklets available. Please contact Finance to
              register a new booklet before posting payments.
            </p>
          </div>
        ) : (
          <select
            id="bookletId"
            name="bookletId"
            className="w-full px-3 py-2 border rounded-md text-sm transition-colors duration-150 bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-2)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
            required
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

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          label="Amount to Pay"
          required
          error={state.errors?.amount}
          hint={`Max: ₱${balance.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        >
          <Input
            type="number"
            id="amount"
            name="amount"
            step="0.01"
            min="0.01"
            max={balance}
            defaultValue={balance}
            error={!!state.errors?.amount}
            required
          />
        </FormField>

        <FormField
          label="Payment Method"
          required
          error={state.errors?.paymentMethod}
        >
          <select
            id="paymentMethod"
            name="paymentMethod"
            className="w-full px-3 py-2 border rounded-md text-sm transition-colors duration-150 bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-2)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
            required
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
        </FormField>
      </div>

      <FormField label="Reference Number" hint="e.g. Check No., GCash Ref No.">
        <Input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          placeholder="e.g. Check No., GCash Ref No."
        />
      </FormField>

      <FormField label="Remarks">
        <Input type="text" id="remarks" name="remarks" />
      </FormField>

      <FormActions
        submitLabel={pending ? "Posting..." : "Post Payment"}
        cancelLabel="Cancel"
        onCancel={onCancel}
        loading={pending}
      />
    </form>
  );
}
