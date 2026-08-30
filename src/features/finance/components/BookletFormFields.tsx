"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared, variant-aware field components for the booklet registration form.
 *
 * Both {@link BookletForm} layouts ("default" and "dashboard") render the same
 * `usageMode` and `assignedCashierId` selects with identical options, names,
 * defaults, and error wiring — only the surrounding styling differs. These
 * components own that markup once so the two variants cannot drift apart.
 */

export type BookletFieldVariant = "default" | "dashboard";

/** Canonical usage-mode options (must match `usageMode` in the booklet schema). */
const USAGE_MODE_OPTIONS = [
  { value: "auto_only", label: "Auto-assign only (cashier posting)" },
  { value: "manual_only", label: "Manual entry only (offline reconciliation)" },
] as const;

const dashboardInputClasses =
  "block w-full px-3.5 py-2.5 rounded-md border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/25";

const dashboardLabelClasses =
  "block text-[0.8125rem] font-medium text-foreground mb-1.5";

type UsageModeFieldProps = {
  variant: BookletFieldVariant;
  /** Field-level errors keyed off `state.errors?.usageMode`. */
  error?: string[];
  /** Initial selection (uncontrolled). */
  defaultValue?: string;
};

export function UsageModeField({
  variant,
  error,
  defaultValue = "auto_only",
}: UsageModeFieldProps) {
  const options = USAGE_MODE_OPTIONS.map((o) => (
    <option key={o.value} value={o.value}>
      {o.label}
    </option>
  ));

  const errorId = "usageMode-error";

  if (variant === "dashboard") {
    return (
      <div>
        <label className={dashboardLabelClasses} htmlFor="usageMode">
          Usage Mode
        </label>
        <select
          id="usageMode"
          name="usageMode"
          className={cn(dashboardInputClasses, error && "border-destructive")}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        >
          {options}
        </select>
        {error && (
          <p id={errorId} className="mt-1 text-xs text-destructive">
            {error[0]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="form-group mt-4">
      <label className="form-label" htmlFor="usageMode">
        Usage Mode <span className="required">*</span>
      </label>
      <select
        id="usageMode"
        name="usageMode"
        className={`form-control ${error ? "form-control-error" : ""}`}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {options}
      </select>
      <p className="form-hint text-muted mt-1 text-xs">
        <strong>Auto-assign:</strong> Appears in cashier dropdown for system-assigned OR numbers.<br />
        <strong>Manual entry:</strong> Reserved for offline receipts entered retroactively.
      </p>
      {error && (
        <p id={errorId} className="form-error">
          {error[0]}
        </p>
      )}
    </div>
  );
}

type Cashier = { id: string; username: string; email: string };

type AssignedCashierFieldProps = {
  variant: BookletFieldVariant;
  /** Cashiers available for booklet assignment. */
  cashiers: Cashier[];
  /** Field-level errors keyed off `state.errors?.assignedCashierId`. */
  error?: string[];
  /** Initial selection (uncontrolled). */
  defaultValue?: string;
};

export function AssignedCashierField({
  variant,
  cashiers,
  error,
  defaultValue = "",
}: AssignedCashierFieldProps) {
  const options = (
    <>
      <option value="">— No assignment —</option>
      {cashiers.map((c) => (
        <option key={c.id} value={c.id}>
          {c.username} ({c.email})
        </option>
      ))}
    </>
  );

  const errorId = "assignedCashierId-error";

  if (variant === "dashboard") {
    return (
      <div>
        <label className={dashboardLabelClasses} htmlFor="assignedCashierId">
          Assign to Cashier (Optional)
        </label>
        <div className="relative">
          <select
            id="assignedCashierId"
            name="assignedCashierId"
            className={cn(dashboardInputClasses, "pr-10", error && "border-destructive")}
            defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          >
            {options}
          </select>
          <UserRound className="pointer-events-none absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
        </div>
        {error && (
          <p id={errorId} className="mt-1 text-xs text-destructive">
            {error[0]}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="form-group mt-4">
      <label className="form-label" htmlFor="assignedCashierId">
        Assign to Cashier (Optional)
      </label>
      <select
        id="assignedCashierId"
        name="assignedCashierId"
        className={`form-control ${error ? "form-control-error" : ""}`}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {options}
      </select>
      <p className="form-hint text-muted mt-1 text-xs">
        Sets this booklet as the cashier&apos;s default for payment posting.
      </p>
      {error && (
        <p id={errorId} className="form-error">
          {error[0]}
        </p>
      )}
    </div>
  );
}
