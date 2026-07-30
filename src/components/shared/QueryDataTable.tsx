"use client";

import {
  useQuery,
  type QueryKey,
  type UseQueryOptions,
  type QueryFunctionContext,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils/cn";
import { STANDARD_STALE_TIME } from "@/lib/query/staleness";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PaginationMeta = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
};

export type QueryDataTableResult<TData> = {
  data: TData[];
  pagination?: PaginationMeta;
};

export interface QueryDataTableProps<TData> {
  /**
   * TanStack Query key for caching.
   */
  queryKey: QueryKey;

  /**
   * Async function that fetches table data.
   * Should return `{ data: TData[], pagination?: PaginationMeta }`
   * Receives QueryFunctionContext with `signal` for request cancellation.
   */
  queryFn: (context: QueryFunctionContext) => Promise<QueryDataTableResult<TData>>;

  /**
   * Column definitions for TanStack Table.
   */
  columns: ColumnDef<TData>[];

  /**
   * Enable client-side search.
   * @default false
   */
  searchable?: boolean;

  /**
   * Placeholder text for search input.
   * @default "Search..."
   */
  searchPlaceholder?: string;

  /**
   * Number of rows per page (client-side pagination).
   * @default 20
   */
  pageSize?: number;

  /**
   * Enable client-side pagination.
   * @default true
   */
  enablePagination?: boolean;

  /**
   * Enable virtualization for large datasets.
   * @default false
   */
  enableVirtualization?: boolean;

  /**
   * Estimated row height for virtualization.
   * @default 50
   */
  virtualRowHeight?: number;

  /**
   * Enable auto-refresh at interval (in milliseconds).
   * @default undefined (no auto-refresh)
   */
  refetchInterval?: number;

  /**
   * Stale time for query cache (in milliseconds).
   * @default 60000 (1 minute)
   */
  staleTime?: number;

  /**
   * Message shown when there's no data.
   * @default "No data available."
   */
  emptyMessage?: string;

  /**
   * Additional query options.
   */
  queryOptions?: Partial<
    Omit<UseQueryOptions<QueryDataTableResult<TData>>, "queryKey" | "queryFn">
  >;

  /**
   * Additional CSS classes.
   */
  className?: string;

  /**
   * Custom loading component.
   */
  loadingComponent?: React.ReactNode;

  /**
   * Custom error component.
   */
  errorComponent?: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

/**
 * Data table that fetches data via TanStack Query.
 *
 * Combines the power of TanStack Query (caching, refetching, loading states)
 * with TanStack Table (sorting, filtering, pagination).
 *
 * @example
 * ```tsx
 * <QueryDataTable
 *   queryKey={queryKeys.students.list({ page: 1 })}
 *   queryFn={() => fetch('/api/students').then(r => r.json())}
 *   columns={studentColumns}
 *   searchable
 *   refetchInterval={30000}
 * />
 * ```
 */
export function QueryDataTable<TData>({
  queryKey,
  queryFn,
  columns,
  searchable = false,
  searchPlaceholder = "Search...",
  pageSize = 20,
  enablePagination = true,
  enableVirtualization = false,
  virtualRowHeight = 50,
  refetchInterval,
  staleTime = STANDARD_STALE_TIME,
  emptyMessage = "No data available.",
  queryOptions,
  className,
  loadingComponent,
  errorComponent,
}: QueryDataTableProps<TData>) {
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey,
    queryFn,
    staleTime,
    refetchInterval,
    ...queryOptions,
  });

  // Loading state
  if (isLoading) {
    return (
      loadingComponent ?? (
        <div className={cn("flex items-center justify-center py-12", className)}>
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" />
            <p className="text-secondary">Loading data...</p>
          </div>
        </div>
      )
    );
  }

  // Error state
  if (isError) {
    // Log error details for debugging (not shown to users in production)
    console.error("[QueryDataTable] Query error:", error);

    const isDev = process.env.NODE_ENV === "development";
    const errorMessage = isDev && error instanceof Error
      ? error.message
      : "Something went wrong while loading data. Please try again.";

    return (
      errorComponent ?? (
        <div className={cn("flex items-center justify-center py-12", className)}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="stroke-destructive"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">
              Failed to load data
            </p>
            <p className="text-helper max-w-xs">
              {errorMessage}
            </p>
          </div>
        </div>
      )
    );
  }

  const tableData = data?.data ?? [];

  return (
    <div className={cn("relative", className)}>
      {/* Refetching indicator */}
      {isFetching && !isLoading && (
        <div className="absolute top-2 right-2 z-20">
          <div className="flex-row-2 rounded-full bg-card px-3 py-1 shadow-sm border border-border">
            <Spinner size="sm" />
            <span className="text-helper">Refreshing...</span>
          </div>
        </div>
      )}

      <DataTable
        data={tableData}
        columns={columns}
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        enablePagination={enablePagination}
        enableVirtualization={enableVirtualization}
        virtualRowHeight={virtualRowHeight}
      />

      {tableData.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-secondary">{emptyMessage}</p>
        </div>
      )}

      {/* Server pagination info (if provided) */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-secondary">
          <p>
            Page {data.pagination.currentPage} of {data.pagination.totalPages}
          </p>
          <p>{data.pagination.totalCount.toLocaleString()} total records</p>
        </div>
      )}
    </div>
  );
}
