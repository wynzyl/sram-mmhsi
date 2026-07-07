/**
 * Archive Guards
 *
 * Guard functions to enforce transaction rules for archived students.
 *
 * **Transaction Rules for Archived Students (status !== active):**
 * - ALLOWED: Payments (settle balances), Document Requests, Grade Encoding
 * - BLOCKED: Void OR, Cancel Enrollment, Cancel Assessment, Re-enroll, Re-assess
 */

import { db } from "@/lib/db";
import { students } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { isArchivedStatus, type StudentStatus } from "@/lib/constants/student-status";

export type ArchiveBlockedAction =
  | "void_or"
  | "cancel_enrollment"
  | "cancel_assessment"
  | "re_enroll"
  | "re_assess"
  | "create_enrollment"
  | "create_assessment"
  | "edit_profile";

export const ARCHIVE_BLOCKED_ACTION_LABELS: Record<ArchiveBlockedAction, string> = {
  void_or: "Void Official Receipt",
  cancel_enrollment: "Cancel Enrollment",
  cancel_assessment: "Cancel Assessment",
  re_enroll: "Re-enroll Student",
  re_assess: "Re-assess Student",
  create_enrollment: "Create Enrollment",
  create_assessment: "Create Assessment",
  edit_profile: "Edit Student Profile",
};

export class StudentArchivedException extends Error {
  public readonly code = "STUDENT_ARCHIVED";
  public readonly studentId: string;
  public readonly studentStatus: StudentStatus;
  public readonly blockedAction: ArchiveBlockedAction;

  constructor(
    studentId: string,
    studentStatus: StudentStatus,
    blockedAction: ArchiveBlockedAction
  ) {
    const actionLabel = ARCHIVE_BLOCKED_ACTION_LABELS[blockedAction];
    super(
      `Cannot ${actionLabel}: Student is archived (status: ${studentStatus})`
    );
    this.name = "StudentArchivedException";
    this.studentId = studentId;
    this.studentStatus = studentStatus;
    this.blockedAction = blockedAction;
  }
}

/**
 * Minimal executor type that works with both the module-level `db` and a
 * transaction handle (`tx`), so the guard can run inside the caller's
 * transaction/lock scope instead of escaping it on a separate connection.
 */
type GuardExecutor = Pick<typeof db, "select">;

/**
 * Get a student's current status.
 *
 * @param studentId - The student ID to check
 * @param executor - Optional transaction handle; defaults to the module-level
 *   `db`. Pass the caller's `tx` so the read participates in the same
 *   transaction (and sees its row locks), preventing a race with a concurrent
 *   archive.
 */
export async function getStudentStatus(
  studentId: string,
  executor: GuardExecutor = db,
  forUpdate = false
): Promise<StudentStatus | null> {
  const query = executor
    .select({ status: students.status })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)))
    .limit(1);

  // Acquire a row lock so a concurrent archive UPDATE cannot commit between
  // this check and the caller's later mutation (TOCTOU). Requires running
  // inside a transaction; a plain read participates in the tx but does not
  // block writers.
  const [student] = await (forUpdate ? query.for("update") : query);

  return student?.status ?? null;
}

/**
 * Assert that a student is mutable (not archived).
 * Throws StudentArchivedException if the student is archived.
 *
 * @param studentId - The student ID to check
 * @param action - The action being attempted (for error messaging)
 * @param executor - Optional transaction handle; pass the caller's `tx` so the
 *   archive check runs inside the same transaction/lock scope as the mutation.
 * @param forUpdate - When true, locks the student row (`SELECT ... FOR UPDATE`)
 *   so it cannot be archived between this check and the caller's later mutation.
 *   Only meaningful when `executor` is a transaction handle.
 * @throws StudentArchivedException if student is archived
 */
export async function assertStudentMutable(
  studentId: string,
  action: ArchiveBlockedAction,
  executor: GuardExecutor = db,
  forUpdate = false
): Promise<void> {
  const status = await getStudentStatus(studentId, executor, forUpdate);

  if (status === null) {
    // Student not found - let the calling action handle this
    return;
  }

  if (isArchivedStatus(status)) {
    throw new StudentArchivedException(studentId, status, action);
  }
}

/**
 * Check if a student is archived without throwing
 *
 * @param studentId - The student ID to check
 * @returns true if student is archived, false otherwise
 */
export async function isStudentArchived(studentId: string): Promise<boolean> {
  const status = await getStudentStatus(studentId);
  return status !== null && isArchivedStatus(status);
}

/**
 * Format an archive error for use in action return values
 */
export function formatArchiveError(error: StudentArchivedException): {
  ok: false;
  error: {
    code: string;
    message: string;
  };
} {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };
}
