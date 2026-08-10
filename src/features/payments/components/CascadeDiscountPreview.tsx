"use client";

import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { AlertTriangle, ArrowRight, Info } from "lucide-react";
import type { CascadeAdjustmentPreview } from "../payments.types";

interface CascadeDiscountPreviewProps {
  /** Cascade adjustment preview data from eligibility check */
  preview: CascadeAdjustmentPreview;
}

/**
 * Displays cascade discount adjustment preview within payment form.
 *
 * When cash discount is applied, existing scholarship discounts (tuition_only)
 * are recalculated based on the discounted tuition. This component shows
 * the impact of that recalculation before the user confirms payment.
 */
export function CascadeDiscountPreview({
  preview,
}: CascadeDiscountPreviewProps) {
  if (!preview.hasCascadeAdjustments || preview.lines.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
      {/* Header with info icon */}
      <div className="mb-2 flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Cascading Discount Recalculation
          </h4>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
            {preview.explanation}
          </p>
        </div>
      </div>

      {/* Individual adjustment lines */}
      <div className="space-y-1.5">
        {preview.lines.map((line, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded bg-amber-100/50 px-2 py-1.5 text-xs dark:bg-amber-900/30"
          >
            <span className="font-medium text-amber-800 dark:text-amber-200">
              {line.discountTypeName}:
            </span>
            <span className="font-mono text-amber-700 dark:text-amber-300">
              <CurrencyDisplay amount={line.originalAmount} />
            </span>
            <ArrowRight className="h-3 w-3 text-amber-500 dark:text-amber-500" />
            <span className="font-mono text-amber-700 dark:text-amber-300">
              <CurrencyDisplay amount={line.recalculatedAmount} />
            </span>
            <span className="ml-auto font-mono text-amber-600 dark:text-amber-400">
              (+<CurrencyDisplay amount={line.adjustmentAmount} />)
            </span>
          </div>
        ))}
      </div>

      {/* Total adjustment */}
      <div className="mt-2 flex items-center justify-between border-t border-amber-200 pt-2 dark:border-amber-800">
        <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          Total adjustment:
        </span>
        <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
          +<CurrencyDisplay amount={preview.totalAdjustment} />
        </span>
      </div>

      {/* Explanation note */}
      <p className="mt-2 text-[10px] leading-snug text-amber-600/80 dark:text-amber-400/80">
        * Scholarship discounts are recalculated on the discounted tuition
        amount. The adjustment increases the payable balance accordingly.
      </p>
    </div>
  );
}
