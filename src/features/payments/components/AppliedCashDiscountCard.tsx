"use client";

import { useActionState, startTransition, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDateTime, formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import { Button } from "@/components/ui/button";
import { BadgeCheck, Info, ArrowRight, User, Clock, CheckCircle2, AlertTriangle, XCircle, Calendar, RotateCcw, Loader2 } from "lucide-react";
import { reverseExpiredCashDiscountAction } from "../actions/cash-discount.actions";
import type { AppliedCashDiscountDetails, CascadeFixFormState } from "../payments.types";

interface AppliedCashDiscountCardProps {
  /** Applied cash discount details from the query */
  details: NonNullable<AppliedCashDiscountDetails["discountDetails"]>;
  /** Assessment ID for reversal action */
  assessmentId: string;
}

/**
 * Read-only info card displaying an already-applied cash discount.
 *
 * Shown on the payment page when a FULL_PAYMENT_DISCOUNT was applied via
 * the approval workflow (not at payment time). The cashier cannot modify
 * or remove this discount - they just need to collect the reduced balance.
 *
 * If the discount has expired (past cutoff date, no payment made), shows
 * a warning and a button to reverse the expired discount.
 */
export function AppliedCashDiscountCard({ details, assessmentId }: AppliedCashDiscountCardProps) {
  const router = useRouter();

  // Memoized derived values
  const { hasRelatedDiscounts, hasCascadeAdjustments, isExpired } = useMemo(
    () => ({
      hasRelatedDiscounts: details.relatedDiscounts && details.relatedDiscounts.length > 0,
      hasCascadeAdjustments: details.cascadeAdjustments.length > 0,
      isExpired: details.isExpired,
    }),
    [details.relatedDiscounts, details.cascadeAdjustments.length, details.isExpired]
  );

  // Reversal action state
  const initialState: CascadeFixFormState = {};
  const [state, action, isPending] = useActionState(reverseExpiredCashDiscountAction, initialState);

  // Refresh page after successful reversal
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  const handleReverse = useCallback(() => {
    const formData = new FormData();
    formData.set("assessmentId", assessmentId);
    formData.set("studentDiscountId", details.studentDiscountId);
    startTransition(() => {
      action(formData);
    });
  }, [assessmentId, details.studentDiscountId, action]);

  // If discount is expired, show error state
  if (isExpired) {
    return (
      <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 dark:border-red-700 dark:bg-red-950/30">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
            Cash Discount Expired
          </h3>
        </div>

        {/* Expired warning */}
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2 dark:bg-red-900/50">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="text-sm text-red-700 dark:text-red-300">
            <p className="font-medium">
              This cash discount has expired and must be reversed before processing payment.
            </p>
            <p className="mt-1 text-red-600 dark:text-red-400">
              The cutoff date was {details.cutoffDate ? formatDate(details.cutoffDate) : "N/A"}.
              No payment was received by the deadline.
            </p>
          </div>
        </div>

        {/* Discount amount (crossed out) */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between rounded-lg bg-red-100/50 px-3 py-2 dark:bg-red-900/30">
            <span className="font-medium text-red-700 line-through dark:text-red-300">
              Cash discount (expired):
            </span>
            <span className="font-mono font-bold text-red-700 line-through dark:text-red-300">
              -<CurrencyDisplay amount={details.discountAmount} />
            </span>
          </div>
        </div>

        {/* Reversal action */}
        <div className="mt-3 space-y-2">
          <Button
            type="button"
            onClick={handleReverse}
            disabled={isPending}
            className="w-full bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reversing...
              </>
            ) : (
              <>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reverse Expired Discount
              </>
            )}
          </Button>
          <p className="text-xs text-red-600 dark:text-red-400">
            This will add ₱{details.discountAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} back to the balance.
            {hasCascadeAdjustments && " Cascade adjustments will also be reversed."}
          </p>

          {/* Error message */}
          {state.message && !state.success && (
            <p className="text-sm font-medium text-red-700 dark:text-red-300">{state.message}</p>
          )}

          {/* Success message (brief flash before refresh) */}
          {state.success && (
            <p className="text-sm font-medium text-green-600 dark:text-green-400">{state.message}</p>
          )}
        </div>

        {/* Applied by / when info */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-red-600 dark:text-red-400">
          <span className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Applied by {details.appliedByName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(details.appliedAt)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-950/30">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <BadgeCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
          Cash Discount Applied
        </h3>
      </div>

      {/* Applied status badge */}
      <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 dark:bg-blue-900/50">
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          {hasRelatedDiscounts || hasCascadeAdjustments
            ? "Cash discount applied. Other tuition-based discounts are calculated on the discounted tuition."
            : "This discount was applied via the approval workflow. Balance has been adjusted."}
        </span>
      </div>

      {/* Discount amount */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between rounded-lg bg-blue-100 px-3 py-2 dark:bg-blue-900/50">
          <span className="font-medium text-blue-700 dark:text-blue-300">
            Cash discount applied:
          </span>
          <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
            -<CurrencyDisplay amount={details.discountAmount} />
          </span>
        </div>

        {/* Related discounts (correctly applied on discounted base) */}
        {hasRelatedDiscounts && (
          <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
            <div className="mb-2 flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-green-700 dark:text-green-300">
                  Related Discounts (on discounted tuition)
                </h4>
                <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
                  These discounts were correctly applied on the reduced tuition base.
                </p>
              </div>
            </div>

            {/* Individual related discount lines */}
            <div className="space-y-1.5">
              {details.relatedDiscounts.map((rel, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded bg-green-100/50 px-2 py-1.5 text-xs dark:bg-green-900/30"
                >
                  <span className="font-medium text-green-800 dark:text-green-200">
                    {rel.discountTypeName}
                    <span className="ml-1 font-normal text-green-600 dark:text-green-400">
                      (on {formatCurrency(rel.baseAmount)} tuition)
                    </span>
                  </span>
                  <span className="font-mono font-bold text-green-700 dark:text-green-300">
                    -<CurrencyDisplay amount={rel.discountAmount} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cascade adjustments (existing discounts that were recalculated) */}
        {hasCascadeAdjustments && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="mb-2 flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                  Scholarship Recalculations Applied
                </h4>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                  Existing scholarships were recalculated based on the discounted tuition.
                </p>
              </div>
            </div>

            {/* Individual adjustment lines */}
            <div className="space-y-1.5">
              {details.cascadeAdjustments.map((adj, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded bg-amber-100/50 px-2 py-1.5 text-xs dark:bg-amber-900/30"
                >
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    {adj.discountTypeName}:
                  </span>
                  <span className="font-mono text-amber-700 dark:text-amber-300">
                    <CurrencyDisplay amount={adj.originalAmount} />
                  </span>
                  <ArrowRight className="h-3 w-3 text-amber-500" />
                  <span className="font-mono text-amber-700 dark:text-amber-300">
                    <CurrencyDisplay amount={adj.originalAmount - adj.adjustmentAmount} />
                  </span>
                  <span className="ml-auto font-mono text-amber-600 dark:text-amber-400">
                    (+<CurrencyDisplay amount={adj.adjustmentAmount} />)
                  </span>
                </div>
              ))}
            </div>

            {/* Total adjustment */}
            <div className="mt-2 flex items-center justify-between border-t border-amber-200 pt-2 dark:border-amber-800">
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Total adjustment:
              </span>
              <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                +<CurrencyDisplay amount={details.totalCascadeAdjustment} />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Applied by / when info */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="h-3.5 w-3.5" />
          Applied by {details.appliedByName}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatDateTime(details.appliedAt)}
        </span>
        {details.cutoffDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Valid until {formatDate(details.cutoffDate)}
          </span>
        )}
      </div>
    </div>
  );
}
