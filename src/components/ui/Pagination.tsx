import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  baseUrl: string; // e.g., "/staff/assessments?view=ledgers"
};

/**
 * Pagination component for navigating paginated data.
 * Displays page numbers with ellipsis for large page counts.
 */
export function Pagination({ currentPage, totalPages, baseUrl }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = generatePageNumbers(currentPage, totalPages);
  const separator = baseUrl.includes("?") ? "&" : "?";

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {/* Previous button */}
      {currentPage > 1 ? (
        <Link
          href={`${baseUrl}${separator}page=${currentPage - 1}`}
          className="pagination-btn"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className="pagination-btn pagination-btn-disabled" aria-disabled="true">
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {/* Page numbers */}
      {pageNumbers.map((pageNum, index) => {
        if (pageNum === "...") {
          return (
            <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
              ...
            </span>
          );
        }

        const page = pageNum as number;
        const isActive = page === currentPage;

        return isActive ? (
          <span
            key={page}
            className="pagination-btn pagination-btn-active"
            aria-current="page"
          >
            {page}
          </span>
        ) : (
          <Link
            key={page}
            href={`${baseUrl}${separator}page=${page}`}
            className="pagination-btn"
          >
            {page}
          </Link>
        );
      })}

      {/* Next button */}
      {currentPage < totalPages ? (
        <Link
          href={`${baseUrl}${separator}page=${currentPage + 1}`}
          className="pagination-btn"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className="pagination-btn pagination-btn-disabled" aria-disabled="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

/**
 * Generate page numbers with ellipsis for large page counts.
 * Shows: [1] ... [current-1, current, current+1] ... [last]
 */
function generatePageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  const delta = 1; // Pages to show on each side of current page
  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  // Calculate range around current page
  const rangeStart = Math.max(2, currentPage - delta);
  const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

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

  // Always show last page (if more than 1 page)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}
