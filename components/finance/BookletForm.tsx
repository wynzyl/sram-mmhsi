"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBookletAction } from "@/actions/cashier";
import type { BookletFormState } from "@/lib/validators/cashier";

export default function BookletForm() {
  const router = useRouter();
  const initialState: BookletFormState = {};
  const [state, action, pending] = useActionState(createBookletAction, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/admin/finance/booklets");
    }
  }, [state.success, router]);

  return (
    <form action={action} className="form-card">
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

      <div className="form-group">
        <label className="form-label" htmlFor="series">
          Series <span className="required">*</span>
        </label>
        <input
          type="text"
          id="series"
          name="series"
          className={`form-control ${state.errors?.series ? "form-control-error" : ""}`}
          placeholder="Internal booklet label / batch (e.g., AP-2026-001)"
          required
        />
        <p className="form-hint text-muted text-xs mt-1">
          Used for bookkeeping; does not have to match the printed OR prefix.
        </p>
        {state.errors?.series && (
          <p className="form-error">{state.errors.series[0]}</p>
        )}
      </div>

      <div className="form-group mt-4">
        <label className="form-label" htmlFor="prefix">
          OR prefix <span className="required">*</span>
        </label>
        <input
          type="text"
          id="prefix"
          name="prefix"
          className={`form-control ${state.errors?.prefix ? "form-control-error" : ""}`}
          placeholder="e.g., AP"
          maxLength={32}
          required
        />
        <p className="form-hint text-muted text-xs mt-1">
          Printed and saved with each payment:{" "}
          <strong>
            prefix + number
          </strong>{" "}
          (example: AP 00050). Only one active booklet may use the same prefix.
        </p>
        {state.errors?.prefix && (
          <p className="form-error">{state.errors.prefix[0]}</p>
        )}
      </div>

      <div className="form-grid mt-4">
        <div className="form-group">
          <label className="form-label" htmlFor="startNumber">
            Start Number <span className="required">*</span>
          </label>
          <input
            type="number"
            id="startNumber"
            name="startNumber"
            className={`form-control ${state.errors?.startNumber ? "form-control-error" : ""}`}
            min="1"
            required
          />
          {state.errors?.startNumber && (
            <p className="form-error">{state.errors.startNumber[0]}</p>
          )}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="endNumber">
            End Number <span className="required">*</span>
          </label>
          <input
            type="number"
            id="endNumber"
            name="endNumber"
            className={`form-control ${state.errors?.endNumber ? "form-control-error" : ""}`}
            min="1"
            required
          />
          {state.errors?.endNumber && (
            <p className="form-error">{state.errors.endNumber[0]}</p>
          )}
        </div>
      </div>

      <div className="form-actions mt-6" style={{ display: "flex", gap: "1rem" }}>
        <button type="button" className="btn-secondary" onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Registering..." : "Register Booklet"}
        </button>
      </div>
    </form>
  );
}
