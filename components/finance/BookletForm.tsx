"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardPlus, Info, UserRound } from "lucide-react";
import { createBookletAction } from "@/actions/cashier";
import type { BookletFormState } from "@/lib/validators/cashier";

interface BookletFormProps {
  variant?: "default" | "dashboard";
}

function inputStateClass(hasError: boolean): string {
  return hasError ? "ops-input ops-input-error" : "ops-input";
}

export default function BookletForm({ variant = "default" }: BookletFormProps) {
  const router = useRouter();
  const initialState: BookletFormState = {};
  const [state, action, pending] = useActionState(createBookletAction, initialState);
  const isDashboard = variant === "dashboard";

  useEffect(() => {
    if (state.success) {
      router.push("/staff/finance/booklets");
    }
  }, [state.success, router]);

  if (!isDashboard) {
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
            placeholder="e.g., AK 00051-00100"
            required
          />
          <p className="form-hint text-muted mt-1 text-xs">
            Must match OR prefix and padded range exactly (same as printed booklet face):{" "}
            <strong>PREFIX 00051-00100</strong>. Spaces around the hyphen are OK.
          </p>
          {state.errors?.series && <p className="form-error">{state.errors.series[0]}</p>}
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
            placeholder="e.g., AK"
            maxLength={2}
            pattern="[A-Za-z]{2}"
            title="Two letters only"
            required
          />
          <p className="form-hint text-muted mt-1 text-xs">
            Exactly two letters (e.g. AK). Stored OR format: <strong>PREFIX 00001</strong> (sequence is always 5
            digits). You may reuse a prefix on another booklet if its start-end range does not overlap any existing
            booklet with that prefix.
          </p>
          {state.errors?.prefix && <p className="form-error">{state.errors.prefix[0]}</p>}
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
              max="99999"
              required
            />
            {state.errors?.startNumber && <p className="form-error">{state.errors.startNumber[0]}</p>}
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
              max="99999"
              required
            />
            {state.errors?.endNumber && <p className="form-error">{state.errors.endNumber[0]}</p>}
          </div>
        </div>

        <p className="form-hint text-muted mt-2 text-xs">
          Exactly <strong>50</strong> official receipts per booklet (inclusive range). Example: series{" "}
          <strong className="font-mono">AK 00051-00100</strong> with start <strong>51</strong>, end <strong>100</strong>.
        </p>

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

  return (
    <form action={action} className="ops-panel p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-(--color-ops-panel-muted) p-2 text-(--color-primary-300)">
          <ClipboardPlus className="h-4 w-4" />
        </div>
        <h2 className="font-display text-3xl leading-none text-(--color-ops-ink)">Add New Booklet</h2>
      </div>

      {state.errors?._form && (
        <div className="mb-4 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {state.errors._form.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}
      {state.message && !state.success && (
        <div className="mb-4 rounded-lg border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
          {state.message}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="ops-label" htmlFor="series">
            Booklet Name/ID
          </label>
          <input
            type="text"
            id="series"
            name="series"
            className={inputStateClass(Boolean(state.errors?.series))}
            placeholder="e.g., AK 00051-00100"
            required
          />
          {state.errors?.series && <p className="mt-1 text-xs text-rose-300">{state.errors.series[0]}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ops-label" htmlFor="prefix">
              Prefix
            </label>
            <input
              type="text"
              id="prefix"
              name="prefix"
              className={inputStateClass(Boolean(state.errors?.prefix))}
              placeholder="e.g., AK"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              title="Two letters only"
              required
            />
            {state.errors?.prefix && <p className="mt-1 text-xs text-rose-300">{state.errors.prefix[0]}</p>}
          </div>

          <div>
            <label className="ops-label" htmlFor="dateIssued">
              Date Issued
            </label>
            <div className="relative">
              <input id="dateIssued" type="date" className="ops-input pr-10" />
              <CalendarDays className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-(--color-ops-muted)" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="ops-label" htmlFor="startNumber">
              Start Number
            </label>
            <input
              type="number"
              id="startNumber"
              name="startNumber"
              className={inputStateClass(Boolean(state.errors?.startNumber))}
              min="1"
              max="99999"
              required
            />
            {state.errors?.startNumber && <p className="mt-1 text-xs text-rose-300">{state.errors.startNumber[0]}</p>}
          </div>

          <div>
            <label className="ops-label" htmlFor="endNumber">
              End Number
            </label>
            <input
              type="number"
              id="endNumber"
              name="endNumber"
              className={inputStateClass(Boolean(state.errors?.endNumber))}
              min="1"
              max="99999"
              required
            />
            {state.errors?.endNumber && <p className="mt-1 text-xs text-rose-300">{state.errors.endNumber[0]}</p>}
          </div>
        </div>

        <div>
          <label className="ops-label" htmlFor="assignedTo">
            Assigned To (Staff/Cashier)
          </label>
          <div className="relative">
            <select id="assignedTo" className="ops-input ops-input-disabled pr-10" disabled defaultValue="">
              <option value="">Select Cashier (assignment soon)</option>
            </select>
            <UserRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-(--color-ops-muted)" />
          </div>
        </div>

        <button type="submit" className="btn-primary mt-2 flex h-14 w-full items-center justify-center gap-2" disabled={pending}>
          <ClipboardPlus className="h-4 w-4" />
          {pending ? "Registering..." : "Register Booklet"}
        </button>
      </div>

      <div className="ops-panel ops-panel-muted mt-5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-(--color-ops-ink)">
          <Info className="h-4 w-4 text-(--color-primary-300)" />
          Administrative Protocol
        </div>
        <p className="ops-note mt-2 leading-relaxed">
          Physical booklets must be verified by the Bursar before assignment. Booklet range rules and overlap
          validation are enforced before registration.
        </p>
      </div>
    </form>
  );
}
