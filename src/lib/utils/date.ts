/**
 * Date formatting utilities
 */

/**
 * Canonical timezone for the school. Pinned so date formatting is deterministic
 * across server (UTC) and client (browser locale) — otherwise the same timestamp
 * renders as different calendar dates and triggers React hydration mismatches.
 */
export const SCHOOL_TIME_ZONE = "Asia/Manila";

/**
 * Format a date as a human-readable string
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  if (!date) return "—";

  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) return "—";

  // Force the school timezone so SSR and client render identical text.
  // Callers can still override by passing an explicit `timeZone`.
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: SCHOOL_TIME_ZONE,
    ...options,
  }).format(dateObj);
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  return formatDate(date, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format a date as relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;

  return formatDate(dateObj);
}
