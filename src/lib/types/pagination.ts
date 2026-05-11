/**
 * Pagination Utility Types
 *
 * Used for server-side pagination across the application.
 * Implements limit/offset pagination with metadata tracking.
 */

export type PaginationParams = {
  page: number; // 1-indexed page number
  pageSize: number; // Records per page
  orderBy?: string; // Column to sort by
  orderDir?: "asc" | "desc"; // Sort direction
};

export type PaginatedResult<T> = {
  data: T[]; // The actual data records
  pagination: {
    page: number; // Current page (1-indexed)
    pageSize: number; // Records per page
    totalRecords: number; // Total records in the dataset
    totalPages: number; // Total pages available
    hasNextPage: boolean; // Whether there's a next page
    hasPreviousPage: boolean; // Whether there's a previous page
  };
};

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  pageSize: number,
  totalRecords: number
): PaginatedResult<never>["pagination"] {
  const totalPages = Math.ceil(totalRecords / pageSize);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    pageSize,
    totalRecords,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Calculate SQL offset from page number
 */
export function calculateOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
