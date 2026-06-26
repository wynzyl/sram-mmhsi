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
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { and, eq, isNull } from "drizzle-orm";
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
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
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
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
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

  // If this was a no-show student, restore their enrollment and assessment
  if (isNoShowStudent && existingStudent.archivedSchoolYearId) {
    const { inArray } = await import("drizzle-orm");

    // Find cancelled enrollments for this student in the archived school year
    const cancelledEnrollments = await db
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
      );

    if (cancelledEnrollments.length > 0) {
      const enrollmentIds = cancelledEnrollments.map((e) => e.id);

      // Restore enrollments to "assessed" status
      await db
        .update(enrollments)
        .set({
          status: "assessed",
          cancelledAt: null,
          cancelledBy: null,
          cancelRemarks: null,
          updatedAt: now,
          updatedBy: session.userId,
        })
        .where(inArray(enrollments.id, enrollmentIds));

      // Find and restore cancelled assessments for these enrollments
      const cancelledAssessments = await db
        .select({
          id: assessments.id,
        })
        .from(assessments)
        .where(
          and(
            eq(assessments.studentId, studentId),
            inArray(assessments.enrollmentId, enrollmentIds),
            eq(assessments.billingStatus, "cancelled")
          )
        );

      if (cancelledAssessments.length > 0) {
        const assessmentIds = cancelledAssessments.map((a) => a.id);

        // Restore assessments to "outstanding" status
        await db
          .update(assessments)
          .set({
            billingStatus: "outstanding",
            cancelledAt: null,
            cancelledBy: null,
            updatedAt: now,
            updatedBy: session.userId,
          })
          .where(inArray(assessments.id, assessmentIds));
      }
    }
  }

  // Unarchive the student
  await db
    .update(students)
    .set({
      status: "active",
      archivedAt: null,
      archivedBy: null,
      archiveReason: null,
      archivedSchoolYearId: null,
      updatedAt: now,
      updatedBy: session.userId,
    })
    .where(eq(students.id, studentId));

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
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
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
    const clearanceValues = enrollmentData.map((enrollment) => {
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

    if (clearanceValues.length > 0) {
      await db.insert(studentClearances).values(clearanceValues);
      clearancesGenerated = clearanceValues.length;
    }
  }
  // ─── END: Clearance generation ───────────────────────────────────────────

  // Archive all candidates
  await db
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
  const session = await requireSession();

  // Permission check - requires admin level
  if (!hasPermission(session.role, "enrollments:cancel")) {
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

  // Cancel enrollments
  await db
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
    await db
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
  const studentIds = [...new Set(candidates.map((c) => c.studentId))];
  await db
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
  const session = await requireSession();

  // Permission check
  if (!hasPermission(session.role, "archive:manage")) {
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
