"use server";

import { db } from "@/lib/db";
import {
  studentSubjectEnrollments,
  subjectOfferings,
  enrollments,
  strands,
  subjectStrands,
  subjects,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  generateStudentSubjectEnrollmentsSchema,
  changeStudentStrandSchema,
  withdrawFromSubjectSchema,
  type GenerateStudentSubjectEnrollmentsFormState,
  type ChangeStudentStrandFormState,
  type WithdrawFromSubjectFormState,
} from "./student-subject-enrollments.schema";
import { canChangeStrand } from "./student-subject-enrollments.queries";

/**
 * Generate student subject enrollments for an enrollment.
 * Creates enrollments for all applicable subject offerings (core + strand-matched).
 * Idempotent: skips offerings that already have enrollments.
 */
export async function generateStudentSubjectEnrollmentsAction(
  enrollmentId: string
): Promise<{ success: boolean; createdCount: number; skippedCount: number; error?: string }> {
  // Get enrollment details
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      sectionId: enrollments.sectionId,
      strandId: enrollments.strandId,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) {
    return { success: false, createdCount: 0, skippedCount: 0, error: "Enrollment not found" };
  }

  if (!enrollment.sectionId) {
    return { success: false, createdCount: 0, skippedCount: 0, error: "Enrollment has no section assigned" };
  }

  // Get all subject offerings for the section
  const offerings = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      strandId: subjectOfferings.strandId,
      isCore: subjects.isCore,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, enrollment.sectionId),
        eq(subjectOfferings.schoolYearId, enrollment.schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    );

  if (offerings.length === 0) {
    return { success: true, createdCount: 0, skippedCount: 0 };
  }

  // Get existing student subject enrollments
  const existingEnrollments = await db
    .select({ subjectOfferingId: studentSubjectEnrollments.subjectOfferingId })
    .from(studentSubjectEnrollments)
    .where(
      and(
        eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

  const existingOfferingIds = new Set(existingEnrollments.map((e) => e.subjectOfferingId));

  // Filter offerings: include core subjects and strand-matched electives
  const applicableOfferings = offerings.filter((offering) => {
    // Already enrolled
    if (existingOfferingIds.has(offering.id)) {
      return false;
    }

    // Core subjects are always included
    if (offering.isCore) {
      return true;
    }

    // For electives without strand requirement, include them
    if (!offering.strandId) {
      return true;
    }

    // For strand-specific electives, check if student's strand matches
    if (enrollment.strandId && offering.strandId === enrollment.strandId) {
      return true;
    }

    return false;
  });

  if (applicableOfferings.length === 0) {
    return {
      success: true,
      createdCount: 0,
      skippedCount: existingOfferingIds.size,
    };
  }

  // Create student subject enrollments
  const newEnrollments = applicableOfferings.map((offering) => ({
    enrollmentId,
    subjectOfferingId: offering.id,
    studentId: enrollment.studentId,
    schoolYearId: enrollment.schoolYearId,
    isActive: true,
  }));

  await db.insert(studentSubjectEnrollments).values(newEnrollments);

  return {
    success: true,
    createdCount: applicableOfferings.length,
    skippedCount: existingOfferingIds.size,
  };
}

/**
 * Change a student's strand (SHS only).
 * Only allowed if no grades have been entered.
 */
export async function changeStudentStrandAction(
  _prevState: ChangeStudentStrandFormState,
  formData: FormData
): Promise<ChangeStudentStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "student_subject_enrollments:manage")) {
    return { message: "You do not have permission to manage student enrollments." };
  }

  const parsed = changeStudentStrandSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    newStrandId: formData.get("newStrandId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { enrollmentId, newStrandId } = parsed.data;

  // Check if strand change is allowed
  const changeCheck = await canChangeStrand(enrollmentId);
  if (!changeCheck.canChange) {
    return { message: changeCheck.reason || "Cannot change strand." };
  }

  // Get enrollment details
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      sectionId: enrollments.sectionId,
      strandId: enrollments.strandId,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) {
    return { message: "Enrollment not found." };
  }

  // Get new strand info
  const [newStrand] = await db
    .select({ code: strands.code, name: strands.name })
    .from(strands)
    .where(eq(strands.id, newStrandId))
    .limit(1);

  if (!newStrand) {
    return { message: "Strand not found." };
  }

  // Start transaction
  await db.transaction(async (tx) => {
    // 1. Update enrollment strand
    await tx
      .update(enrollments)
      .set({
        strandId: newStrandId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(enrollments.id, enrollmentId));

    // 2. Get current strand-specific subject enrollments
    const currentSseRows = await tx
      .select({
        id: studentSubjectEnrollments.id,
        subjectOfferingId: studentSubjectEnrollments.subjectOfferingId,
      })
      .from(studentSubjectEnrollments)
      .innerJoin(
        subjectOfferings,
        eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferings.id)
      )
      .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
      .where(
        and(
          eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
          eq(subjects.isCore, false), // Only electives
          eq(studentSubjectEnrollments.isActive, true),
          isNull(studentSubjectEnrollments.deletedAt)
        )
      );

    // 3. Soft delete current strand-specific enrollments
    if (currentSseRows.length > 0) {
      const sseIds = currentSseRows.map((r) => r.id);
      await tx
        .update(studentSubjectEnrollments)
        .set({
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(inArray(studentSubjectEnrollments.id, sseIds));
    }

    // 4. Generate new subject enrollments for new strand
    // (This will be called separately via generateStudentSubjectEnrollmentsAction)
  });

  // Regenerate subject enrollments for new strand
  await generateStudentSubjectEnrollmentsAction(enrollmentId);

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "student_subject_enrollments:change_strand",
    targetEntity: "enrollments",
    targetId: enrollmentId,
    previousState: {
      strandId: changeCheck.currentStrandId,
      strandCode: changeCheck.currentStrandCode,
    },
    newState: {
      strandId: newStrandId,
      strandCode: newStrand.code,
    },
  });

  invalidateTag(CACHE_TAGS.STUDENT_SUBJECT_ENROLLMENTS);

  return { success: true };
}

/**
 * Withdraw a student from a subject.
 */
export async function withdrawFromSubjectAction(
  _prevState: WithdrawFromSubjectFormState,
  formData: FormData
): Promise<WithdrawFromSubjectFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "student_subject_enrollments:manage")) {
    return { message: "You do not have permission to manage student enrollments." };
  }

  const parsed = withdrawFromSubjectSchema.safeParse({
    studentSubjectEnrollmentId: formData.get("studentSubjectEnrollmentId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { studentSubjectEnrollmentId, reason } = parsed.data;

  // Get existing enrollment
  const [existing] = await db
    .select({
      id: studentSubjectEnrollments.id,
      enrollmentId: studentSubjectEnrollments.enrollmentId,
      subjectOfferingId: studentSubjectEnrollments.subjectOfferingId,
      isActive: studentSubjectEnrollments.isActive,
    })
    .from(studentSubjectEnrollments)
    .where(
      and(
        eq(studentSubjectEnrollments.id, studentSubjectEnrollmentId),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    )
    .limit(1);

  if (!existing) {
    return { message: "Subject enrollment not found." };
  }

  if (!existing.isActive) {
    return { message: "Subject enrollment is already inactive." };
  }

  // Mark as withdrawn
  await db
    .update(studentSubjectEnrollments)
    .set({
      isActive: false,
      withdrawnAt: new Date(),
      withdrawnBy: session.userId,
      withdrawalReason: reason,
      updatedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(studentSubjectEnrollments.id, studentSubjectEnrollmentId));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "student_subject_enrollments:withdraw",
    targetEntity: "student_subject_enrollments",
    targetId: studentSubjectEnrollmentId,
    newState: { reason },
  });

  invalidateTag(CACHE_TAGS.STUDENT_SUBJECT_ENROLLMENTS);

  return { success: true };
}
