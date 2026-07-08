/**
 * Reusable table column factory functions for TanStack Table
 *
 * These factories reduce duplication across table components by providing
 * consistent column definitions for common patterns like:
 * - Student info (name + reference code)
 * - Currency amounts
 * - Status badges
 * - Date formatting
 */

import type { ColumnDef, AccessorFn } from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { formatDate, formatDateTime } from "@/lib/utils/date";

// ─── Student Column ───────────────────────────────────────────────────────────

type StudentColumnRow = {
  studentName: string;
  studentRef?: string;
  referenceNumber?: string;
};

interface StudentColumnOptions {
  /** Column header text. Defaults to "Student" */
  header?: string;
  /** Minimum width CSS class. Defaults to "min-w-[16rem]" */
  minWidth?: string;
  /** Reference field key. Defaults to checking studentRef then referenceNumber */
  refKey?: "studentRef" | "referenceNumber";
}

/**
 * Creates a column for displaying student name + reference code
 *
 * @example
 * ```tsx
 * const columns = [
 *   createStudentColumn<MyRowType>(),
 *   // other columns...
 * ];
 * ```
 */
export function createStudentColumn<T extends StudentColumnRow>(
  options: StudentColumnOptions = {}
): ColumnDef<T> {
  const {
    header = "Student",
    minWidth = "min-w-[16rem]",
    refKey,
  } = options;

  return {
    header,
    id: "student",
    accessorFn: (row) => {
      const ref = refKey ? row[refKey] : (row.studentRef ?? row.referenceNumber);
      return `${row.studentName} ${ref ?? ""}`;
    },
    cell: ({ row }) => {
      const ref = refKey
        ? row.original[refKey]
        : (row.original.studentRef ?? row.original.referenceNumber);

      return (
        <div className={minWidth}>
          <div className="font-semibold text-foreground">
            {row.original.studentName}
          </div>
          {ref && (
            <div className="mt-1">
              <ReferenceCode code={ref} />
            </div>
          )}
        </div>
      );
    },
  };
}

// ─── Currency Column ──────────────────────────────────────────────────────────

interface CurrencyColumnOptions {
  /** Column header text. Required */
  header: string;
  /** Column ID for TanStack Table. Defaults to accessor key if string */
  id?: string;
  /** Text alignment. Defaults to "right" */
  align?: "left" | "center" | "right";
  /** Additional className for the amount display */
  className?: string;
  /** Whether to show + sign for positive amounts */
  showSign?: boolean;
}

/**
 * Creates a column for displaying currency amounts
 *
 * @param accessor - Either a key of T or an accessor function
 * @param options - Column configuration
 *
 * @example
 * ```tsx
 * // Using a key
 * createCurrencyColumn<MyRowType>("balance", { header: "Balance" })
 *
 * // Using an accessor function
 * createCurrencyColumn<MyRowType>(
 *   (row) => Number(row.amount),
 *   { header: "Amount" }
 * )
 * ```
 */
export function createCurrencyColumn<T>(
  accessor: keyof T | AccessorFn<T, number>,
  options: CurrencyColumnOptions
): ColumnDef<T> {
  const {
    header,
    id,
    align = "right",
    className = "font-semibold",
    showSign = false,
  } = options;

  const alignmentClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "";

  const cellRenderer = ({ row }: { row: { original: T; index: number } }) => {
    const value =
      typeof accessor === "function"
        ? accessor(row.original, row.index)
        : (row.original[accessor] as number | string);

    const amount = typeof value === "string" ? Number(value) : value;

    return (
      <div className={alignmentClass}>
        <CurrencyDisplay
          amount={amount}
          className={className}
          showSign={showSign}
        />
      </div>
    );
  };

  const headerRenderer = () => (
    <span className={`block ${alignmentClass}`}>{header}</span>
  );

  // Return complete column definition based on accessor type
  if (typeof accessor === "function") {
    return {
      id: id ?? "currency",
      accessorFn: accessor,
      header: headerRenderer,
      cell: cellRenderer,
    } as ColumnDef<T>;
  }

  return {
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    header: headerRenderer,
    cell: cellRenderer,
  } as ColumnDef<T>;
}

// ─── Status Column ────────────────────────────────────────────────────────────

type StatusType = "payment" | "enrollment" | "or" | "billing" | "studentType";

interface StatusColumnOptions {
  /** Column header text. Defaults to "Status" */
  header?: string;
  /** StatusBadge type for variant mapping. Required */
  type: StatusType;
  /** Column ID. Defaults to "status" */
  id?: string;
}

/**
 * Creates a column for displaying status badges
 *
 * @param accessor - The key of T that contains the status string
 * @param options - Column configuration including StatusBadge type
 *
 * @example
 * ```tsx
 * createStatusColumn<MyRowType>("billingStatus", {
 *   header: "Billing Status",
 *   type: "billing",
 * })
 * ```
 */
export function createStatusColumn<T>(
  accessor: keyof T,
  options: StatusColumnOptions
): ColumnDef<T> {
  const { header = "Status", type, id } = options;

  return {
    header,
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    cell: ({ row }) => {
      const status = row.original[accessor] as string;
      return <StatusBadge type={type} status={status} />;
    },
  };
}

// ─── Date Column ──────────────────────────────────────────────────────────────

interface DateColumnOptions {
  /** Column header text. Required */
  header: string;
  /** Column ID. Defaults to accessor key if string */
  id?: string;
  /** Whether to include time in the display. Defaults to false */
  includeTime?: boolean;
  /** Custom date format options */
  formatOptions?: Intl.DateTimeFormatOptions;
  /** Placeholder for null/undefined dates. Defaults to "—" */
  placeholder?: string;
}

/**
 * Creates a column for displaying dates
 *
 * @param accessor - Either a key of T or an accessor function
 * @param options - Column configuration
 *
 * @example
 * ```tsx
 * // Simple date column
 * createDateColumn<MyRowType>("createdAt", { header: "Created" })
 *
 * // With time
 * createDateColumn<MyRowType>("paymentDate", {
 *   header: "Payment Date",
 *   includeTime: true,
 * })
 * ```
 */
export function createDateColumn<T>(
  accessor: keyof T | AccessorFn<T, Date | string | null | undefined>,
  options: DateColumnOptions
): ColumnDef<T> {
  const {
    header,
    id,
    includeTime = false,
    formatOptions,
    placeholder = "—",
  } = options;

  const cellRenderer = ({ row }: { row: { original: T; index: number } }) => {
    const value =
      typeof accessor === "function"
        ? accessor(row.original, row.index)
        : (row.original[accessor] as Date | string | null | undefined);

    if (!value) return <span className="text-muted-foreground">{placeholder}</span>;

    const dateObj = value instanceof Date ? value : new Date(value);

    if (!Number.isFinite(dateObj.getTime())) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const formatted = formatOptions
      ? formatDate(dateObj, formatOptions)
      : includeTime
        ? formatDateTime(dateObj)
        : formatDate(dateObj);

    return <span>{formatted}</span>;
  };

  // Return complete column definition based on accessor type
  if (typeof accessor === "function") {
    return {
      id: id ?? "date",
      accessorFn: accessor,
      header,
      cell: cellRenderer,
    } as ColumnDef<T>;
  }

  return {
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    header,
    cell: cellRenderer,
  } as ColumnDef<T>;
}

// ─── Text Column ──────────────────────────────────────────────────────────────

interface TextColumnOptions {
  /** Column header text. Required */
  header: string;
  /** Column ID. Defaults to accessor key */
  id?: string;
  /** Additional className for the cell */
  className?: string;
  /** Placeholder for null/undefined values. Defaults to "—" */
  placeholder?: string;
}

/**
 * Creates a simple text column with optional styling
 *
 * @example
 * ```tsx
 * createTextColumn<MyRowType>("gradeLevel", {
 *   header: "Grade Level",
 *   className: "text-gray-600 dark:text-gray-400",
 * })
 * ```
 */
export function createTextColumn<T>(
  accessor: keyof T,
  options: TextColumnOptions
): ColumnDef<T> {
  const {
    header,
    id,
    className = "",
    placeholder = "—",
  } = options;

  return {
    header,
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    cell: ({ row }) => {
      const value = row.original[accessor] as string | null | undefined;
      if (!value) {
        return <span className="text-muted-foreground">{placeholder}</span>;
      }
      return <span className={className}>{value}</span>;
    },
  };
}

// ─── OR Number Column ────────────────────────────────────────────────────────

interface ORNumberColumnOptions {
  /** Column header text. Defaults to "OR Number" */
  header?: string;
  /** Column ID. Defaults to "orNumber" */
  id?: string;
}

/**
 * Creates a column for displaying OR (Official Receipt) numbers
 * Renders using ReferenceCode component for consistent monospace styling
 *
 * @example
 * ```tsx
 * createORNumberColumn<PaymentRow>("orNumber")
 * createORNumberColumn<PaymentRow>("orNumber", { header: "Receipt #" })
 * ```
 */
export function createORNumberColumn<T>(
  accessor: keyof T,
  options: ORNumberColumnOptions = {}
): ColumnDef<T> {
  const { header = "OR Number", id } = options;

  return {
    header,
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    cell: ({ row }) => {
      const value = row.original[accessor] as string | null | undefined;
      if (!value) {
        return <span className="text-muted-foreground">-</span>;
      }
      return <ReferenceCode code={value} />;
    },
  };
}

// ─── Action Date Column ──────────────────────────────────────────────────────

interface ActionDateColumnOptions {
  /** Column header text. Required */
  header: string;
  /** Column ID. Defaults to accessor key */
  id?: string;
  /** Whether to show time on a second line. Defaults to true */
  showTime?: boolean;
  /** Placeholder for null dates. Defaults to "—" */
  placeholder?: string;
}

/**
 * Creates a column for displaying action dates with optional time on second line
 * Commonly used for "Requested At", "Approved At", "Created At" columns
 *
 * @example
 * ```tsx
 * createActionDateColumn<VoidRequest>("requestedAt", { header: "Requested At" })
 * createActionDateColumn<Payment>("postedAt", { header: "Posted", showTime: false })
 * ```
 */
export function createActionDateColumn<T>(
  accessor: keyof T | AccessorFn<T, Date | string | null | undefined>,
  options: ActionDateColumnOptions
): ColumnDef<T> {
  const {
    header,
    id,
    showTime = true,
    placeholder = "—",
  } = options;

  const cellRenderer = ({ row }: { row: { original: T; index: number } }) => {
    const value =
      typeof accessor === "function"
        ? accessor(row.original, row.index)
        : (row.original[accessor] as Date | string | null | undefined);

    if (!value) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const dateObj = value instanceof Date ? value : new Date(value);

    if (!Number.isFinite(dateObj.getTime())) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const dateStr = formatDate(dateObj, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });

    if (!showTime) {
      return <span className="text-sm">{dateStr}</span>;
    }

    const timeStr = formatDate(dateObj, {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div className="text-sm">
        <div>{dateStr}</div>
        <div className="text-xs text-muted-foreground">{timeStr}</div>
      </div>
    );
  };

  if (typeof accessor === "function") {
    return {
      id: id ?? "actionDate",
      accessorFn: accessor,
      header,
      cell: cellRenderer,
    } as ColumnDef<T>;
  }

  return {
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    header,
    cell: cellRenderer,
  } as ColumnDef<T>;
}

// ─── Remarks/Reason Column ───────────────────────────────────────────────────

interface RemarksColumnOptions {
  /** Column header text. Defaults to "Reason" */
  header?: string;
  /** Column ID. Defaults to accessor key */
  id?: string;
  /** Maximum width CSS class. Defaults to "max-w-[200px]" */
  maxWidth?: string;
  /** Whether to truncate long text. Defaults to true */
  truncate?: boolean;
  /** Placeholder for empty values. Defaults to "—" */
  placeholder?: string;
}

/**
 * Creates a column for displaying remarks, reasons, or notes
 * Supports truncation with title tooltip for long text
 *
 * @example
 * ```tsx
 * createRemarksColumn<VoidRequest>("requestReason", { header: "Reason" })
 * createRemarksColumn<CancellationRequest>("remarks", {
 *   header: "Notes",
 *   maxWidth: "max-w-[300px]",
 * })
 * ```
 */
export function createRemarksColumn<T>(
  accessor: keyof T,
  options: RemarksColumnOptions = {}
): ColumnDef<T> {
  const {
    header = "Reason",
    id,
    maxWidth = "max-w-[200px]",
    truncate = true,
    placeholder = "—",
  } = options;

  return {
    header,
    id: id ?? String(accessor),
    accessorKey: accessor as string,
    cell: ({ row }) => {
      const value = row.original[accessor] as string | null | undefined;
      if (!value) {
        return <span className="text-muted-foreground">{placeholder}</span>;
      }

      const className = truncate
        ? `text-sm ${maxWidth} truncate block`
        : "text-sm";

      return (
        <span className={className} title={truncate ? value : undefined}>
          {value}
        </span>
      );
    },
  };
}

// ─── Requested By Column ─────────────────────────────────────────────────────

interface RequestedByRow {
  requestedByUsername?: string;
  requestedByName?: string;
  requestedAt?: Date | string;
}

interface RequestedByColumnOptions {
  /** Column header text. Defaults to "Requested By" */
  header?: string;
  /** Key for username. Defaults to "requestedByUsername" */
  usernameKey?: "requestedByUsername" | "requestedByName";
  /** Key for date. Defaults to "requestedAt" */
  dateKey?: string;
  /** Whether to show the date below the name. Defaults to true */
  showDate?: boolean;
}

/**
 * Creates a column for displaying who requested an action and when
 * Commonly used in approval queue tables
 *
 * @example
 * ```tsx
 * createRequestedByColumn<VoidRequest>()
 * createRequestedByColumn<CancellationRequest>({ usernameKey: "requestedByName" })
 * ```
 */
export function createRequestedByColumn<T extends RequestedByRow>(
  options: RequestedByColumnOptions = {}
): ColumnDef<T> {
  const {
    header = "Requested By",
    usernameKey = "requestedByUsername",
    dateKey = "requestedAt",
    showDate = true,
  } = options;

  return {
    header,
    id: "requestedBy",
    accessorFn: (row) => row[usernameKey] ?? "",
    cell: ({ row }) => {
      const username = row.original[usernameKey];
      const dateValue = row.original[dateKey as keyof T] as Date | string | undefined;

      return (
        <div className="text-sm">
          <div>{username ?? "—"}</div>
          {showDate && dateValue && (
            <div className="text-xs text-muted-foreground">
              {formatDate(
                dateValue instanceof Date ? dateValue : new Date(dateValue)
              )}
            </div>
          )}
        </div>
      );
    },
  };
}
