/**
 * Enrollment status transition utilities.
 *
 * These utilities encapsulate the business logic for enrollment status transitions
 * that occur as side effects of payment operations:
 * - assessed → enrolled (on first payment)
 * - enrolled → assessed (when all payments are reversed)
 */

import { eq } from "drizzle-orm";
import { enrollments } from "@/lib/db/schema";
import { logAudit } from "@/lib/utils/audit-logger";
import { lockEnrollment, type DbExecutor } from "./tx-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EnrollmentTransitionContext {
  /** Transaction executor (from db.transaction callback) */
  tx: DbExecutor & {
    update: typeof import("@/lib/db").db.update;
  };
  /** Enrollment ID to transition */
  enrollmentId: string;
  /** User ID performing the action */
  userId: string;
  /** User role at time of action */
  userRole: string;
}

// ─── Status Transition Functions ──────────────────────────────────────────────

/**
 * Transition enrollment from "assessed" to "enrolled" when first payment is made.
 *
 * This is a side effect of payment posting - when a student makes their first
 * payment on an assessed enrollment, the enrollment status transitions to "enrolled".
 *
 * @param ctx - Transaction context with enrollment details
 * @param auditContext - Optional context message for audit log (e.g., "Payment posted: OR AP-00001")
 * @returns true if transition occurred, false if already enrolled or no action needed
 *
 * @example
 * ```typescript
 * if (assessment.enrollmentId) {
 *   await transitionToEnrolledOnPayment({
 *     tx,
 *     enrollmentId: assessment.enrollmentId,
 *     userId: session.userId,
 *     userRole: session.role,
 *   }, `Payment posted: OR ${orNumberToAssign}`);
 * }
 * ```
 */
export async function transitionToEnrolledOnPayment(
  ctx: EnrollmentTransitionContext,
  auditContext?: string
): Promise<boolean> {
  const { tx, enrollmentId, userId, userRole } = ctx;

  // Lock and fetch the enrollment
  const enrollment = await lockEnrollment(tx, enrollmentId);

  // Only transition if currently "assessed"
  if (!enrollment || enrollment.status !== "assessed") {
    return false;
  }

  // Update status to "enrolled"
  await tx
    .update(enrollments)
    .set({
      status: "enrolled",
      enrolledAt: new Date(),
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));

  // Audit the transition
  await logAudit(
    {
      actor: userId,
      actorRole: userRole,
      action: "enrollment_enrolled_via_payment",
      targetEntity: "enrollments",
      targetId: enrollmentId,
      context: auditContext,
      previousState: { status: "assessed" },
      newState: { status: "enrolled" },
    },
    { throwOnFail: true }
  );

  return true;
}

/**
 * Revert enrollment from "enrolled" to "assessed" when all payments are reversed.
 *
 * This is a side effect of payment voiding/reversal - when a student's total paid
 * amount drops to zero (all payments voided), the enrollment reverts to "assessed".
 *
 * @param ctx - Transaction context with enrollment details
 * @param auditContext - Optional context message for audit log (e.g., "Total paid reverted to zero after void")
 * @returns true if transition occurred, false if not enrolled or no action needed
 *
 * @example
 * ```typescript
 * if (newTotalPaid <= EPSILON && assessment.enrollmentId) {
 *   await revertToAssessedOnVoid({
 *     tx,
 *     enrollmentId: assessment.enrollmentId,
 *     userId: session.userId,
 *     userRole: session.role,
 *   }, `Total paid reverted to zero after voiding payment`);
 * }
 * ```
 */
export async function revertToAssessedOnVoid(
  ctx: EnrollmentTransitionContext,
  auditContext?: string
): Promise<boolean> {
  const { tx, enrollmentId, userId, userRole } = ctx;

  // Lock and fetch the enrollment
  const enrollment = await lockEnrollment(tx, enrollmentId);

  // Only revert if currently "enrolled"
  if (!enrollment || enrollment.status !== "enrolled") {
    return false;
  }

  // Update status to "assessed"
  await tx
    .update(enrollments)
    .set({
      status: "assessed",
      enrolledAt: null,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(enrollments.id, enrollmentId));

  // Audit the transition
  await logAudit(
    {
      actor: userId,
      actorRole: userRole,
      action: "enrollment_reverted_via_void",
      targetEntity: "enrollments",
      targetId: enrollmentId,
      context: auditContext,
      previousState: { status: "enrolled" },
      newState: { status: "assessed" },
    },
    { throwOnFail: true }
  );

  return true;
}
