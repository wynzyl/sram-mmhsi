"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { updateEnrollmentStatusAction } from "../enrollments.actions";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "@/components/ui/button";

export type EnrollmentStatus = "pending" | "assessed" | "enrolled" | "cancelled";

export interface CancelEnrollmentFormProps {
  enrollmentId: string;
  status: EnrollmentStatus;
  assessmentId: string | null;
  assessmentTotalPaid: number | null;
  canCancelWithBalance: boolean;
  /**
   * Visual variant:
   * - "card": Used in EnrollmentCard with editorial design (default)
   * - "table": Used in EnrollmentsTable with compact inline styles
   */
  variant?: "card" | "table";
}

const OUTSTANDING_PAYMENT_EPSILON = 0.009;

/**
 * Shared cancel enrollment form component.
 * Extracts duplicate CancelInline logic from EnrollmentCard and EnrollmentsTable.
 *
 * Handles:
 * - Payment balance warnings
 * - Cancel remarks validation (min 15 chars when balance exists and admin)
 * - Form submission via updateEnrollmentStatusAction
 */
export default function CancelEnrollmentForm({
  enrollmentId,
  status,
  assessmentId,
  assessmentTotalPaid,
  canCancelWithBalance,
  variant = "card",
}: CancelEnrollmentFormProps) {
  const [state, action, pending] = useActionState(updateEnrollmentStatusAction, {});
  const [show, setShow] = useState(false);

  const paid = assessmentTotalPaid ?? 0;
  const financeStatuses = status === "assessed" || status === "enrolled";
  const hasCollected = financeStatuses && paid > OUTSTANDING_PAYMENT_EPSILON;
  const cancelBlockedByPayments = hasCollected && !canCancelWithBalance;
  const remarksError = state.errors?.cancelRemarks?.[0];

  // Success state
  if (state.success) {
    if (variant === "table") {
      return (
        <span className="text-xs text-gray-500">
          {state.message}
        </span>
      );
    }
    return (
      <p className="rounded-md border border-[var(--color-accent-emerald)]/30 bg-[var(--color-accent-emerald)]/5 px-3 py-2 text-xs text-[var(--color-accent-emerald)]">
        {state.message}
      </p>
    );
  }

  // Table variant (compact)
  if (variant === "table") {
    return (
      <div className="mt-0.5 max-w-[22rem]">
        {!show ? (
          <button
            type="button"
            className="btn-ghost btn-sm text-[var(--color-error)]"
            onClick={() => setShow(true)}
          >
            Cancel enrollment
          </button>
        ) : (
          <form action={action} className="flex flex-col gap-1.5">
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
            <input type="hidden" name="action" value="cancel" />

            {financeStatuses && assessmentId && (
              <Link
                href={`/staff/assessments/${assessmentId}`}
                className="btn-ghost btn-sm self-start text-[11px]"
              >
                Open assessment ledger
              </Link>
            )}

            {hasCollected && (
              <p
                className={cn(
                  "m-0 text-[11px]",
                  cancelBlockedByPayments
                    ? "text-[var(--color-error)]"
                    : "text-[var(--color-warning,#b45309)]"
                )}
              >
                {cancelBlockedByPayments ? (
                  <>
                    Ledger shows {formatCurrency(paid)} collected. Void posted payments (Cashier) first,
                    then cancel. Ask an admin only if policy requires cancelling without voiding in the
                    system.
                  </>
                ) : (
                  <>
                    Ledger shows {formatCurrency(paid)} collected. Prefer voiding payments before cancel.
                    As admin you may proceed with a detailed audit reason (&ge;15 characters); this does
                    not replace proper voiding for accounting.
                  </>
                )}
              </p>
            )}

            <textarea
              name="cancelRemarks"
              className="form-control w-full px-2 py-1 text-xs"
              rows={hasCollected && canCancelWithBalance ? 4 : 2}
              placeholder={
                hasCollected && canCancelWithBalance
                  ? "Detailed audit reason (required, \u226515 characters)..."
                  : "Reason for cancellation..."
              }
            />

            <div className="flex flex-wrap items-center gap-1">
              <button
                type="submit"
                className="btn-danger btn-sm"
                disabled={pending || cancelBlockedByPayments}
              >
                {pending ? "..." : "Confirm"}
              </button>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setShow(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {remarksError && (
          <p className="mt-1 text-[11px] text-[var(--color-error)]">{remarksError}</p>
        )}
        {state.message && !state.success && (
          <p className="mt-1 text-[11px] text-[var(--color-error)]">{state.message}</p>
        )}
      </div>
    );
  }

  // Card variant (editorial design)
  return (
    <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-red-700">
        Cancel enrollment
      </p>
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "border-red-200 bg-white text-red-700 hover:bg-red-50",
          })}
        >
          <X className="h-3.5 w-3.5" />
          Begin cancellation
        </button>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="action" value="cancel" />

          {financeStatuses && assessmentId && (
            <Link
              href={`/staff/assessments/${assessmentId}`}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] underline"
            >
              Open assessment ledger first
            </Link>
          )}

          {hasCollected && (
            <p
              className={cn(
                "rounded-md p-2 text-[11px] leading-relaxed",
                cancelBlockedByPayments
                  ? "bg-red-100/60 text-red-800"
                  : "bg-[var(--color-accent-amber)]/15 text-[var(--color-accent-amber)]"
              )}
            >
              {cancelBlockedByPayments ? (
                <>
                  Ledger shows <strong>{formatCurrency(paid)}</strong> collected. Void posted payments via
                  the cashier first, then cancel.
                </>
              ) : (
                <>
                  Ledger shows <strong>{formatCurrency(paid)}</strong> collected. Prefer voiding payments
                  before cancel; admin reason &ge;15 chars required.
                </>
              )}
            </p>
          )}

          <textarea
            name="cancelRemarks"
            rows={hasCollected && canCancelWithBalance ? 4 : 2}
            placeholder={
              hasCollected && canCancelWithBalance
                ? "Detailed audit reason (\u226515 characters)..."
                : "Reason for cancellation..."
            }
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-ops-ink outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-red-500/15"
          />

          {remarksError && (
            <p className="text-[11px] text-red-700">{remarksError}</p>
          )}
          {state.message && !state.success && (
            <p className="text-[11px] text-red-700">{state.message}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || cancelBlockedByPayments}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all",
                "hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {pending ? "Cancelling..." : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="rounded-md px-2 py-1.5 text-xs text-ops-muted hover:text-ops-ink"
            >
              Dismiss
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
