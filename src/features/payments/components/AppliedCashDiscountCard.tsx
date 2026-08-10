"use client";

import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDateTime } from "@/lib/utils/date";
import { BadgeCheck, Info, ArrowRight, User, Clock } from "lucide-react";
import type { AppliedCashDiscountDetails } from "../payments.types";

interface AppliedCashDiscountCardProps {
  /** Applied cash discount details from the query */
  details: NonNullable<AppliedCashDiscountDetails["discountDetails"]>;
}

/**
 * Read-only info card displaying an already-applied cash discount.
 *
 * Shown on the payment page when a FULL_PAYMENT_DISCOUNT was applied via
 * the approval workflow (not at payment time). The cashier cannot modify
 * or remove this discount - they just need to collect the reduced balance.
 */
export function AppliedCashDiscountCard({ details }: AppliedCashDiscountCardProps) {
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
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          This discount was applied via the approval workflow. Balance has been adjusted.
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

        {/* Cascade adjustments (if any) */}
        {details.cascadeAdjustments.length > 0 && (
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
      </div>
    </div>
  );
}
