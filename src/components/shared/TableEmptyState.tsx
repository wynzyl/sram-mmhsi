/**
 * Reusable empty state component for table rows.
 *
 * Provides a consistent look for empty tables across the application.
 */

import { InboxIcon } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TableEmptyStateProps {
  /** Message to display when table is empty */
  message: string;
  /** Number of columns the cell should span */
  colSpan: number;
  /** Optional icon component to display. Defaults to InboxIcon */
  icon?: React.ReactNode;
  /** Whether to show the icon. Defaults to false for backward compatibility */
  showIcon?: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

/**
 * Empty state row for tables when no data is available.
 *
 * Use this inside a `<tbody>` element to display a consistent empty state
 * message across all data tables.
 *
 * @example
 * ```tsx
 * <tbody>
 *   {data.length === 0 ? (
 *     <TableEmptyState
 *       message="No students found."
 *       colSpan={5}
 *     />
 *   ) : (
 *     data.map(row => <tr key={row.id}>...</tr>)
 *   )}
 * </tbody>
 * ```
 *
 * @example
 * ```tsx
 * // With icon
 * <TableEmptyState
 *   message="No payments recorded yet."
 *   colSpan={7}
 *   showIcon
 * />
 * ```
 */
export function TableEmptyState({
  message,
  colSpan,
  icon,
  showIcon = false,
}: TableEmptyStateProps) {
  const iconElement = icon ?? (
    <InboxIcon className="h-8 w-8 text-muted-foreground/60" />
  );

  return (
    <tr>
      <td
        colSpan={colSpan}
        className="table-empty px-6 py-12 text-center text-muted-foreground"
      >
        {showIcon && (
          <div className="flex justify-center mb-3">
            {iconElement}
          </div>
        )}
        <p>{message}</p>
      </td>
    </tr>
  );
}

/**
 * Standalone empty state component for non-table contexts.
 *
 * Use this when you need an empty state outside of a table structure.
 */
export function EmptyState({
  message,
  icon,
  showIcon = true,
}: Omit<TableEmptyStateProps, "colSpan">) {
  const iconElement = icon ?? (
    <InboxIcon className="h-12 w-12 text-muted-foreground/60" />
  );

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
      {showIcon && <div className="mb-3">{iconElement}</div>}
      <p>{message}</p>
    </div>
  );
}
