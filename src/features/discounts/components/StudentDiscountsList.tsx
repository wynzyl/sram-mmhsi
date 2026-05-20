"use client";

import { useState } from "react";
import type { StudentDiscountView } from "../discounts.schema";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DiscountReversalModal from "./DiscountReversalModal";

interface StudentDiscountsListProps {
  discounts: StudentDiscountView[];
  /** Whether the current user can reverse discounts */
  canReverse?: boolean;
}

export default function StudentDiscountsList({
  discounts,
  canReverse = false,
}: StudentDiscountsListProps) {
  const [reversingDiscount, setReversingDiscount] =
    useState<StudentDiscountView | null>(null);

  const activeDiscounts = discounts.filter((d) => !d.reversedAt);
  const reversedDiscounts = discounts.filter((d) => d.reversedAt);

  if (discounts.length === 0) {
    return (
      <div className="p-4 text-center text-[var(--color-text-muted)]">
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
                className="p-3 bg-[var(--color-surface-2)] rounded-lg flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {discount.discountTypeName}
                    </span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] mt-1">
                    {formatDiscountValue(discount)} {formatBaseInfo(discount)}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">
                    Base: <CurrencyDisplay amount={Number(discount.baseAmount)} className="inline" />
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Applied {new Date(discount.appliedAt).toLocaleDateString("en-PH")} by{" "}
                    {discount.appliedByName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-[var(--color-success)]">
                    -<CurrencyDisplay amount={Number(discount.discountAmount)} className="inline" />
                  </div>
                  {canReverse && (
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
          <h4 className="text-sm font-medium mb-2 text-[var(--color-text-muted)]">
            Reversed Discounts
          </h4>
          <div className="space-y-2">
            {reversedDiscounts.map((discount) => (
              <div
                key={discount.id}
                className="p-3 bg-[var(--color-surface)] rounded-lg opacity-60"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium line-through">
                    {discount.discountTypeName}
                  </span>
                  <Badge variant="danger">Reversed</Badge>
                </div>
                <div className="text-sm text-[var(--color-text-muted)] mt-1 line-through">
                  {formatDiscountValue(discount)} {formatBaseInfo(discount)}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">
                  Reversed{" "}
                  {new Date(discount.reversedAt!).toLocaleDateString("en-PH")}
                  {discount.reversedByName && ` by ${discount.reversedByName}`}
                </div>
                {discount.reversalRemarks && (
                  <div className="text-xs text-[var(--color-text-muted)] italic mt-1">
                    Reason: {discount.reversalRemarks}
                  </div>
                )}
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

      {/* Total Summary */}
      {activeDiscounts.length > 0 && (
        <div className="pt-3 border-t border-[var(--color-border)]">
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Discounts</span>
            <span className="text-lg font-semibold text-[var(--color-success)]">
              -
              <CurrencyDisplay
                amount={activeDiscounts.reduce(
                  (sum, d) => sum + Number(d.discountAmount),
                  0
                )}
                className="inline"
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
