import { cn } from "@/lib/utils/cn";

interface PortalProgressBarProps {
  /** Percentage 0-100. Values outside the range are clamped. */
  value: number;
  label?: string;
  className?: string;
}

/**
 * Payment progress indicator.
 *
 * The fill uses the primary-alpha ramp established by ArAgingCard rather than
 * a status color, so it stays legible in all four color themes and does not
 * depend on the warning token. The numeric percentage is always rendered, so
 * the meaning is never carried by color alone (WCAG 1.4.1).
 */
export function PortalProgressBar({
  value,
  label = "Payment progress",
  className,
}: PortalProgressBarProps) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.min(100, Math.max(0, Math.round(safe)));

  const fill =
    pct >= 100
      ? "bg-success"
      : pct >= 67
        ? "bg-primary"
        : pct >= 34
          ? "bg-primary/70"
          : "bg-primary/40";

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{pct}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={cn("h-full rounded-full transition-all", fill)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
