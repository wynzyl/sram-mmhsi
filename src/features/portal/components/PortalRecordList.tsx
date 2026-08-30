import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface PortalRecordColumn<T> {
  key: string;
  label: string;
  align?: "start" | "end";
  /**
   * Placement on narrow viewports.
   * - primary:   headline row of the stacked card
   * - secondary: supporting line beneath, prefixed with its label
   * - hidden:    desktop table only
   */
  mobile?: "primary" | "secondary" | "hidden";
  render: (row: T) => ReactNode;
}

interface PortalRecordListProps<T> {
  columns: PortalRecordColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Describes the table for screen readers. */
  caption: string;
  emptyMessage?: string;
}

/**
 * Responsive record table.
 *
 * A six-column receipt table is a horizontal-scroll trap on a phone, which is
 * the portal's primary device, so below `md` the same data is re-laid out as
 * stacked cards. One data pass drives both, so the two can never disagree.
 */
export function PortalRecordList<T>({
  columns,
  rows,
  getRowKey,
  caption,
  emptyMessage = "Nothing to show yet.",
}: PortalRecordListProps<T>) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-5">
        {emptyMessage}
      </p>
    );
  }

  const primary = columns.filter((c) => (c.mobile ?? "secondary") === "primary");
  const secondary = columns.filter((c) => (c.mobile ?? "secondary") === "secondary");

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-full">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                    col.align === "end" ? "text-right" : "text-left"
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className="border-t border-border transition-colors hover:bg-muted/50"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-5 py-3.5 text-sm text-foreground",
                      col.align === "end" ? "text-right" : "text-left"
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked cards below md */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)} className="space-y-1.5 px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              {primary.map((col) => (
                <span
                  key={col.key}
                  className={cn(
                    "text-sm text-foreground",
                    col.align === "end" && "ml-auto font-semibold"
                  )}
                >
                  {col.render(row)}
                </span>
              ))}
            </div>
            {secondary.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {secondary.map((col) => (
                  <span key={col.key} className="inline-flex items-center gap-1">
                    <span className="sr-only">{col.label}:</span>
                    {col.render(row)}
                  </span>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
