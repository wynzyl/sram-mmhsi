"use client";

import { useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils/cn";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
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
    <div className={cn("flex flex-col gap-4", className)}>
      {searchable && (
        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
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
                          "cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-2">
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
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
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
                        className="border-b border-border last:border-0 hover:bg-muted transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-5 py-4 text-sm text-[var(--color-text)]"
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
                    className="border-b border-border last:border-0 hover:bg-muted transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-5 py-4 text-sm text-[var(--color-text)]"
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

      {enablePagination && !enableVirtualization && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
