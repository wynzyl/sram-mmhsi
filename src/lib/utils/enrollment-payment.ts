import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { enrollments } from "@/lib/db/schema";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "@/lib/db/schema";

type DatabaseTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

const ENROLLMENT_STATUSES_THAT_ALLOW_PAYMENT = new Set<string>([
  "assessed",
  "enrolled",
  "cancelled", // Allow payments to settle outstanding balances after cancellation
]);

/**
 * Cashier eligibility: first payments while assessed; further payments toward balance
 * while enrolled; settlement of outstanding balances after cancellation.
 * Only pending status is blocked.
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
      "Payments may only be posted when the enrollment is assessed, enrolled, or cancelled (outstanding balance settlement)."
    );
  }
}

/**
 * Checks if student has an active enrollment (assessed or enrolled) for the same school year.
 * Used to block payments on cancelled enrollments when an active one exists —
 * the payment should be posted to the active enrollment instead.
 *
 * @param dbOrTx - Database connection or transaction
 */
export async function hasActiveEnrollmentForSchoolYear(
  dbOrTx: DatabaseTransaction | { query: DatabaseTransaction["query"] },
  studentId: string,
  schoolYearId: string,
  excludeEnrollmentId?: string
): Promise<boolean> {
  const activeEnrollment = await dbOrTx.query.enrollments.findFirst({
    where: and(
      eq(enrollments.studentId, studentId),
      eq(enrollments.schoolYearId, schoolYearId),
      inArray(enrollments.status, ["assessed", "enrolled"]),
      excludeEnrollmentId ? ne(enrollments.id, excludeEnrollmentId) : undefined
    ),
    columns: { id: true },
  });
  return activeEnrollment != null;
}
