"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface StepDescriptor {
  /** 1-based index for display. */
  index: number;
  title: string;
  /** One-line context shown under the title. */
  description: string;
}

interface EnrollmentStepperProps {
  steps: StepDescriptor[];
  currentStep: number;
  /** Highest step the user has completed (for click-back navigation). */
  furthestStep: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Vertical step indicator for the enrollment wizard.
 * Click-back navigation (forward steps stay disabled until reached).
 */
export default function EnrollmentStepper({
  steps,
  currentStep,
  furthestStep,
  onStepClick,
  className,
}: EnrollmentStepperProps) {
  return (
    <ol className={cn("space-y-1", className)} aria-label="Enrollment progress">
      {steps.map((step, i) => {
        const status: "complete" | "active" | "upcoming" =
          step.index < currentStep
            ? "complete"
            : step.index === currentStep
            ? "active"
            : "upcoming";

        const canClick =
          Boolean(onStepClick) && step.index <= furthestStep && step.index !== currentStep;

        const isLast = i === steps.length - 1;

        return (
          <li key={step.index} className="relative flex gap-4">
            {/* Connector line */}
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[19px] top-10 h-[calc(100%-1.25rem)] w-px",
                  status === "complete"
                    ? "bg-[var(--color-accent-emerald)]/50"
                    : "bg-gray-200"
                )}
              />
            )}

            <StepCircle status={status} index={step.index} />

            <button
              type="button"
              disabled={!canClick}
              onClick={canClick ? () => onStepClick?.(step.index) : undefined}
              className={cn(
                "min-w-0 flex-1 rounded-md px-2 pb-6 pt-0.5 text-left transition-colors",
                "disabled:cursor-default",
                canClick && "hover:bg-[var(--color-primary)]/[0.04]"
              )}
              aria-current={status === "active" ? "step" : undefined}
            >
              <p
                className={cn(
                  "font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
                  status === "active" && "text-[var(--color-primary)]",
                  status === "complete" && "text-[var(--color-accent-emerald)]",
                  status === "upcoming" && "text-warm-gray"
                )}
              >
                Step {String(step.index).padStart(2, "0")}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-lg font-bold leading-tight",
                  status === "upcoming" ? "text-warm-gray" : "text-charcoal"
                )}
              >
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-warm-gray">
                {step.description}
              </p>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepCircle({
  status,
  index,
}: {
  status: "complete" | "active" | "upcoming";
  index: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        "transition-all duration-200",
        status === "complete" &&
          "bg-[var(--color-accent-emerald)] text-white shadow-[0_0_0_4px_rgba(16,185,129,0.12)]",
        status === "active" &&
          "bg-[var(--color-primary)] text-white shadow-[0_0_0_4px_rgba(199,0,0,0.12)]",
        status === "upcoming" &&
          "border border-gray-300 bg-white text-warm-gray"
      )}
    >
      {status === "complete" ? (
        <Check className="h-5 w-5 animate-checkmark" strokeWidth={3} />
      ) : (
        <span className="font-mono text-sm font-bold">{index}</span>
      )}
    </span>
  );
}
