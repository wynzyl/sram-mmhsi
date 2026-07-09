"use client";

import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

export type ClientTablePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Maximum number of page buttons to show (default: 5) */
  maxVisiblePages?: number;
  /** Label for items (default: "entries") */
  itemLabel?: string;
};

/**
 * Client-side table pagination component.
 *
 * Same visual styling as TablePagination but uses callback-based navigation
 * instead of URL links. Use this for client-side filtered/paginated tables
 * (e.g., DataTable with client-side data).
 *
 * Features:
 * - "Showing X to Y of Z entries" on the left
 * - First/Previous/Page numbers/Next/Last navigation on the right
 * - Current page highlighted with primary border
 * - Ellipsis for large page counts
 *
 * Usage:
 * ```tsx
 * const [currentPage, setCurrentPage] = useState(1);
 *
 * <ClientTablePagination
 *   currentPage={currentPage}
 *   totalPages={5}
 *   totalRecords={150}
 *   pageSize={25}
 *   onPageChange={setCurrentPage}
 *   itemLabel="students"
 * />
 * ```
 */
export function ClientTablePagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  maxVisiblePages = 5,
  itemLabel = "entries",
}: ClientTablePaginationProps) {
  if (totalRecords === 0 || totalPages <= 0) {
    return null;
  }

  // Calculate record range
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate visible page numbers
  const pageNumbers = generatePageNumbers(currentPage, totalPages, maxVisiblePages);

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
      {/* Record count */}
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{startRecord}</span> to{" "}
        <span className="font-semibold text-foreground">{endRecord}</span> of{" "}
        <span className="font-semibold text-foreground">{totalRecords}</span> {itemLabel}
      </p>

      {/* Navigation */}
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {/* First page */}
        <PaginationButton
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          aria-label="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </PaginationButton>

        {/* Previous page */}
        <PaginationButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirstPage}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PaginationButton>

        {/* Page numbers */}
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-sm text-muted-foreground select-none"
              >
                ...
              </span>
            );
          }

          const page = pageNum as number;
          const isActive = page === currentPage;

          return (
            <PaginationButton
              key={page}
              onClick={() => onPageChange(page)}
              active={isActive}
              aria-label={`Page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </PaginationButton>
          );
        })}

        {/* Next page */}
        <PaginationButton
          onClick={() => onPageChange(currentPage + 1)}
          disabled={isLastPage}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PaginationButton>

        {/* Last page */}
        <PaginationButton
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          aria-label="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </PaginationButton>
      </nav>
    </div>
  );
}

type PaginationButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
};

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: PaginationButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-medium rounded border transition-colors";

  if (disabled) {
    return (
      <span
        className={`${baseClasses} bg-muted/50 border-border text-muted-foreground/50 cursor-not-allowed`}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  if (active) {
    return (
      <span
        className={`${baseClasses} bg-card border-primary text-primary font-semibold`}
        aria-current={ariaCurrent}
      >
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} bg-card border-border text-foreground hover:bg-muted hover:border-muted-foreground/30`}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

/**
 * Generate page numbers with ellipsis for large page counts.
 * Ensures first and last pages are always visible.
 */
function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number
): (number | "...")[] {
  if (totalPages <= maxVisible) {
    // Show all pages if total is within limit
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  const sideCount = Math.floor((maxVisible - 3) / 2); // Pages on each side of current (excluding first, last, current)

  // Always include first page
  pages.push(1);

  // Calculate range around current page
  let rangeStart = Math.max(2, currentPage - sideCount);
  let rangeEnd = Math.min(totalPages - 1, currentPage + sideCount);

  // Adjust range if near the edges
  if (currentPage <= sideCount + 2) {
    rangeEnd = Math.min(totalPages - 1, maxVisible - 2);
  } else if (currentPage >= totalPages - sideCount - 1) {
    rangeStart = Math.max(2, totalPages - maxVisible + 3);
  }

  // Add ellipsis after first page if needed
  if (rangeStart > 2) {
    pages.push("...");
  }

  // Add pages in range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if needed
  if (rangeEnd < totalPages - 1) {
    pages.push("...");
  }

  // Always include last page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
