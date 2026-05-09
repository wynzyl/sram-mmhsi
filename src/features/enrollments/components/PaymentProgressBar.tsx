import { cn } from "@/lib/utils/cn";

interface PaymentProgressBarProps {
  /** Total amount paid so far (PHP). */
  paid: number;
  /** Total amount due on the assessment (PHP). May be 0 when no assessment exists. */
  total: number;
  /** When true, render only the bar (no caption). */
  compact?: boolean;
  className?: string;
}

function formatPhp(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Slim horizontal progress bar visualising paid / total tuition.
 * Pure CSS, no JS — colour shifts from primary red → emerald at 100%.
 */
export default function PaymentProgressBar({
  paid,
  total,
  compact = false,
  className,
}: PaymentProgressBarProps) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const safePaid = Number.isFinite(paid) && paid > 0 ? Math.min(paid, safeTotal || paid) : 0;
  const percentage = safeTotal > 0 ? Math.min(100, (safePaid / safeTotal) * 100) : 0;
  const isComplete = safeTotal > 0 && percentage >= 100;
  const hasAnyPayment = safePaid > 0;

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-light-gray"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Tuition paid ${formatPhp(safePaid)} of ${formatPhp(safeTotal)}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            isComplete
              ? "bg-[var(--color-accent-emerald)]"
              : hasAnyPayment
              ? "bg-[var(--color-primary)]"
              : "bg-gray-300"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {!compact && (
        <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-ops-muted">
          <span>
            <span
              className={cn(
                "font-semibold",
                isComplete
                  ? "text-[var(--color-accent-emerald)]"
                  : "text-ops-ink"
              )}
            >
              {formatPhp(safePaid)}
            </span>
            <span className="mx-1">/</span>
            <span>{formatPhp(safeTotal)}</span>
          </span>
          <span
            className={cn(
              "tabular-nums",
              isComplete && "text-[var(--color-accent-emerald)]"
            )}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}
