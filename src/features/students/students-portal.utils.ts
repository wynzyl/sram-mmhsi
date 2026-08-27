/**
 * Portal account utilities for student self-service access.
 *
 * Password format: Date of birth in YYYYMMDD format (e.g., "20100315")
 * Fallback: {referenceNumber}{year} if DOB not available (e.g., "00001232026")
 */

/**
 * Generate portal password from date of birth.
 * Format: YYYYMMDD (e.g., "20100315" for March 15, 2010)
 *
 * @param dateOfBirth - Student's date of birth
 * @param referenceNumber - Student reference number (fallback if DOB not available)
 * @returns Password string
 */
export function generatePortalPassword(
  dateOfBirth: Date | null | undefined,
  referenceNumber: string
): string {
  if (dateOfBirth) {
    return formatDateAsPassword(dateOfBirth);
  }
  // Fallback: {ref}{year} (e.g., "00001232026")
  return `${referenceNumber}${new Date().getFullYear()}`;
}

/**
 * Format a date as YYYYMMDD password string.
 *
 * @param date - Date to format
 * @returns Password in YYYYMMDD format
 */
export function formatDateAsPassword(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

/**
 * Validate that a string matches the YYYYMMDD date format.
 * Used for password validation during login.
 *
 * @param password - Password to validate
 * @returns true if password matches YYYYMMDD format
 */
export function isValidDatePassword(password: string): boolean {
  if (password.length !== 8) return false;
  if (!/^\d{8}$/.test(password)) return false;

  const year = parseInt(password.slice(0, 4), 10);
  const month = parseInt(password.slice(4, 6), 10);
  const day = parseInt(password.slice(6, 8), 10);

  // Basic validation
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}

/**
 * Check if a username looks like a student reference number.
 * Student references are 7 digits (e.g., "0000001").
 *
 * Used to detect portal login attempts vs staff login attempts.
 *
 * @param username - Username to check
 * @returns true if username matches student reference pattern
 */
export function isStudentReferenceNumber(username: string): boolean {
  return /^\d{7}$/.test(username);
}
