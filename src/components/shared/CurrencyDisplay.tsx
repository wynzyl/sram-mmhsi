import { cn } from "@/lib/utils/cn";

interface CurrencyDisplayProps {
  amount: number;
  className?: string;
  showSign?: boolean;
}

/**
 * Displays currency amounts in Philippine Peso format
 * Uses JetBrains Mono font for better number readability
 */
export function CurrencyDisplay({
  amount,
  className,
  showSign = false,
}: CurrencyDisplayProps) {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

  return (
    <span className={cn("font-[family-name:var(--font-mono)]", className)}>
      {showSign && amount > 0 && "+"}
      {formatted}
    </span>
  );
}
