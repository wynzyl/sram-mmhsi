import { cn } from "@/lib/utils/cn";

interface ReferenceCodeProps {
  code: string;
  className?: string;
}

/**
 * Displays reference codes (OR numbers, student IDs, etc.) in monospace font
 * Styled for easy visual scanning and copying
 */
export function ReferenceCode({ code, className }: ReferenceCodeProps) {
  return (
    <code
      className={cn(
        "font-[family-name:var(--font-mono)] text-xs bg-[var(--color-surface-2)] px-2 py-0.5 rounded border border-[var(--color-border)] whitespace-nowrap",
        className
      )}
    >
      {code}
    </code>
  );
}
