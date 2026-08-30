"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { updateEnrollmentStatusAction } from "../enrollments.actions";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { useFormToast } from "@/hooks/useFormToast";
import { TextAreaField } from "@/components/forms/TextInputField";
import { cn } from "@/lib/utils/cn";

import { buttonVariants } from "@/components/ui/button";
import { OUTSTANDING_PAYMENT_EPSILON } from "@/lib/constants/payments";

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
  const [cancelRemarks, setCancelRemarks] = useState("");

  useFormToast(state, {
    successMessage: "Enrollment cancelled successfully",
    onSuccess: () => setShow(false),
  });

  const paid = assessmentTotalPaid ?? 0;
  const financeStatuses = status === "assessed" || status === "enrolled";
  const hasCollected = financeStatuses && paid > OUTSTANDING_PAYMENT_EPSILON;
  const cancelBlockedByPayments = hasCollected && !canCancelWithBalance;

  // Success state - hide the form
  if (state.success) {
    return null;
  }

  // Table variant (compact)
  if (variant === "table") {
    return (
      <div className="mt-0.5 max-w-88">
        {!show ? (
          <button
            type="button"
            className="btn-ghost btn-sm text-destructive"
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
                    ? "text-destructive"
                    : "text-warning"
                )}
              >
                {cancelBlockedByPayments ? (
                  <>
                    Ledger shows <CurrencyDisplay amount={paid} /> collected. Void posted payments (Cashier) first,
                    then cancel. Ask an admin only if policy requires cancelling without voiding in the
                    system.
                  </>
                ) : (
                  <>
                    Ledger shows <CurrencyDisplay amount={paid} /> collected. Prefer voiding payments before cancel.
                    As admin you may proceed with a detailed audit reason (&ge;15 characters); this does
                    not replace proper voiding for accounting.
                  </>
                )}
              </p>
            )}

            <TextAreaField
              label="Cancellation reason"
              name="cancelRemarks"
              required={hasCollected && canCancelWithBalance}
              value={cancelRemarks}
              onChange={setCancelRemarks}
              error={state.errors?.cancelRemarks}
              rows={hasCollected && canCancelWithBalance ? 4 : 2}
              placeholder={
                hasCollected && canCancelWithBalance
                  ? "Detailed audit reason (required, \u226515 characters)..."
                  : "Reason for cancellation..."
              }
              className="w-full px-2 py-1 text-xs"
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
      </div>
    );
  }

  // Card variant (editorial design)
  return (
    <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-3">
      <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
        Cancel enrollment
      </p>
      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "border-destructive/25 bg-white text-destructive hover:bg-destructive-tint",
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
              className="inline-flex items-center gap-1 text-[11px] text-primary underline"
            >
              Open assessment ledger first
            </Link>
          )}

          {hasCollected && (
            <p
              className={cn(
                "rounded-md p-2 text-[11px] leading-relaxed",
                cancelBlockedByPayments
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning-tint text-warning"
              )}
            >
              {cancelBlockedByPayments ? (
                <>
                  Ledger shows <strong><CurrencyDisplay amount={paid} /></strong> collected. Void posted payments via
                  the cashier first, then cancel.
                </>
              ) : (
                <>
                  Ledger shows <strong><CurrencyDisplay amount={paid} /></strong> collected. Prefer voiding payments
                  before cancel; admin reason &ge;15 chars required.
                </>
              )}
            </p>
          )}

          <TextAreaField
            label="Cancellation reason"
            name="cancelRemarks"
            required={hasCollected && canCancelWithBalance}
            value={cancelRemarks}
            onChange={setCancelRemarks}
            error={state.errors?.cancelRemarks}
            rows={hasCollected && canCancelWithBalance ? 4 : 2}
            placeholder={
              hasCollected && canCancelWithBalance
                ? "Detailed audit reason (\u226515 characters)..."
                : "Reason for cancellation..."
            }
            className="w-full rounded-md border border-border bg-white px-2.5 py-1.5 text-xs text-foreground outline-none transition focus:border-border focus:ring-2 focus:ring-destructive/15"
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || cancelBlockedByPayments}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all",
                "hover:bg-destructive disabled:cursor-not-allowed disabled:opacity-50"
              )}
            >
              {pending ? "Cancelling..." : "Confirm cancellation"}
            </button>
            <button
              type="button"
              onClick={() => setShow(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
