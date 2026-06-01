/**
 * Shared report/document formatters.
 *
 * Reuses the canonical app utilities so PDF and XLSX output stop re-rolling
 * `Intl` and stop emitting the "PHP " workaround. All dates are pinned to
 * `Asia/Manila` via `formatDate` (see src/lib/utils/date.ts).
 *
 * Pure functions only — safe to import from PDF documents, XLSX builders, and
 * route handlers alike.
 */
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatDateTime } from "@/lib/utils/date";

/**
 * Peso amount as display text, e.g. "₱1,234.00".
 *
 * Renders the real ₱ glyph — only safe in PDFs once `registerReportFonts()`
 * has embedded a Unicode font that contains U+20B1 (the built-in Helvetica
 * does not). For Excel cells prefer {@link pesoNumber} + a currency number
 * format so the spreadsheet can total the column.
 */
export function pesoText(amount: number | string): string {
  return formatCurrency(amount);
}

/** Numeric peso value for XLSX cells (let Excel apply the currency format). */
export function pesoNumber(amount: number | string): number {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return Number.isFinite(n) ? n : 0;
}

/** Excel number format string for peso currency. */
export const PESO_NUMBER_FORMAT = '"₱"#,##0.00';

/** Short report date, e.g. "Jun 1, 2026" (Asia/Manila). */
export function reportDate(date: Date | string | null | undefined): string {
  return formatDate(date, { year: "numeric", month: "short", day: "numeric" });
}

/** Long report date, e.g. "June 1, 2026" (Asia/Manila). */
export function reportLongDate(date: Date | string | null | undefined): string {
  return formatDate(date, { year: "numeric", month: "long", day: "numeric" });
}

/** Report date + time, e.g. "Jun 1, 2026, 08:30 PM" (Asia/Manila). */
export function reportDateTime(date: Date | string | null | undefined): string {
  return formatDateTime(date);
}

/** "Jun 1, 2026 – Jun 30, 2026" period label for report headers. */
export function reportPeriodLabel(start: Date, end: Date): string {
  return `${reportDate(start)} – ${reportDate(end)}`;
}
