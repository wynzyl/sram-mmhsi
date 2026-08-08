/**
 * Type-safe helpers for grade state map keys.
 *
 * The grade entry components use a Map<string, string> to track grade values,
 * keyed by a combination of studentId and subjectId. These helpers ensure
 * consistent key generation and parsing across all grade entry components.
 */

/**
 * Branded type for grade map keys.
 * Format: `${studentId}:${subjectId}`
 */
export type GradeKey = `${string}:${string}`;

/**
 * Create a grade map key from student and subject IDs.
 *
 * @param studentId - The student's UUID
 * @param subjectId - The subject's UUID
 * @returns A type-safe key for the grades Map
 *
 * @example
 * const key = gradeKey("student-123", "subject-456");
 * // Returns: "student-123:subject-456"
 */
export function gradeKey(studentId: string, subjectId: string): GradeKey {
  return `${studentId}:${subjectId}`;
}

/**
 * Parse a grade map key back into its component IDs.
 *
 * @param key - The grade key to parse
 * @returns An object with studentId and subjectId
 *
 * @example
 * const { studentId, subjectId } = parseGradeKey("student-123:subject-456");
 * // studentId: "student-123", subjectId: "subject-456"
 */
export function parseGradeKey(key: GradeKey): {
  studentId: string;
  subjectId: string;
} {
  const [studentId, subjectId] = key.split(":");
  return { studentId, subjectId };
}
