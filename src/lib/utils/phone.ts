/**
 * Phone number formatting utilities for Philippine mobile numbers.
 * Format: 0917-010-0098 (4-3-4 hyphen-separated digits)
 */

/**
 * Formats a Philippine mobile number as 0917-010-0098
 * @param phone - Raw phone number (09XXXXXXXXX or +639XXXXXXXXX)
 * @returns Formatted string or original if invalid
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";

  // Normalize: remove all non-digits
  let digits = phone.replace(/\D/g, "");

  // Handle +63 prefix (convert to 0)
  if (digits.startsWith("63") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  }

  // Validate: must be 11 digits starting with 09
  if (digits.length !== 11 || !digits.startsWith("09")) {
    return phone; // Return original if invalid
  }

  // Format: 0917-010-0098
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
}

/**
 * Strips formatting from phone number (for storage)
 * @param phone - Formatted or raw phone number
 * @returns Plain digits only
 */
export function stripPhoneFormat(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Formats phone input as user types (for controlled input)
 * @param value - Current input value
 * @returns Formatted value with cursor-friendly behavior
 */
export function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
}
