"use client";

import { useActionState } from "react";
import { postPaymentAction } from "@/actions/cashier";
import type { PaymentFormState } from "@/lib/validators/cashier";

interface PostPaymentFormProps {
  studentId: string;
  assessmentId: string;
  balance: number;
  activeBooklets: { id: string; series: string; nextNumber: number }[];
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
  const [state, action, pending] = useActionState(postPaymentAction, initialState);

  // Normally we would close modal on success, or show a success message
  // and hide the form. We'll render a simple state.

  if (state.success) {
    return (
      <div className="alert alert-success">
        <p>{state.message}</p>
        {onCancel && (
          <button className="btn-secondary mt-4" onClick={onCancel}>
            Close
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="form-card" style={{ padding: "1.5rem" }}>
      {state.errors?._form && (
        <div className="alert alert-error mb-4">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="alert alert-error mb-4">{state.message}</div>
      )}

      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div className="form-group mb-4">
        <label className="form-label" htmlFor="bookletId">
          OR Booklet to Use <span className="required">*</span>
        </label>
        {activeBooklets.length === 0 ? (
          <div className="alert alert-error">
            <p>No active receipt booklets available. Please contact Finance to register a new booklet before posting payments.</p>
          </div>
        ) : (
          <select
            id="bookletId"
            name="bookletId"
            className={`form-control ${state.errors?.bookletId ? "form-control-error" : ""}`}
            required
          >
            {activeBooklets.map((b) => (
              <option key={b.id} value={b.id}>
                Series {b.series} (Next OR: {b.series}-{String(b.nextNumber).padStart(6, "0")})
              </option>
            ))}
          </select>
        )}
        {state.errors?.bookletId && (
          <p className="form-error">{state.errors.bookletId[0]}</p>
        )}
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="amount">
            Amount to Pay (₱) <span className="required">*</span>
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            step="0.01"
            min="0.01"
            max={balance}
            defaultValue={balance}
            className={`form-control ${state.errors?.amount ? "form-control-error" : ""}`}
            required
          />
          <small className="text-muted">Max: ₱{balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</small>
          {state.errors?.amount && (
            <p className="form-error">{state.errors.amount[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="paymentMethod">
            Payment Method <span className="required">*</span>
          </label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            className={`form-control ${state.errors?.paymentMethod ? "form-control-error" : ""}`}
            required
          >
            <option value="cash">Cash</option>
            <option value="check">Check</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="gcash">GCash</option>
            <option value="other">Other</option>
          </select>
          {state.errors?.paymentMethod && (
            <p className="form-error">{state.errors.paymentMethod[0]}</p>
          )}
        </div>
      </div>

      <div className="form-group mt-4">
        <label className="form-label" htmlFor="referenceNumber">
          Reference Number (Optional)
        </label>
        <input
          type="text"
          id="referenceNumber"
          name="referenceNumber"
          className="form-control"
          placeholder="e.g. Check No., GCash Ref No."
        />
      </div>

      <div className="form-group mt-4">
        <label className="form-label" htmlFor="remarks">
          Remarks (Optional)
        </label>
        <input
          type="text"
          id="remarks"
          name="remarks"
          className="form-control"
        />
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={pending || balance <= 0 || activeBooklets.length === 0}>
          {pending ? "Posting..." : "Post Payment"}
        </button>
      </div>
    </form>
  );
}
