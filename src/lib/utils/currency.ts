/**
 * Currency formatting utilities for Philippine Peso (PHP).
 * Centralizes all currency operations for consistency.
 */

export const CURRENCY_LOCALE = "en-PH";
export const CURRENCY_CODE = "PHP";

/**
 * Formats a number or string as Philippine Peso currency.
 *
 * @param amount - Amount to format (number or numeric string)
 * @returns Formatted currency string (e.g., "₱1,500.00")
 *
 * @example
 * ```typescript
 * formatCurrency(1500)        // "₱1,500.00"
 * formatCurrency("2500.50")   // "₱2,500.50"
 * formatCurrency(0)           // "₱0.00"
 * ```
 */
export function formatCurrency(amount: number | string): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) {
    return "₱0.00";
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
  }).format(numericAmount);
}

/**
 * Parses a formatted currency string back to a number.
 * Removes currency symbols, commas, and other formatting.
 *
 * @param formatted - Formatted currency string
 * @returns Numeric amount
 *
 * @example
 * ```typescript
 * parseCurrency("₱1,500.00")   // 1500
 * parseCurrency("1,500")       // 1500
 * parseCurrency("1500.50")     // 1500.50
 * ```
 */
export function parseCurrency(formatted: string): number {
  // Remove currency symbol, commas, spaces
  const cleaned = formatted.replace(/[₱,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formats amount as compact currency (shorthand for large amounts).
 *
 * @param amount - Amount to format
 * @returns Compact formatted string (e.g., "₱1.5K", "₱2.3M")
 *
 * @example
 * ```typescript
 * formatCurrencyCompact(1500)      // "₱1.5K"
 * formatCurrencyCompact(2500000)   // "₱2.5M"
 * ```
 */
export function formatCurrencyCompact(amount: number | string): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  if (isNaN(numericAmount)) {
    return "₱0";
  }

  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency: CURRENCY_CODE,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numericAmount);
}

/**
 * Validates if a string is a valid currency amount.
 *
 * @param value - Value to validate
 * @returns True if valid currency format
 *
 * @example
 * ```typescript
 * isValidCurrency("1500.00")   // true
 * isValidCurrency("₱1,500")    // true
 * isValidCurrency("abc")       // false
 * isValidCurrency("-100")      // false (negative)
 * ```
 */
export function isValidCurrency(value: string): boolean {
  const sanitized = value.replace(/[₱,\s]/g, "").trim();
  if (!sanitized) return false;
  if (!/^\d+(\.\d+)?$/.test(sanitized)) return false;

  const parsed = parseCurrency(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

/**
 * Rounds a number to two decimal places (for currency calculations).
 * Uses standard rounding (half up).
 *
 * @param amount - Amount to round
 * @returns Number rounded to 2 decimal places
 *
 * @example
 * ```typescript
 * roundToTwoDecimals(10.555)   // 10.56
 * roundToTwoDecimals(10.554)   // 10.55
 * roundToTwoDecimals(100)      // 100
 * ```
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Formats a number as a string with exactly 2 decimal places.
 * Use for form inputs that display currency amounts.
 *
 * @param amount - Amount to format
 * @returns String with exactly 2 decimal places (e.g., "1500.00")
 *
 * @example
 * ```typescript
 * formatDecimal(1500)      // "1500.00"
 * formatDecimal(1500.5)    // "1500.50"
 * formatDecimal(1500.555)  // "1500.56"
 * ```
 */
export function formatDecimal(amount: number): string {
  return roundToTwoDecimals(amount).toFixed(2);
}
