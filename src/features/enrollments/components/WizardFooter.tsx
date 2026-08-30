"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { WizardStep } from "../wizard.types";

export interface WizardFooterProps {
  currentStep: WizardStep;
  canContinue: boolean;
  pending: boolean;
  disableSubmit: boolean;
  onBack: () => void;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * Footer navigation for the enrollment wizard.
 * Shows Back/Cancel on left, Continue/Submit on right.
 */
export default function WizardFooter({
  currentStep,
  canContinue,
  pending,
  disableSubmit,
  onBack,
  onContinue,
  onCancel,
}: WizardFooterProps) {
  const isFinalStep = currentStep === 3;

  return (
    <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      )}

      {isFinalStep ? (
        <button
          type="submit"
          disabled={disableSubmit}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all",
            "bg-primary hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          {pending ? (
            <>
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                aria-hidden="true"
              />
              Creating enrollment…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Confirm & create enrollment
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue || pending}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all",
            "bg-primary hover:bg-primary/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
