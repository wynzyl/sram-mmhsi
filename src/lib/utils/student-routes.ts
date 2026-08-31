/**
 * Student URL route utilities.
 *
 * Centralizes student detail page URL generation to make it easy
 * to change the URL structure in one place.
 *
 * Student routes use `referenceNumber` (7-digit) as the URL slug
 * instead of UUID for human-readable, shareable URLs.
 */

export type StudentRouteBasePath = "/staff/students" | "/admin/students";

/**
 * Generates the URL for a student's detail page.
 *
 * @param student - Object containing the student's referenceNumber
 * @param basePath - Base path for student routes (defaults to /staff/students)
 * @returns The full URL path for the student detail page
 *
 * @example
 * studentDetailUrl({ referenceNumber: "0000001" })
 * // => "/staff/students/0000001"
 */
export function studentDetailUrl(
  student: { referenceNumber: string },
  basePath: StudentRouteBasePath = "/staff/students"
): string {
  return `${basePath}/${student.referenceNumber}`;
}

/**
 * Generates the URL for a student's edit page.
 *
 * @param student - Object containing the student's referenceNumber
 * @param basePath - Base path for student routes (defaults to /staff/students)
 * @returns The full URL path for the student edit page
 *
 * @example
 * studentEditUrl({ referenceNumber: "0000001" })
 * // => "/staff/students/0000001/edit"
 */
export function studentEditUrl(
  student: { referenceNumber: string },
  basePath: StudentRouteBasePath = "/staff/students"
): string {
  return `${basePath}/${student.referenceNumber}/edit`;
}

/**
 * Type guard to check if a string is a valid student reference number format.
 * Reference numbers are 7-digit zero-padded strings (e.g., "0000001").
 */
export function isValidStudentRef(value: string): boolean {
  return /^\d{7}$/.test(value);
}
