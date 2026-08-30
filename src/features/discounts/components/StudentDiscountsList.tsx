"use client";

import { useState, useMemo } from "react";
import type { StudentDiscountView } from "../discounts.schema";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DiscountReversalModal from "./DiscountReversalModal";

interface StudentDiscountsListProps {
  discounts: StudentDiscountView[];
  /** Whether the current user can reverse discounts (discounts:manage) */
  canReverse?: boolean;
  /** Whether the current user can request a replacement discount (discounts:request) */
  canRequest?: boolean;
  /**
   * When the request flow is blocked by the gate, this is the human-readable
   * reason shown next to reversed-discount rows so the user understands why
   * the "Request replacement" link is missing.
   */
  requestBlockReason?: string;
}

/**
 * A reversal counter row is a student_discounts entry stored with a NEGATIVE
 * discountAmount; it offsets a previously-reversed original. It has
 * reversedAt = null (so it sits in the Active bucket) and is not itself
 * reversible.
 */
const isReversalCounter = (discount: StudentDiscountView) =>
  Number(discount.discountAmount) < 0;

/**
 * Compute the math components behind the "Total Discounts" line so the user
 * can see exactly how it was derived:
 *
 *   grossDiscounts    = sum of positive discountAmount rows (original deductions,
 *                       including ones later reversed — the original line item
 *                       still sits in the ledger)
 *   reversalOffsets   = absolute sum of negative discountAmount rows (counter
 *                       entries that add their amount back to the balance)
 *   effectiveTotal    = grossDiscounts − reversalOffsets
 *                       (equivalent to signed sum of all rows; this is what
 *                       drops the balance)
 */
const computeDiscountTotals = (rows: StudentDiscountView[]) => {
  let grossDiscounts = 0;
  let reversalOffsets = 0;
  for (const row of rows) {
    const amount = Number(row.discountAmount);
    if (amount >= 0) {
      grossDiscounts += amount;
    } else {
      reversalOffsets += Math.abs(amount);
    }
  }
  return {
    grossDiscounts,
    reversalOffsets,
    effectiveTotal: grossDiscounts - reversalOffsets,
  };
};

export default function StudentDiscountsList({
  discounts,
  canReverse = false,
  canRequest = false,
  requestBlockReason,
}: StudentDiscountsListProps) {
  const [reversingDiscount, setReversingDiscount] =
    useState<StudentDiscountView | null>(null);

  // Memoize filtered discount arrays to prevent re-computation on every render
  const { activeDiscounts, reversedDiscounts } = useMemo(() => ({
    activeDiscounts: discounts.filter((d) => !d.reversedAt),
    reversedDiscounts: discounts.filter((d) => d.reversedAt),
  }), [discounts]);

  // Memoize discount totals computation (was previously an IIFE in JSX)
  const discountTotals = useMemo(
    () => computeDiscountTotals(discounts),
    [discounts]
  );

  if (discounts.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No discounts applied to this assessment.
      </div>
    );
  }

  const formatBaseInfo = (discount: StudentDiscountView) => {
    const baseLabel =
      discount.baseType === "tuition_only" ? "tuition" : "full assessment";
    return `on ${baseLabel}`;
  };

  const formatDiscountValue = (discount: StudentDiscountView) => {
    if (discount.calculationType === "percentage") {
      return `${Number(discount.discountValue)}%`;
    }
    return <CurrencyDisplay amount={Number(discount.discountValue)} />;
  };

  return (
    <div className="space-y-4">
      {/* Active Discounts */}
      {activeDiscounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Active Discounts</h4>
          <div className="space-y-2">
            {activeDiscounts.map((discount) => (
              <div
                key={discount.id}
                className="p-3 bg-muted rounded-lg flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex-row-2">
                    <span className="font-medium">
                      {discount.discountTypeName}
                    </span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <div className="text-secondary mt-1">
                    {formatDiscountValue(discount)} {formatBaseInfo(discount)}
                  </div>
                  <div className="text-helper mt-1">
                    Base: <CurrencyDisplay amount={Number(discount.baseAmount)} className="inline" />
                  </div>
                  <div className="text-helper">
                    Applied {formatDate(discount.appliedAt, { year: "numeric", month: "numeric", day: "numeric" })} by{" "}
                    {discount.appliedByName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-success">
                    {isReversalCounter(discount) ? "+" : "−"}
                    <CurrencyDisplay
                      amount={Math.abs(Number(discount.discountAmount))}
                      className="inline"
                    />
                  </div>
                  {isReversalCounter(discount) && (
                    <div className="text-helper mt-1">
                      added back to balance
                    </div>
                  )}
                  {canReverse && !isReversalCounter(discount) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs"
                      onClick={() => setReversingDiscount(discount)}
                    >
                      Reverse
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reversed Discounts */}
      {reversedDiscounts.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Reversed Discounts
          </h4>
          <div className="space-y-2">
            {reversedDiscounts.map((discount) => (
              <div
                key={discount.id}
                className="p-3 bg-card rounded-lg opacity-70 flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex-row-2">
                    <span className="font-medium line-through">
                      {discount.discountTypeName}
                    </span>
                    <Badge variant="danger">Reversed</Badge>
                  </div>
                  <div className="text-secondary mt-1 line-through">
                    {formatDiscountValue(discount)} {formatBaseInfo(discount)}
                  </div>
                  <div className="text-helper mt-1">
                    Reversed{" "}
                    {formatDate(discount.reversedAt!, { year: "numeric", month: "numeric", day: "numeric" })}
                    {discount.reversedByName && ` by ${discount.reversedByName}`}
                  </div>
                  {discount.reversalRemarks && (
                    <div className="text-helper italic mt-1">
                      Reason: {discount.reversalRemarks}
                    </div>
                  )}
                  {canRequest && !discount.hasReplacement && (
                    <a
                      href={`/staff/enrollments/${discount.enrollmentId}?requestDiscount=1&discountTypeCode=${encodeURIComponent(discount.discountTypeCode)}`}
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      Request replacement →
                    </a>
                  )}
                  {!canRequest && !discount.hasReplacement && requestBlockReason && (
                    <div className="mt-2 text-helper italic">
                      {requestBlockReason}
                    </div>
                  )}
                  {discount.hasReplacement && (
                    <div className="mt-2 text-xs text-success">
                      Replacement request issued.
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-success line-through">
                    −
                    <CurrencyDisplay
                      amount={Math.abs(Number(discount.discountAmount))}
                      className="inline"
                    />
                  </div>
                  <div className="text-helper mt-1">
                    offset above
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reversal Modal */}
      {reversingDiscount && (
        <DiscountReversalModal
          discount={reversingDiscount}
          onClose={() => setReversingDiscount(null)}
        />
      )}

      {/* Total Summary — show the gross deductions, the reversal offsets that
          add back to the balance, and the effective Total so the math is
          fully transparent. Uses memoized discountTotals computed above. */}
      {discounts.length > 0 && (
        <div className="pt-3 border-t border-border space-y-1">
          {discountTotals.reversalOffsets > 0 && (
            <>
              <div className="flex justify-between items-center text-secondary">
                <span>Gross discounts</span>
                <span className="font-[family-name:var(--font-mono)]">
                  −
                  <CurrencyDisplay
                    amount={discountTotals.grossDiscounts}
                    className="inline"
                  />
                </span>
              </div>
              <div className="flex justify-between items-center text-secondary">
                <span>Reversal offsets</span>
                <span className="font-[family-name:var(--font-mono)]">
                  +
                  <CurrencyDisplay
                    amount={discountTotals.reversalOffsets}
                    className="inline"
                  />
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-border">
            <span className="font-medium">Total Discounts</span>
            <span className="text-lg font-semibold text-success">
              −
              <CurrencyDisplay
                amount={discountTotals.effectiveTotal}
                className="inline"
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
