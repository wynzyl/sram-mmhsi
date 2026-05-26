"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ClipboardPlus, Info, UserRound } from "lucide-react";
import { createBookletAction } from "@/features/payments/payments.actions";
import type { BookletFormState } from "@/lib/validators/cashier";
import { cn } from "@/lib/utils/cn";

interface BookletFormProps {
  variant?: "default" | "dashboard";
  /** Optional redirect path after successful submit; falls back to staff listing. */
  redirectTo?: string;
  /** Optional callback invoked on successful submit (takes the latest form state). */
  onSuccess?: (state: BookletFormState) => void;
}

const inputBaseClasses = "block w-full px-3.5 py-2.5 rounded-md border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

function deriveBookletFields(series: string): {
  prefix: string;
  startNumber: string;
  endNumber: string;
} | null {
  const match = series.trim().toUpperCase().match(/^([A-Z]{2})-(\d{5})-(\d{5})$/);
  if (!match) return null;
  return {
    prefix: match[1],
    startNumber: String(Number(match[2])),
    endNumber: String(Number(match[3])),
  };
}

export default function BookletForm({
  variant = "default",
  redirectTo = "/staff/finance/booklets",
  onSuccess,
}: BookletFormProps) {
  const router = useRouter();
  const initialState: BookletFormState = {};
  const [state, action, pending] = useActionState(createBookletAction, initialState);
  const [seriesInput, setSeriesInput] = useState("");
  const isDashboard = variant === "dashboard";
  const derivedFields = deriveBookletFields(seriesInput);

  useEffect(() => {
    if (state.success) {
      if (onSuccess) {
        onSuccess(state);
      } else if (redirectTo) {
        router.push(redirectTo);
      }
    }
  }, [state, redirectTo, onSuccess, router]);

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
            placeholder="e.g., AK-00051-00100"
            value={seriesInput}
            onChange={(event) => setSeriesInput(event.target.value.toUpperCase())}
            required
          />
          <p className="form-hint text-muted mt-1 text-xs">
            Standard format: <strong>AK-00051-00100</strong>.
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
            placeholder="Auto-derived from booklet"
            maxLength={2}
            pattern="[A-Za-z]{2}"
            title="Two letters only"
            value={derivedFields?.prefix ?? ""}
            readOnly
          />
          <p className="form-hint text-muted mt-1 text-xs">
            Auto-derived from booklet format.
          </p>
          {state.errors?.prefix && <p className="form-error">{state.errors.prefix[0]}</p>}
        </div>

        <div className="form-grid mt-4">
          <div className="form-group">
            <label className="form-label" htmlFor="startNumber">
              Start Number <span className="required">*</span>
            </label>
            <input
              type="text"
              id="startNumber"
              name="startNumber"
              className={`form-control ${state.errors?.startNumber ? "form-control-error" : ""}`}
              placeholder="Auto-derived from booklet"
              value={derivedFields?.startNumber ?? ""}
              readOnly
            />
            {state.errors?.startNumber && <p className="form-error">{state.errors.startNumber[0]}</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="endNumber">
              End Number <span className="required">*</span>
            </label>
            <input
              type="text"
              id="endNumber"
              name="endNumber"
              className={`form-control ${state.errors?.endNumber ? "form-control-error" : ""}`}
              placeholder="Auto-derived from booklet"
              value={derivedFields?.endNumber ?? ""}
              readOnly
            />
            {state.errors?.endNumber && <p className="form-error">{state.errors.endNumber[0]}</p>}
          </div>
        </div>

        <p className="form-hint text-muted mt-2 text-xs">
          Exactly <strong>50</strong> official receipts per booklet (inclusive range). Example: series{" "}
          <strong className="font-mono">AK-00051-00100</strong> with start <strong>51</strong>, end <strong>100</strong>.
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
    <form action={action} className="bg-card border border-border rounded-md p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-primary/15 p-2 text-primary">
          <ClipboardPlus className="h-4 w-4" />
        </div>
        <h2 className="font-display text-3xl leading-none text-foreground">Add New Booklet</h2>
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
          <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="series">
            Booklet Name/ID
          </label>
          <input
            type="text"
            id="series"
            name="series"
            className={cn(inputBaseClasses, state.errors?.series && "border-destructive")}
            placeholder="e.g., AK-00051-00100"
            value={seriesInput}
            onChange={(event) => setSeriesInput(event.target.value.toUpperCase())}
            required
          />
          {state.errors?.series && <p className="mt-1 text-xs text-rose-300">{state.errors.series[0]}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="prefix">
              Prefix
            </label>
            <input
              type="text"
              id="prefix"
              name="prefix"
              className={cn(inputBaseClasses, state.errors?.prefix && "border-destructive")}
              placeholder="Auto-derived"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              title="Two letters only"
              value={derivedFields?.prefix ?? ""}
              readOnly
            />
            {state.errors?.prefix && <p className="mt-1 text-xs text-rose-300">{state.errors.prefix[0]}</p>}
          </div>

          <div>
            <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="dateIssued">
              Date Issued
            </label>
            <div className="relative">
              <input id="dateIssued" type="date" className={cn(inputBaseClasses, "pr-10")} />
              <CalendarDays className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="startNumber">
              Start Number
            </label>
            <input
              type="text"
              id="startNumber"
              name="startNumber"
              className={cn(inputBaseClasses, state.errors?.startNumber && "border-destructive")}
              placeholder="Auto-derived"
              value={derivedFields?.startNumber ?? ""}
              readOnly
            />
            {state.errors?.startNumber && <p className="mt-1 text-xs text-rose-300">{state.errors.startNumber[0]}</p>}
          </div>

          <div>
            <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="endNumber">
              End Number
            </label>
            <input
              type="text"
              id="endNumber"
              name="endNumber"
              className={cn(inputBaseClasses, state.errors?.endNumber && "border-destructive")}
              placeholder="Auto-derived"
              value={derivedFields?.endNumber ?? ""}
              readOnly
            />
            {state.errors?.endNumber && <p className="mt-1 text-xs text-rose-300">{state.errors.endNumber[0]}</p>}
          </div>
        </div>

        <div>
          <label className="block text-[0.8125rem] font-medium text-foreground mb-1.5" htmlFor="assignedTo">
            Assigned To (Staff/Cashier)
          </label>
          <div className="relative">
            <select id="assignedTo" className={cn(inputBaseClasses, "pr-10 opacity-60 cursor-not-allowed bg-muted")} disabled defaultValue="">
              <option value="">Select Cashier (assignment soon)</option>
            </select>
            <UserRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>
        </div>

        <button type="submit" className="btn-primary mt-2 flex h-14 w-full items-center justify-center gap-2" disabled={pending}>
          <ClipboardPlus className="h-4 w-4" />
          {pending ? "Registering..." : "Register Booklet"}
        </button>
      </div>

      <div className="bg-muted border border-border rounded-md mt-5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <Info className="h-4 w-4 text-primary" />
          Administrative Protocol
        </div>
        <p className="text-[0.8125rem] text-muted-foreground leading-relaxed mt-2">
          Physical booklets must be verified by the Bursar before assignment. Booklet range rules and overlap
          validation are enforced before registration.
        </p>
      </div>
    </form>
  );
}
