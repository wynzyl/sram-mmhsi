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
