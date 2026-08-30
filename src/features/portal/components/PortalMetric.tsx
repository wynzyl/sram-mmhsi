import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Semantic emphasis for a figure. Deliberately not tied to --primary: a
 * settled balance should read as settled in every color theme, so these map
 * to status tokens (success / warning / destructive) rather than the brand
 * accent, which the theme picker changes.
 */
export type PortalMetricTone = "neutral" | "positive" | "attention" | "critical";

const TONE_SURFACE: Record<PortalMetricTone, string> = {
  neutral: "bg-muted/50",
  positive: "bg-success/10",
  attention: "bg-warning/10",
  critical: "bg-destructive/10",
};

const TONE_INK: Record<PortalMetricTone, string> = {
  neutral: "text-foreground",
  positive: "text-success",
  attention: "text-warning",
  critical: "text-destructive",
};

interface PortalMetricProps {
  label: string;
  value: ReactNode;
  tone?: PortalMetricTone;
  /** Supporting line under the value, e.g. "as of 12 Aug". */
  hint?: string;
  size?: "sm" | "lg";
}

/**
 * A single labelled figure.
 *
 * Below `sm` it lays out as a label-left / value-right row, because three
 * stacked currency tiles are unreadable on a 375px phone. From `sm` up it
 * becomes a stacked tile.
 */
export function PortalMetric({
  label,
  value,
  tone = "neutral",
  hint,
  size = "sm",
}: PortalMetricProps) {
  return (
    <div
      className={cn(
        "rounded-md px-3 py-2.5 sm:py-3",
        "flex items-baseline justify-between gap-3 sm:block",
        TONE_SURFACE[tone]
      )}
    >
      <dt className="text-xs font-medium text-muted-foreground sm:mb-1">
        {label}
      </dt>
      <dd className="text-right sm:text-left">
        <span
          className={cn(
            "font-semibold tabular-nums",
            size === "lg" ? "text-xl sm:text-2xl" : "text-base sm:text-lg",
            TONE_INK[tone]
          )}
        >
          {value}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

interface PortalMetricGroupProps {
  columns?: 2 | 3;
  className?: string;
  children: ReactNode;
}

/**
 * Lays out PortalMetric children. Always a single column below `sm`.
 */
export function PortalMetricGroup({
  columns = 3,
  className,
  children,
}: PortalMetricGroupProps) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-2 sm:gap-3",
        columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
        className
      )}
    >
      {children}
    </dl>
  );
}
