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
import { uuidSchema } from "@/lib/validators/common-schemas";
import {
  generateStudentSubjectEnrollmentsSchema,
  changeStudentStrandSchema,
  withdrawFromSubjectSchema,
  bulkAssignStrandSchema,
  manualEnrollSubjectSchema,
  type GenerateStudentSubjectEnrollmentsFormState,
  type ChangeStudentStrandFormState,
  type WithdrawFromSubjectFormState,
  type BulkAssignStrandFormState,
  type ManualEnrollSubjectFormState,
} from "./student-subject-enrollments.schema";
import { canChangeStrand } from "./student-subject-enrollments.queries";
import type { CanChangeStrandResult } from "./student-subject-enrollments.schema";

/**
 * Build the "not eligible" result shape without hitting the database.
 * Not exported — every export of a "use server" module becomes an endpoint.
 */
function ineligibleToChangeStrand(reason: string): CanChangeStrandResult {
  return {
    canChange: false,
    reason,
    gradeCount: 0,
    currentStrandId: null,
    currentStrandCode: null,
    currentStrandName: null,
  };
}

/**
 * Server action wrapper for canChangeStrand.
 * Used by client components that need to check strand change eligibility.
 */
export async function canChangeStrandAction(
  enrollmentId: string
): Promise<CanChangeStrandResult> {
  const session = await requireSession();

  if (!hasPermission(session.role, "student_subject_enrollments:manage")) {
    return ineligibleToChangeStrand(
      "You do not have permission to manage student enrollments."
    );
  }

  // enrollmentId arrives straight from the client. canChangeStrand compares it
  // against a uuid column, so a malformed value would surface as a Postgres
  // 22P02 error rather than a handled result.
  const parsed = uuidSchema.safeParse(enrollmentId);
  if (!parsed.success) {
    return ineligibleToChangeStrand("Invalid enrollment reference.");
  }

  return canChangeStrand(parsed.data);
}

/**
 * Generate student subject enrollments for an enrollment.
 * Creates enrollments for all applicable subject offerings (core + strand-matched).
 * Idempotent: skips offerings that already have enrollments.
 */
export async function generateStudentSubjectEnrollmentsAction(
  enrollmentId: string
): Promise<{ success: boolean; createdCount: number; skippedCount: number; error?: string }> {
  const session = await requireSession();

  // Two already-authorized flows reach this write: direct SSE management, and
  // section assignment (assignStudentsToSectionAction guards on "sections:assign"
  // and generates SSE records as a side effect). Coordinator and principal hold
  // "sections:assign" but NOT "student_subject_enrollments:manage", so checking
  // only the latter would make section assignment silently produce students with
  // no subject enrollments — the caller discards this return value. Accepting
  // either permission grants no new capability; it names the one those roles
  // already exercise through that flow.
  const authorized =
    hasPermission(session.role, "student_subject_enrollments:manage") ||
    hasPermission(session.role, "sections:assign");

  if (!authorized) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      error: "You do not have permission to manage student enrollments.",
    };
  }

  // enrollmentId is client-supplied and is compared against uuid columns below.
  // uuidSchema applies no transform, so the original value is used as-is.
  if (!uuidSchema.safeParse(enrollmentId).success) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      error: "Invalid enrollment reference.",
    };
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

/**
 * Bulk assign strand to multiple students (SHS only).
 * Only allowed for students with no grades entered.
 */
export async function bulkAssignStrandAction(
  _prevState: BulkAssignStrandFormState,
  formData: FormData
): Promise<BulkAssignStrandFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "student_subject_enrollments:manage")) {
    return { message: "You do not have permission to manage student enrollments." };
  }

  // Parse enrollmentIds from JSON string (passed from form)
  const enrollmentIdsRaw = formData.get("enrollmentIds");
  let enrollmentIds: string[];
  try {
    enrollmentIds = JSON.parse(enrollmentIdsRaw as string);
  } catch {
    return { message: "Invalid enrollment IDs format." };
  }

  const parsed = bulkAssignStrandSchema.safeParse({
    enrollmentIds,
    strandId: formData.get("strandId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { strandId } = parsed.data;

  // Get new strand info
  const [newStrand] = await db
    .select({ code: strands.code, name: strands.name })
    .from(strands)
    .where(eq(strands.id, strandId))
    .limit(1);

  if (!newStrand) {
    return { message: "Strand not found." };
  }

  // Process each enrollment
  let updatedCount = 0;
  let skippedCount = 0;
  const skippedReasons: string[] = [];

  for (const enrollmentId of enrollmentIds) {
    // Check if strand change is allowed
    const changeCheck = await canChangeStrand(enrollmentId);
    if (!changeCheck.canChange) {
      skippedCount++;
      skippedReasons.push(changeCheck.reason || "Cannot change strand");
      continue;
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
      skippedCount++;
      continue;
    }

    // Skip if already has this strand
    if (enrollment.strandId === strandId) {
      skippedCount++;
      continue;
    }

    await db.transaction(async (tx) => {
      // 1. Update enrollment strand
      await tx
        .update(enrollments)
        .set({
          strandId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(enrollments.id, enrollmentId));

      // 2. Get current elective subject enrollments
      const currentSseRows = await tx
        .select({
          id: studentSubjectEnrollments.id,
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

      // 3. Soft delete current elective enrollments
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
    });

    // Regenerate subject enrollments for new strand
    await generateStudentSubjectEnrollmentsAction(enrollmentId);
    updatedCount++;
  }

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "student_subject_enrollments:bulk_assign_strand",
    targetEntity: "enrollments",
    targetId: enrollmentIds.join(","),
    newState: {
      strandId,
      strandCode: newStrand.code,
      updatedCount,
      skippedCount,
    },
  });

  invalidateTag(CACHE_TAGS.STUDENT_SUBJECT_ENROLLMENTS);

  if (skippedCount > 0 && updatedCount === 0) {
    return {
      message: `All ${skippedCount} student(s) were skipped. ${skippedReasons[0] || ""}`,
    };
  }

  return {
    success: true,
    updatedCount,
    skippedCount,
  };
}

/**
 * Manually enroll a student in a specific subject offering.
 * Used for manual elective assignment outside of strand-based auto-enrollment.
 */
export async function manuallyEnrollStudentInSubjectAction(
  _prevState: ManualEnrollSubjectFormState,
  formData: FormData
): Promise<ManualEnrollSubjectFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "student_subject_enrollments:manage")) {
    return { message: "You do not have permission to manage student enrollments." };
  }

  const parsed = manualEnrollSubjectSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    subjectOfferingId: formData.get("subjectOfferingId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { enrollmentId, subjectOfferingId } = parsed.data;

  // Get enrollment details
  const [enrollment] = await db
    .select({
      id: enrollments.id,
      studentId: enrollments.studentId,
      schoolYearId: enrollments.schoolYearId,
      strandId: enrollments.strandId,
    })
    .from(enrollments)
    .where(eq(enrollments.id, enrollmentId))
    .limit(1);

  if (!enrollment) {
    return { message: "Enrollment not found." };
  }

  // Get subject offering details
  const [offering] = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      strandId: subjectOfferings.strandId,
      subjectCode: subjects.code,
      subjectName: subjects.name,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.id, subjectOfferingId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .limit(1);

  if (!offering) {
    return { message: "Subject offering not found or inactive." };
  }

  // Check if already enrolled
  const [existing] = await db
    .select({ id: studentSubjectEnrollments.id })
    .from(studentSubjectEnrollments)
    .where(
      and(
        eq(studentSubjectEnrollments.enrollmentId, enrollmentId),
        eq(studentSubjectEnrollments.subjectOfferingId, subjectOfferingId),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    )
    .limit(1);

  if (existing) {
    return { message: "Student is already enrolled in this subject." };
  }

  // Create enrollment
  await db.insert(studentSubjectEnrollments).values({
    enrollmentId,
    subjectOfferingId,
    studentId: enrollment.studentId,
    schoolYearId: enrollment.schoolYearId,
    isActive: true,
    createdBy: session.userId,
    updatedBy: session.userId,
  });

  // Check for cross-strand warning
  let warning: string | undefined;
  if (offering.strandId && enrollment.strandId && offering.strandId !== enrollment.strandId) {
    // Get strand codes for the warning message
    const [studentStrand] = await db
      .select({ code: strands.code })
      .from(strands)
      .where(eq(strands.id, enrollment.strandId))
      .limit(1);

    const [offeringStrand] = await db
      .select({ code: strands.code })
      .from(strands)
      .where(eq(strands.id, offering.strandId))
      .limit(1);

    warning = `Note: This subject (${offering.subjectCode}) is for ${offeringStrand?.code || "another"} strand, but the student is in ${studentStrand?.code || "a different"} strand.`;
  }

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "student_subject_enrollments:manual_enroll",
    targetEntity: "student_subject_enrollments",
    targetId: enrollmentId,
    newState: {
      subjectOfferingId,
      subjectCode: offering.subjectCode,
      subjectName: offering.subjectName,
      isCrossStrand: !!warning,
    },
  });

  invalidateTag(CACHE_TAGS.STUDENT_SUBJECT_ENROLLMENTS);

  return { success: true, warning };
}
