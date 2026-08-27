"use server";

/**
 * Archive Actions
 *
 * Server actions for archiving/unarchiving students and batch EOY operations.
 */

import { db } from "@/lib/db";
import {
  assessments,
  enrollments,
  students,
  studentClearances,
} from "@/lib/db/schema";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { logPermissionDenied } from "@/lib/errors/audit-failures";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { StudentStatus } from "@/lib/constants/student-status";
import {
  archiveStudentSchema,
  unarchiveStudentSchema,
  batchArchiveGraduatesSchema,
  batchCancelNoShowSchema,
  batchArchiveNonReturningSchema,
  type ArchiveStudentFormState,
  type UnarchiveStudentFormState,
  type BatchArchiveGraduatesFormState,
  type BatchCancelNoShowFormState,
  type BatchArchiveNonReturningFormState,
} from "./archive.schema";
import {
  getGraduationCandidates,
  getNoShowCandidates,
  getNonReturningStudents,
} from "./archive.queries";

// ─── Archive Student Action ─────────────────────────────────────────────────

export async function archiveStudentAction(
  _prevState: ArchiveStudentFormState,
  formData: FormData
): Promise<ArchiveStudentFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
    await logPermissionDenied(
      session,
      "archive:manage",
      "students",
      String(formData.get("studentId") ?? "")
    );
    return { message: "You do not have permission to archive students." };
  }

  // Validate input
  const parsed = archiveStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    status: formData.get("status"),
    archiveReason: formData.get("archiveReason"),
    schoolYearId: formData.get("schoolYearId") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { studentId, status, archiveReason, schoolYearId } = parsed.data;

  // Get current student state
  const [existingStudent] = await db
    .select({
      id: students.id,
      referenceNumber: students.referenceNumber,
      status: students.status,
      archivedAt: students.archivedAt,
    })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)));

  if (!existingStudent) {
    return { message: "Student not found." };
  }

  if (existingStudent.status !== "active") {
    return {
      message: `Student is already archived with status: ${existingStudent.status}.`,
    };
  }

  // Archive the student
  const now = new Date();
  await db
    .update(students)
    .set({
      status: status as StudentStatus,
      archivedAt: now,
      archivedBy: session.userId,
      archiveReason,
      archivedSchoolYearId: schoolYearId,
      updatedAt: now,
      updatedBy: session.userId,
    })
    .where(eq(students.id, studentId));

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "archive:archive_student",
    targetEntity: "students",
    targetId: studentId,
    previousState: {
      status: existingStudent.status,
    },
    newState: {
      status,
      archiveReason,
      schoolYearId,
    },
  });

  revalidatePath("/staff/students");
  revalidatePath("/staff/archive");

  return { success: true, studentId };
}

// ─── Unarchive Student Action ───────────────────────────────────────────────

export async function unarchiveStudentAction(
  _prevState: UnarchiveStudentFormState,
  formData: FormData
): Promise<UnarchiveStudentFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
    await logPermissionDenied(
      session,
      "archive:manage",
      "students",
      String(formData.get("studentId") ?? "")
    );
    return { message: "You do not have permission to unarchive students." };
  }

  // Validate input
  const parsed = unarchiveStudentSchema.safeParse({
    studentId: formData.get("studentId"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { studentId, remarks } = parsed.data;

  // Get current student state including archived school year
  const [existingStudent] = await db
    .select({
      id: students.id,
      referenceNumber: students.referenceNumber,
      status: students.status,
      archiveReason: students.archiveReason,
      archivedSchoolYearId: students.archivedSchoolYearId,
    })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)));

  if (!existingStudent) {
    return { message: "Student not found." };
  }

  if (existingStudent.status === "active") {
    return { message: "Student is not archived." };
  }

  const now = new Date();
  const isNoShowStudent = existingStudent.archiveReason?.toLowerCase().includes("no show");
  const { inArray } = await import("drizzle-orm");

  // Wrap all related writes in a single transaction so a failure mid-way (e.g.
  // enrollments restored but student not, or vice versa) rolls back entirely.
  await db.transaction(async (tx) => {
    // If this was a no-show student, restore their enrollment and assessment
    if (isNoShowStudent && existingStudent.archivedSchoolYearId) {
      // Find the most recent cancelled enrollment for this student in the archived school year.
      // Only ONE enrollment can be non-cancelled per student/school year (unique constraint),
      // so we restore only the most recent one to avoid constraint violations.
      const cancelledEnrollments = await tx
        .select({
          id: enrollments.id,
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.schoolYearId, existingStudent.archivedSchoolYearId),
            eq(enrollments.status, "cancelled")
          )
        )
        .orderBy(sql`${enrollments.updatedAt} DESC NULLS LAST`)
        .limit(1);

      if (cancelledEnrollments.length > 0) {
        const enrollmentIds = cancelledEnrollments.map((e) => e.id);

        // Find the cancelled assessments for these enrollments first. The no-show
        // batch cancels both "pending" (no assessment) and "assessed" enrollments,
        // so an enrollment's original lifecycle state is derived from whether it
        // has an assessment — restore "assessed" only for those that do, and
        // "pending" for the rest (avoid promoting pending enrollments).
        const cancelledAssessments = await tx
          .select({
            id: assessments.id,
            enrollmentId: assessments.enrollmentId,
          })
          .from(assessments)
          .where(
            and(
              eq(assessments.studentId, studentId),
              inArray(assessments.enrollmentId, enrollmentIds),
              eq(assessments.billingStatus, "cancelled")
            )
          );

        const assessedEnrollmentIds = [
          ...new Set(cancelledAssessments.map((a) => a.enrollmentId)),
        ];
        const pendingEnrollmentIds = enrollmentIds.filter(
          (id) => !assessedEnrollmentIds.includes(id)
        );

        // Restore enrollments that had an assessment to "assessed"
        if (assessedEnrollmentIds.length > 0) {
          await tx
            .update(enrollments)
            .set({
              status: "assessed",
              cancelledAt: sql`NULL::timestamp`,
              cancelledBy: sql`NULL::uuid`,
              cancelRemarks: sql`NULL::text`,
              updatedAt: now,
              updatedBy: session.userId,
            })
            .where(inArray(enrollments.id, assessedEnrollmentIds));
        }

        // Restore enrollments that never had an assessment to "pending"
        if (pendingEnrollmentIds.length > 0) {
          await tx
            .update(enrollments)
            .set({
              status: "pending",
              cancelledAt: sql`NULL::timestamp`,
              cancelledBy: sql`NULL::uuid`,
              cancelRemarks: sql`NULL::text`,
              updatedAt: now,
              updatedBy: session.userId,
            })
            .where(inArray(enrollments.id, pendingEnrollmentIds));
        }

        if (cancelledAssessments.length > 0) {
          const assessmentIds = cancelledAssessments.map((a) => a.id);

          // Restore assessments to "outstanding" status
          await tx
            .update(assessments)
            .set({
              billingStatus: "outstanding",
              cancelledAt: sql`NULL::timestamp`,
              cancelledBy: sql`NULL::uuid`,
              updatedAt: now,
              updatedBy: session.userId,
            })
            .where(inArray(assessments.id, assessmentIds));
        }
      }
    }

    // Unarchive the student
    await tx
      .update(students)
      .set({
        status: "active",
        archivedAt: sql`NULL::timestamp`,
        archivedBy: sql`NULL::uuid`,
        archiveReason: sql`NULL::text`,
        archivedSchoolYearId: sql`NULL::uuid`,
        updatedAt: now,
        updatedBy: session.userId,
      })
      .where(eq(students.id, studentId));
  });

  // Audit log
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "archive:unarchive_student",
    targetEntity: "students",
    targetId: studentId,
    previousState: {
      status: existingStudent.status,
      archiveReason: existingStudent.archiveReason,
    },
    newState: {
      status: "active",
      enrollmentRestored: isNoShowStudent,
      remarks,
    },
  });

  revalidatePath("/staff/students");
  revalidatePath("/staff/archive");
  revalidatePath("/staff/enrollments");

  return { success: true, studentId };
}

// ─── Batch Archive Graduates Action ─────────────────────────────────────────

export async function batchArchiveGraduatesAction(
  _prevState: BatchArchiveGraduatesFormState,
  formData: FormData
): Promise<BatchArchiveGraduatesFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
    await logPermissionDenied(
      session,
      "archive:manage",
      "students",
      `school_year:${String(formData.get("schoolYearId") ?? "")}`
    );
    return { message: "You do not have permission to batch archive students." };
  }

  // Validate input
  const parsed = batchArchiveGraduatesSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    gradeLevelId: formData.get("gradeLevelId") || undefined,
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { schoolYearId, gradeLevelId, remarks } = parsed.data;

  // Get graduation candidates
  const candidates = await getGraduationCandidates(schoolYearId, gradeLevelId);

  if (candidates.length === 0) {
    return {
      message: "No students found eligible for graduation archive.",
      archivedCount: 0,
      studentIds: [],
    };
  }

  const now = new Date();
  const studentIds = candidates.map((c) => c.studentId);
  const archiveReason = remarks || "Graduated - End of Year batch archive";
  const { inArray } = await import("drizzle-orm");

  // ─── Generate clearance records for each candidate ───────────────────────
  // Get existing clearances to avoid duplicates
  const existingClearances = await db
    .select({ studentId: studentClearances.studentId })
    .from(studentClearances)
    .where(
      and(
        inArray(studentClearances.studentId, studentIds),
        eq(studentClearances.schoolYearId, schoolYearId),
        eq(studentClearances.clearanceType, "graduation"),
        isNull(studentClearances.deletedAt)
      )
    );

  const studentsWithClearance = new Set(
    existingClearances.map((c) => c.studentId)
  );
  const studentsNeedingClearance = candidates.filter(
    (c) => !studentsWithClearance.has(c.studentId)
  );

  let clearancesGenerated = 0;
  let clearanceValues: Array<{
    studentId: string;
    enrollmentId: string;
    schoolYearId: string;
    clearanceType: "graduation";
    outstandingAmount: string;
    status: "cleared" | "pending";
    createdBy: string;
  }> = [];

  // Get enrollment IDs and balances for students needing clearance
  if (studentsNeedingClearance.length > 0) {
    const studentIdsNeedingClearance = studentsNeedingClearance.map(
      (c) => c.studentId
    );

    const enrollmentData = await db
      .select({
        enrollmentId: enrollments.id,
        studentId: enrollments.studentId,
        balance: assessments.balance,
      })
      .from(enrollments)
      .innerJoin(assessments, eq(assessments.enrollmentId, enrollments.id))
      .where(
        and(
          eq(enrollments.schoolYearId, schoolYearId),
          inArray(enrollments.studentId, studentIdsNeedingClearance),
          isNull(assessments.cancelledAt)
        )
      );

    // Generate clearance for each student
    clearanceValues = enrollmentData.map((enrollment) => {
      const balance = Number(enrollment.balance);
      const clearanceStatus = balance <= 0 ? "cleared" : "pending";

      return {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.enrollmentId,
        schoolYearId,
        clearanceType: "graduation" as const,
        outstandingAmount: enrollment.balance,
        status: clearanceStatus as "cleared" | "pending",
        createdBy: session.userId,
      };
    });
  }
  // ─── END: Clearance generation ───────────────────────────────────────────

  // Wrap clearance creation + student archive in a single transaction so a
  // failure cannot leave clearances inserted without the students archived
  // (or vice versa).
  await db.transaction(async (tx) => {
    if (clearanceValues.length > 0) {
      await tx.insert(studentClearances).values(clearanceValues);
      clearancesGenerated = clearanceValues.length;
    }

    // Archive all candidates
    await tx
      .update(students)
      .set({
        status: "graduated" as StudentStatus,
        archivedAt: now,
        archivedBy: session.userId,
        archiveReason,
        archivedSchoolYearId: schoolYearId,
        updatedAt: now,
        updatedBy: session.userId,
      })
      .where(
        and(eq(students.status, "active"), inArray(students.id, studentIds))
      );
  });

  // Audit log (batch operation)
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "archive:batch_graduate",
    targetEntity: "students",
    targetId: `batch:${studentIds.length}`,
    newState: {
      schoolYearId,
      gradeLevelId,
      count: studentIds.length,
      clearancesGenerated,
      studentIds: studentIds.slice(0, 10), // Log first 10 for reference
    },
  });

  revalidatePath("/staff/students");
  revalidatePath("/staff/archive");
  revalidatePath("/staff/approvals"); // Revalidate clearances page

  return {
    success: true,
    archivedCount: studentIds.length,
    studentIds,
  };
}

// ─── Batch Cancel No-Show Action ────────────────────────────────────────────

export async function batchCancelNoShowAction(
  _prevState: BatchCancelNoShowFormState,
  formData: FormData
): Promise<BatchCancelNoShowFormState> {
  const session = await requireStaffSession();

  // Permission check - this flow both cancels enrollments AND archives the
  // students, so it requires both privileges (archive:manage gates the archive
  // state change, consistent with the other archive actions in this file).
  if (
    !hasPermission(session.role, "enrollments:cancel") ||
    !hasPermission(session.role, "archive:manage")
  ) {
    await logPermissionDenied(
      session,
      "enrollments:cancel+archive:manage",
      "enrollments",
      `school_year:${String(formData.get("schoolYearId") ?? "")}`
    );
    return {
      message: "You do not have permission to batch cancel enrollments.",
    };
  }

  // Validate input
  const parsed = batchCancelNoShowSchema.safeParse({
    schoolYearId: formData.get("schoolYearId"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { schoolYearId, remarks } = parsed.data;

  // Get no-show candidates (pending or assessed but never paid)
  const candidates = await getNoShowCandidates(schoolYearId);

  if (candidates.length === 0) {
    return {
      message: "No 'no-show' enrollments found (pending or assessed but never paid).",
      cancelledCount: 0,
      enrollmentIds: [],
    };
  }

  const now = new Date();
  const enrollmentIds = candidates.map((c) => c.enrollmentId);
  // Filter out null assessmentIds (pending enrollments have no assessment)
  const assessmentIds = candidates
    .map((c) => c.assessmentId)
    .filter((id): id is string => id !== null);
  const cancelRemarks =
    remarks || "No show - EOY batch cancellation (pending or assessed but never paid)";

  // Use inArray for proper batch update
  const { inArray } = await import("drizzle-orm");
  const studentIds = [...new Set(candidates.map((c) => c.studentId))];

  // Wrap enrollment cancel + assessment cancel + student archive in a single
  // transaction so a partial failure cannot leave enrollments cancelled while
  // the students remain active (or any other inconsistent combination).
  await db.transaction(async (tx) => {
    // Cancel enrollments
    await tx
      .update(enrollments)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: session.userId,
        cancelRemarks,
        updatedAt: now,
        updatedBy: session.userId,
      })
      .where(inArray(enrollments.id, enrollmentIds));

    // Cancel assessments (only if there are any)
    if (assessmentIds.length > 0) {
      await tx
        .update(assessments)
        .set({
          billingStatus: "cancelled",
          cancelledAt: now,
          cancelledBy: session.userId,
          updatedAt: now,
          updatedBy: session.userId,
        })
        .where(inArray(assessments.id, assessmentIds));
    }

    // Archive the students as "cancelled"
    await tx
      .update(students)
      .set({
        status: "cancelled" as StudentStatus,
        archivedAt: now,
        archivedBy: session.userId,
        archiveReason: "No show - pending or assessed but never paid",
        archivedSchoolYearId: schoolYearId,
        updatedAt: now,
        updatedBy: session.userId,
      })
      .where(
        and(eq(students.status, "active"), inArray(students.id, studentIds))
      );
  });

  // Count pending vs assessed for audit
  const pendingCount = candidates.filter((c) => c.enrollmentStatus === "pending").length;
  const assessedCount = candidates.filter((c) => c.enrollmentStatus === "assessed").length;

  // Audit log (batch operation)
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "archive:batch_no_show",
    targetEntity: "enrollments",
    targetId: `batch:${enrollmentIds.length}`,
    newState: {
      schoolYearId,
      enrollmentCount: enrollmentIds.length,
      pendingCount,
      assessedCount,
      studentCount: studentIds.length,
      enrollmentIds: enrollmentIds.slice(0, 10),
    },
  });

  revalidatePath("/staff/students");
  revalidatePath("/staff/enrollments");
  revalidatePath("/staff/archive");

  return {
    success: true,
    cancelledCount: enrollmentIds.length,
    enrollmentIds,
  };
}

// ─── Batch Archive Non-Returning Students Action ────────────────────────────

export async function batchArchiveNonReturningAction(
  _prevState: BatchArchiveNonReturningFormState,
  formData: FormData
): Promise<BatchArchiveNonReturningFormState> {
  const session = await requireStaffSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
    await logPermissionDenied(
      session,
      "archive:manage",
      "students",
      `school_year:${String(formData.get("previousSchoolYearId") ?? "")}`
    );
    return {
      message: "You do not have permission to batch archive students.",
    };
  }

  // Validate input
  const parsed = batchArchiveNonReturningSchema.safeParse({
    previousSchoolYearId: formData.get("previousSchoolYearId"),
    currentSchoolYearId: formData.get("currentSchoolYearId"),
    status: formData.get("status"),
    remarks: formData.get("remarks") || undefined,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { previousSchoolYearId, currentSchoolYearId, status, remarks } =
    parsed.data;

  // Get non-returning students
  const candidates = await getNonReturningStudents(
    previousSchoolYearId,
    currentSchoolYearId
  );

  if (candidates.length === 0) {
    return {
      message:
        "No non-returning students found (all students from the previous year are enrolled in the current year).",
      archivedCount: 0,
      studentIds: [],
    };
  }

  const now = new Date();
  const studentIds = candidates.map((c) => c.studentId);
  const archiveReason =
    remarks ||
    `Non-returning student - EOY batch archive (was enrolled in previous year but not in current year)`;

  // Use inArray for proper batch update
  const { inArray } = await import("drizzle-orm");

  // Archive all non-returning students with the selected status
  await db
    .update(students)
    .set({
      status: status as StudentStatus,
      archivedAt: now,
      archivedBy: session.userId,
      archiveReason,
      archivedSchoolYearId: previousSchoolYearId,
      updatedAt: now,
      updatedBy: session.userId,
    })
    .where(
      and(eq(students.status, "active"), inArray(students.id, studentIds))
    );

  // Audit log (batch operation)
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "archive:batch_non_returning",
    targetEntity: "students",
    targetId: `batch:${studentIds.length}`,
    newState: {
      previousSchoolYearId,
      currentSchoolYearId,
      status,
      count: studentIds.length,
      studentIds: studentIds.slice(0, 10), // Log first 10 for reference
    },
  });

  revalidatePath("/staff/students");
  revalidatePath("/staff/archive");

  return {
    success: true,
    archivedCount: studentIds.length,
    studentIds,
  };
}
