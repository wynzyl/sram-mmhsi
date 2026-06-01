/**
 * Shared request parsing for report export routes.
 */

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
  /** Raw params echoed back for filenames / audit (null when defaulted). */
  startParam: string | null;
  endParam: string | null;
}

/**
 * Parse `startDate`/`endDate` query params into a normalized day range.
 * Defaults to the last 30 days when absent/invalid. Start is set to 00:00:00
 * and end to 23:59:59 (local server time, matching existing report routes).
 */
export function parseReportDateRange(searchParams: URLSearchParams): ReportDateRange {
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const parsedStart = startParam ? new Date(startParam) : null;
  const startDate =
    parsedStart && !isNaN(parsedStart.getTime()) ? parsedStart : thirtyDaysAgo;
  startDate.setHours(0, 0, 0, 0);

  const parsedEnd = endParam ? new Date(endParam) : null;
  const endDate =
    parsedEnd && !isNaN(parsedEnd.getTime()) ? parsedEnd : today;
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate, startParam, endParam };
}

/** Build an export filename stem like `payment-collection-2026-01-01-2026-01-31`. */
export function reportFilename(
  base: string,
  range: ReportDateRange,
): string {
  const start = range.startParam ?? "all";
  const end = range.endParam ?? "all";
  return `${base}-${start}-${end}`;
}
