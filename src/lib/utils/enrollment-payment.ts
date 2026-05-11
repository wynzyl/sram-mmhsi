const ENROLLMENT_STATUSES_THAT_ALLOW_PAYMENT = new Set<string>([
  "assessed",
  "enrolled",
]);

/**
 * Cashier eligibility: first payments while assessed; further payments toward balance while enrolled.
 * Pending and cancelled are blocked.
 */
export function assertEnrollmentAllowsPayment(
  enrollmentStatus: string | null | undefined,
  enrollmentId: string | null | undefined,
  assessmentEnrollmentId: string | null | undefined
): void {
  if (enrollmentId && assessmentEnrollmentId && enrollmentId !== assessmentEnrollmentId) {
    throw new Error("Assessment is not aligned with enrollment. Refuse posting.");
  }
  if (!enrollmentId) return;
  if (
    enrollmentStatus == null ||
    !ENROLLMENT_STATUSES_THAT_ALLOW_PAYMENT.has(enrollmentStatus)
  ) {
    throw new Error(
      "Payments may only be posted when the enrollment is assessed or enrolled (outstanding balance payments)."
    );
  }
}
