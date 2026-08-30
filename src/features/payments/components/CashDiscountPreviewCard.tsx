"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { BadgePercent, CalendarClock, CircleCheck, X } from "lucide-react";
import { CascadeDiscountPreview } from "./CascadeDiscountPreview";
import type { CascadeAdjustmentPreview } from "../payments.types";

interface CashDiscountPreviewCardProps {
  /** Tuition or full assessment total (base for percentage calculation) */
  baseAmount: number;
  /** Discount percentage or fixed amount value */
  discountValue: number;
  /** Calculation type */
  calculationType: "fixed_amount" | "percentage";
  /** Base type */
  baseType: "tuition_only" | "full_assessment";
  /** Calculated discount amount */
  cashDiscountAmount: number;
  /** Assessment balance before discount */
  currentBalance: number;
  /** New balance after discount is applied (includes cascade adjustments) */
  newBalance: number;
  /** Amount the cashier should collect (includes cascade adjustments) */
  paymentRequired: number;
  /** Cutoff date for the school year */
  cutoffDate: Date;
  /** Whether discount is confirmed */
  isConfirmed: boolean;
  /** Called when user confirms the discount */
  onConfirm: () => void;
  /** Called when user declines the discount */
  onDecline: () => void;
  /** Cascade adjustment preview (if existing scholarships will be recalculated) */
  cascadePreview?: CascadeAdjustmentPreview;
}

export function CashDiscountPreviewCard({
  baseAmount,
  discountValue,
  calculationType,
  baseType,
  cashDiscountAmount,
  currentBalance,
  newBalance,
  paymentRequired,
  cutoffDate,
  isConfirmed,
  onConfirm,
  onDecline,
  cascadePreview,
}: CashDiscountPreviewCardProps) {
  // Memoized derived values
  const { baseLabel, discountLabel } = useMemo(
    () => ({
      baseLabel: baseType === "tuition_only" ? "tuition" : "assessment total",
      discountLabel:
        calculationType === "percentage"
          ? `${discountValue}% of ${baseType === "tuition_only" ? "tuition" : "assessment total"}`
          : `Fixed amount`,
    }),
    [baseType, calculationType, discountValue]
  );

  return (
    <div className="rounded-xl border-2 border-success/25 bg-success-tint p-4">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <BadgePercent className="h-5 w-5 text-success" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-success">
          Full Payment Cash Discount Available
        </h3>
      </div>

      {/* Confirmation status */}
      {isConfirmed && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-success-tint px-3 py-2">
          <CircleCheck className="h-4 w-4 text-success" />
          <span className="text-sm font-medium text-success">
            Discount confirmed - will be applied when payment is posted
          </span>
        </div>
      )}

      {/* Breakdown */}
      <div className="space-y-2 text-sm">
        {/* Base amount */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Base ({baseLabel}):
          </span>
          <span className="font-mono">
            <CurrencyDisplay amount={baseAmount} />
          </span>
        </div>

        {/* Current balance */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Current balance:</span>
          <span className="font-mono">
            <CurrencyDisplay amount={currentBalance} />
          </span>
        </div>

        {/* Discount amount (highlighted) */}
        <div className="flex justify-between rounded-lg bg-success-tint px-2 py-1.5">
          <span className="font-medium text-success">
            Cash discount ({discountLabel}):
          </span>
          <span className="font-mono font-bold text-success">
            -<CurrencyDisplay amount={cashDiscountAmount} />
          </span>
        </div>

        {/* Cascade adjustments (if any) */}
        {cascadePreview?.hasCascadeAdjustments && (
          <CascadeDiscountPreview preview={cascadePreview} />
        )}

        {/* Divider */}
        <div className="my-2 border-t border-success/25" />

        {/* New balance */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">New balance:</span>
          <span className="font-mono">
            <CurrencyDisplay amount={newBalance} />
          </span>
        </div>

        {/* Amount to collect (emphasized) */}
        <div className="flex justify-between rounded-lg bg-success px-3 py-2 text-white">
          <span className="font-semibold">Collect from student:</span>
          <span className="font-mono font-bold">
            <CurrencyDisplay amount={paymentRequired} />
          </span>
        </div>
      </div>

      {/* Cutoff date notice */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        <span>
          Valid until {formatDate(cutoffDate)} (cutoff date)
        </span>
      </div>

      {/* Actions */}
      {!isConfirmed && (
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant="success"
            size="sm"
            className="flex-1"
            onClick={onConfirm}
          >
            <CircleCheck className="mr-1.5 h-4 w-4" />
            Apply Discount
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDecline}
          >
            <X className="mr-1 h-4 w-4" />
            Skip
          </Button>
        </div>
      )}

      {isConfirmed && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-muted-foreground"
          onClick={onDecline}
        >
          <X className="mr-1 h-4 w-4" />
          Remove discount
        </Button>
      )}
    </div>
  );
}
