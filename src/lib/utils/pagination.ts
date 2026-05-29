/**
 * Pagination utility functions and styling constants.
 *
 * Extracted from ServerPagination for reuse across pagination components.
 */

/**
 * Generate page numbers with ellipsis markers for pagination controls.
 *
 * For 7 or fewer pages, returns all page numbers.
 * For more pages, returns first, last, and 2 pages on either side of current,
 * with "ellipsis" markers for gaps.
 *
 * @param current - Current page number (1-indexed)
 * @param total - Total number of pages
 * @returns Array of page numbers or "ellipsis" markers
 *
 * @example
 * paginationPages(5, 10) // [1, "ellipsis", 3, 4, 5, 6, 7, "ellipsis", 10]
 * paginationPages(1, 3)  // [1, 2, 3]
 */
export function paginationPages(
  current: number,
  total: number
): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * Tailwind CSS class constants for pagination buttons.
 * Ensures consistent styling across all pagination components.
 */
export const PAGINATION_BUTTON_STYLES = {
  /** Base button styles for all pagination buttons */
  base: "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted",
  /** Additional styles for the active/current page button */
  active: "border-primary bg-primary/10 text-primary font-semibold",
  /** Additional styles for disabled buttons (prev on page 1, next on last page) */
  disabled: "pointer-events-none opacity-40",
} as const;

/**
 * Calculate pagination display range.
 *
 * @param currentPage - Current page (1-indexed)
 * @param pageSize - Number of items per page
 * @param totalCount - Total number of items
 * @returns Object with start, end indices and formatted label
 */
export function paginationRange(
  currentPage: number,
  pageSize: number,
  totalCount: number
): { start: number; end: number } {
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  return { start, end };
}
