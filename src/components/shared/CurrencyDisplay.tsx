import { cn } from "@/lib/utils/cn";

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  showSign?: boolean;
  /**
   * Screen-reader-only prefix, e.g. "Outstanding balance".
   * Use where the figure carries meaning that is otherwise conveyed only by
   * a nearby visual label, such as a large standalone balance.
   */
  srLabel?: string;
}

/**
 * Displays currency amounts in Philippine Peso format
 * Uses JetBrains Mono font for better number readability
 */
export function CurrencyDisplay({
  amount,
  className,
  showSign = false,
  srLabel,
}: CurrencyDisplayProps) {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

  return (
    <span className={cn("font-[family-name:var(--font-mono)]", className)}>
      {srLabel ? <span className="sr-only">{srLabel}: </span> : null}
      {showSign && amount > 0 && "+"}
      {formatted}
    </span>
  );
}
