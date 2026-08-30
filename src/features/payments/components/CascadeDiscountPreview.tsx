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
    <div className="mt-3 rounded-lg border border-warning/25 bg-warning-tint p-3">
      {/* Header with info icon */}
      <div className="mb-2 flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warning">
            Cascading Discount Recalculation
          </h4>
          <p className="mt-0.5 text-xs text-warning">
            {preview.explanation}
          </p>
        </div>
      </div>

      {/* Individual adjustment lines */}
      <div className="space-y-1.5">
        {preview.lines.map((line, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded bg-warning/10 px-2 py-1.5 text-xs"
          >
            <span className="font-medium text-warning">
              {line.discountTypeName}:
            </span>
            <span className="font-mono text-warning">
              <CurrencyDisplay amount={line.originalAmount} />
            </span>
            <ArrowRight className="h-3 w-3 text-warning" />
            <span className="font-mono text-warning">
              <CurrencyDisplay amount={line.recalculatedAmount} />
            </span>
            <span className="ml-auto font-mono text-warning">
              (+<CurrencyDisplay amount={line.adjustmentAmount} />)
            </span>
          </div>
        ))}
      </div>

      {/* Total adjustment */}
      <div className="mt-2 flex items-center justify-between border-t border-warning/25 pt-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          Total adjustment:
        </span>
        <span className="font-mono text-xs font-bold text-warning">
          +<CurrencyDisplay amount={preview.totalAdjustment} />
        </span>
      </div>

      {/* Explanation note */}
      <p className="mt-2 text-[10px] leading-snug text-warning/80">
        * Scholarship discounts are recalculated on the discounted tuition
        amount. The adjustment increases the payable balance accordingly.
      </p>
    </div>
  );
}
