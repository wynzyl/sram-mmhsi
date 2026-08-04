"use client";

import { useState, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils/cn";
import {
  ChevronUp,
  ChevronDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[];
  data: TData[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  enablePagination?: boolean;
  enableVirtualization?: boolean; // Enable for large datasets (1000+ rows)
  virtualRowHeight?: number; // Estimated row height in pixels (default: 50)
  className?: string;
  /** Row selection state (controlled) */
  rowSelection?: RowSelectionState;
  /** Callback for row selection changes */
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Function to get additional class names for a row */
  getRowClassName?: (row: Row<TData>) => string;
}

/**
 * Generic data table component with built-in sorting, filtering, and pagination.
 * Uses TanStack Table for powerful table functionality.
 *
 * For large datasets (1000+ rows), enable virtualization to render only visible rows.
 * This dramatically improves performance by avoiding rendering all rows to the DOM.
 */
export function DataTable<TData>({
  columns,
  data,
  searchable = false,
  searchPlaceholder = "Search...",
  pageSize = 20,
  enablePagination = true,
  enableVirtualization = false,
  virtualRowHeight = 50,
  className,
  rowSelection,
  onRowSelectionChange,
  getRowClassName,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filterInput, setFilterInput] = useState("");
  const debouncedFilter = useDebounce(filterInput, 300);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: debouncedFilter,
      ...(rowSelection !== undefined ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    ...(onRowSelectionChange
      ? {
          onRowSelectionChange: (updaterOrValue) => {
            const newSelection =
              typeof updaterOrValue === "function"
                ? updaterOrValue(rowSelection ?? {})
                : updaterOrValue;
            onRowSelectionChange(newSelection);
          },
          enableRowSelection: true,
        }
      : {}),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination && !enableVirtualization
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
  });

  // Setup virtualization for large datasets
  const { rows } = table.getRowModel();
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => virtualRowHeight,
    overscan: 10, // Render 10 extra rows above/below viewport for smooth scrolling
    enabled: enableVirtualization,
  });

  return (
    <div className={cn("flex-col-4", className)}>
      {searchable && (
        <div className="flex-row-2">
          <Input
            type="search"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder={searchPlaceholder}
            className="max-w-sm"
          />
        </div>
      )}

      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div
          ref={tableContainerRef}
          className="overflow-x-auto"
          style={
            enableVirtualization
              ? {
                  maxHeight: "600px",
                  overflow: "auto",
                }
              : {}
          }
        >
          <table className="w-full">
            <thead className="border-b border-border bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider bg-muted",
                        header.column.getCanSort() &&
                          "cursor-pointer select-none hover:bg-muted/80 transition-colors"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex-row-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() === "asc" && (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-secondary"
                  >
                    No results found.
                  </td>
                </tr>
              ) : enableVirtualization ? (
                <>
                  {/* Spacer for virtual scrolling */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td style={{ height: `${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px` }} />
                    </tr>
                  )}
                  {/* Render only visible rows */}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <tr
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={(node) => rowVirtualizer.measureElement(node)}
                        className="border-b border-border last:border-0 hover-muted"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-5 py-4 text-sm text-foreground"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {/* Spacer for virtual scrolling */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr>
                      <td
                        style={{
                          height: `${
                            rowVirtualizer.getTotalSize() -
                            (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1]?.end ?? 0)
                          }px`,
                        }}
                      />
                    </tr>
                  )}
                </>
              ) : (
                // Non-virtualized rendering (default)
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-muted transition-colors",
                      getRowClassName?.(row)
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-5 py-4 text-sm text-foreground"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {enablePagination && !enableVirtualization && data.length > 0 && (
        <ClientPagination
          currentPage={table.getState().pagination.pageIndex + 1}
          totalPages={table.getPageCount()}
          totalRecords={data.length}
          pageSize={pageSize}
          onPageChange={(page) => table.setPageIndex(page - 1)}
          itemLabel="entries"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-side pagination component (matches TablePagination visual style)
// ─────────────────────────────────────────────────────────────────────────────

type ClientPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
  itemLabel?: string;
};

function ClientPagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  maxVisiblePages = 5,
  itemLabel = "entries",
}: ClientPaginationProps) {
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

  const buttonBaseClasses =
    "inline-flex items-center justify-center min-w-[2rem] h-8 px-2 text-sm font-medium rounded border transition-colors";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
      {/* Record count */}
      <p className="text-secondary">
        Showing <span className="font-semibold text-foreground">{startRecord}</span> to{" "}
        <span className="font-semibold text-foreground">{endRecord}</span> of{" "}
        <span className="font-semibold text-foreground">{totalRecords}</span> {itemLabel}
      </p>

      {/* Navigation */}
      <nav className="flex-row-1" aria-label="Pagination">
        {/* First page */}
        <PaginationButton
          onClick={() => onPageChange(1)}
          disabled={isFirstPage}
          aria-label="First page"
          baseClasses={buttonBaseClasses}
        >
          <ChevronsLeft className="h-4 w-4" />
        </PaginationButton>

        {/* Previous page */}
        <PaginationButton
          onClick={() => onPageChange(currentPage - 1)}
          disabled={isFirstPage}
          aria-label="Previous page"
          baseClasses={buttonBaseClasses}
        >
          <ChevronLeft className="h-4 w-4" />
        </PaginationButton>

        {/* Page numbers */}
        {pageNumbers.map((pageNum, index) => {
          if (pageNum === "...") {
            return (
              <span
                key={`ellipsis-${index}`}
                className="px-2 text-secondary select-none"
              >
                …
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
              baseClasses={buttonBaseClasses}
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
          baseClasses={buttonBaseClasses}
        >
          <ChevronRight className="h-4 w-4" />
        </PaginationButton>

        {/* Last page */}
        <PaginationButton
          onClick={() => onPageChange(totalPages)}
          disabled={isLastPage}
          aria-label="Last page"
          baseClasses={buttonBaseClasses}
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
  baseClasses: string;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
};

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
  baseClasses,
  "aria-label": ariaLabel,
  "aria-current": ariaCurrent,
}: PaginationButtonProps) {
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
  const sideCount = Math.floor((maxVisible - 3) / 2);

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
