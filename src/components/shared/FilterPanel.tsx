"use client";

import { Button } from "@/components/ui/button";

interface FilterPanelProps {
  /**
   * Filter content - children rendered inside the panel
   */
  children: React.ReactNode;
  /**
   * Called when reset/clear button is clicked
   */
  onReset?: () => void;
  /**
   * Whether filters have been applied (shows reset button when true)
   */
  hasActiveFilters?: boolean;
  /**
   * Whether a filter operation is pending
   */
  isPending?: boolean;
  /**
   * Optional className for the container
   */
  className?: string;
  /**
   * Layout variant
   * - "inline": Filters in a row with minimal styling (default)
   * - "card": Filters in a card with border and padding
   */
  variant?: "inline" | "card";
}

/**
 * Wrapper component for filter panels with consistent layout and reset functionality.
 *
 * This component provides:
 * - Consistent flexbox layout for filter fields
 * - Optional card styling
 * - Reset/clear button that appears when filters are active
 * - Loading state support
 *
 * @example
 * ```tsx
 * // Inline variant (minimal styling)
 * <FilterPanel
 *   hasActiveFilters={!!status || !!search}
 *   onReset={handleClear}
 *   isPending={isPending}
 * >
 *   <TextInputField ... />
 *   <SelectField ... />
 * </FilterPanel>
 *
 * // Card variant (bordered container)
 * <FilterPanel
 *   variant="card"
 *   hasActiveFilters={hasFilters}
 *   onReset={handleReset}
 * >
 *   {children}
 * </FilterPanel>
 * ```
 */
export function FilterPanel({
  children,
  onReset,
  hasActiveFilters = false,
  isPending = false,
  className = "",
  variant = "inline",
}: FilterPanelProps) {
  const baseClasses = "flex flex-wrap items-end gap-4";
  const variantClasses =
    variant === "card" ? "p-4 bg-card border border-border rounded-lg" : "";

  return (
    <div className={`${baseClasses} ${variantClasses} ${className}`}>
      {children}

      {hasActiveFilters && onReset && (
        <Button
          type="button"
          variant="ghost"
          onClick={onReset}
          disabled={isPending}
          className="text-muted-foreground"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
