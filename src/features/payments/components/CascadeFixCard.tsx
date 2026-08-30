"use client";

import { useActionState, startTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { applyCascadeFixAction } from "../actions/cash-discount.actions";
import type { CascadeFixNeeded, CascadeFixFormState } from "../payments.types";

interface CascadeFixCardProps {
  assessmentId: string;
  fixData: CascadeFixNeeded;
}

/**
 * Card component that displays cascade fix preview and allows cashier to apply corrections.
 *
 * This is shown on the payment page when:
 * 1. Cash discount was applied first (via approval workflow)
 * 2. Sibling/scholarship discounts were applied later using the wrong tuition base
 *
 * The fix creates positive adjustment items that increase the balance to the correct amount.
 */
export function CascadeFixCard({ assessmentId, fixData }: CascadeFixCardProps) {
  const router = useRouter();
  const initialState: CascadeFixFormState = {};
  const [state, action, isPending] = useActionState(applyCascadeFixAction, initialState);

  // Refresh page after successful fix
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  const handleSubmit = useCallback(() => {
    const formData = new FormData();
    formData.set("assessmentId", assessmentId);
    startTransition(() => {
      action(formData);
    });
  }, [assessmentId, action]);

  return (
    <div className="rounded-xl border-2 border-warning bg-warning-tint p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-warning">
          Cascade Adjustment Required
        </h3>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        The following discounts were calculated on the original tuition amount instead of the
        discounted tuition. Apply the cascade fix to correct the balance before processing payment.
      </p>

      {/* Adjustment details */}
      <div className="space-y-2 text-sm">
        {fixData.adjustments.map((adj, idx) => (
          <div
            key={idx}
            // dark: kept deliberately: an alpha overlay whose direction flips per
            // theme (lighten on light, darken on dark) cannot be one token.
            className="flex flex-col gap-1 rounded bg-white/50 p-2 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium">{adj.discountTypeName}</span>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="text-destructive">
                <CurrencyDisplay amount={adj.originalAmount} />
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-success">
                <CurrencyDisplay amount={adj.correctAmount} />
              </span>
              <span className="ml-1 rounded bg-warning/20 px-1.5 py-0.5 text-warning">
                +<CurrencyDisplay amount={adj.adjustmentNeeded} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Total and action */}
      <div className="mt-3 flex flex-col gap-3 border-t border-warning/25 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Total balance adjustment:</span>
          <span className="ml-2 font-mono font-bold text-warning">
            +<CurrencyDisplay amount={fixData.totalAdjustment} />
          </span>
        </div>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-warning hover:bg-warning"
        >
          <Calculator className="mr-2 h-4 w-4" />
          {isPending ? "Applying..." : "Apply Cascade Fix"}
        </Button>
      </div>

      {/* Error message */}
      {state.message && !state.success && (
        <p className="mt-2 text-sm text-destructive">{state.message}</p>
      )}

      {/* Success message (brief flash before refresh) */}
      {state.success && (
        <p className="mt-2 text-sm text-success">{state.message}</p>
      )}
    </div>
  );
}
