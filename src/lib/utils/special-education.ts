/**
 * Special Education (SPED) utilities
 *
 * Handles SPED status determination with student-level defaults
 * and per-enrollment overrides.
 */

/** Default amount for Special Education Fee (in PHP) */
export const SPED_FEE_DEFAULT_AMOUNT = 30000;

/** Fee item type code for SPED fee */
export const SPED_FEE_CODE = "SPED_FEE";

/**
 * Determine effective SPED status for an enrollment.
 *
 * The enrollment can override the student's default SPED status:
 * - If specialEducationOverride is null, inherit from student.isSpecialEducation
 * - If specialEducationOverride is true/false, use that value
 *
 * @param student - Student record with isSpecialEducation flag
 * @param enrollment - Enrollment record with optional specialEducationOverride
 * @returns true if the student is effectively SPED for this enrollment
 */
export function isEffectivelySpecialEducation(
  student: { isSpecialEducation: boolean },
  enrollment: { specialEducationOverride: boolean | null }
): boolean {
  if (enrollment.specialEducationOverride !== null) {
    return enrollment.specialEducationOverride;
  }
  return student.isSpecialEducation;
}
