"use server";

import { db } from "@/lib/db";
import { subjectOfferings, studentSubjectEnrollments, subjects } from "@/lib/db/schema";
import { eq, and, isNull, count, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import {
  generateSubjectOfferingsSchema,
  assignTeacherSchema,
  deleteSubjectOfferingSchema,
  deleteAllSubjectOfferingsSchema,
  type GenerateSubjectOfferingsFormState,
  type AssignTeacherFormState,
  type DeleteSubjectOfferingFormState,
  type DeleteAllSubjectOfferingsFormState,
} from "./subject-offerings.schema";
import {
  getSubjectsForOfferingGeneration,
  getSubjectOfferingById,
} from "./subject-offerings.queries";

/**
 * Generate subject offerings for a section from the adopted curriculum.
 * Idempotent: skips subjects that already have offerings.
 */
export async function generateSubjectOfferingsAction(
  _prevState: GenerateSubjectOfferingsFormState,
  formData: FormData
): Promise<GenerateSubjectOfferingsFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:generate")) {
    return { message: "You do not have permission to generate subject offerings." };
  }

  const parsed = generateSubjectOfferingsSchema.safeParse({
    sectionId: formData.get("sectionId"),
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { sectionId, schoolYearId } = parsed.data;

  // Get subjects from adopted curriculum
  const curriculumSubjects = await getSubjectsForOfferingGeneration(sectionId, schoolYearId);

  if (curriculumSubjects.length === 0) {
    return {
      message: "No curriculum adopted for this grade level and school year.",
    };
  }

  // Get existing offerings to check for duplicates (check both subjectId and subject code)
  const existingOfferings = await db
    .select({
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    );

  const existingSubjectIds = new Set(existingOfferings.map((o) => o.subjectId));
  const existingSubjectCodes = new Set(existingOfferings.map((o) => o.subjectCode));

  // Filter out subjects that already have offerings (by ID or by code to prevent duplicates)
  const newSubjects = curriculumSubjects.filter(
    (s) => !existingSubjectIds.has(s.id) && !existingSubjectCodes.has(s.code)
  );

  const skippedCount = curriculumSubjects.length - newSubjects.length;

  if (newSubjects.length === 0) {
    return {
      success: true,
      createdCount: 0,
      skippedCount,
      message: "All subjects already have offerings for this section.",
    };
  }

  // Create offerings for new subjects
  // For electives, set strandId if subject has strand associations (use first strand)
  const offerings = newSubjects.map((subject, index) => ({
    sectionId,
    subjectId: subject.id,
    schoolYearId,
    isActive: true,
    sequenceOrder: subject.sequenceOrder || index,
    // Set strandId for electives with strand associations
    strandId: !subject.isCore && subject.strandIds && subject.strandIds.length > 0
      ? subject.strandIds[0]
      : null,
    createdBy: session.userId,
    updatedBy: session.userId,
  }));

  await db.insert(subjectOfferings).values(offerings);

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:generate",
    targetEntity: "subject_offerings",
    targetId: sectionId,
    newState: {
      sectionId,
      schoolYearId,
      createdCount: newSubjects.length,
      skippedCount,
    },
  });

  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return {
    success: true,
    createdCount: newSubjects.length,
    skippedCount,
  };
}

/**
 * Assign or remove a teacher from a subject offering.
 */
export async function assignTeacherAction(
  _prevState: AssignTeacherFormState,
  formData: FormData
): Promise<AssignTeacherFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:assign_teacher")) {
    return { message: "You do not have permission to assign teachers." };
  }

  const teacherIdRaw = formData.get("teacherId");
  const parsed = assignTeacherSchema.safeParse({
    subjectOfferingId: formData.get("subjectOfferingId"),
    teacherId: teacherIdRaw === "" || teacherIdRaw === "null" ? null : teacherIdRaw,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { subjectOfferingId, teacherId } = parsed.data;

  // Get existing offering for audit
  const existing = await getSubjectOfferingById(subjectOfferingId);
  if (!existing) {
    return { message: "Subject offering not found." };
  }

  await db
    .update(subjectOfferings)
    .set({
      teacherId: teacherId || null,
      updatedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(subjectOfferings.id, subjectOfferingId));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:assign_teacher",
    targetEntity: "subject_offerings",
    targetId: subjectOfferingId,
    previousState: { teacherId: existing.teacherId },
    newState: { teacherId },
  });

  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return { success: true };
}

/**
 * Soft delete a subject offering.
 * Cannot delete if students are enrolled.
 */
export async function deleteSubjectOfferingAction(
  _prevState: DeleteSubjectOfferingFormState,
  formData: FormData
): Promise<DeleteSubjectOfferingFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:generate")) {
    return { message: "You do not have permission to delete subject offerings." };
  }

  const parsed = deleteSubjectOfferingSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id } = parsed.data;

  // Get existing offering
  const existing = await getSubjectOfferingById(id);
  if (!existing) {
    return { message: "Subject offering not found." };
  }

  // Check for enrolled students
  const [enrollmentCount] = await db
    .select({ count: count() })
    .from(studentSubjectEnrollments)
    .where(
      and(
        eq(studentSubjectEnrollments.subjectOfferingId, id),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

  if (enrollmentCount.count > 0) {
    return {
      message: `Cannot delete subject offering with ${enrollmentCount.count} enrolled student(s).`,
    };
  }

  // Soft delete
  await db
    .update(subjectOfferings)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(eq(subjectOfferings.id, id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:delete",
    targetEntity: "subject_offerings",
    targetId: id,
    previousState: {
      subjectCode: existing.subjectCode,
      sectionName: existing.sectionName,
    },
  });

  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return { success: true };
}

/**
 * Delete all subject offerings for a section.
 * Cannot delete if any offering has enrolled students.
 */
export async function deleteAllSubjectOfferingsAction(
  _prevState: DeleteAllSubjectOfferingsFormState,
  formData: FormData
): Promise<DeleteAllSubjectOfferingsFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:generate")) {
    return { message: "You do not have permission to delete subject offerings." };
  }

  const parsed = deleteAllSubjectOfferingsSchema.safeParse({
    sectionId: formData.get("sectionId"),
    schoolYearId: formData.get("schoolYearId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { sectionId, schoolYearId } = parsed.data;

  // Get all active offerings for this section
  const offerings = await db
    .select({
      id: subjectOfferings.id,
      subjectCode: subjects.code,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    );

  if (offerings.length === 0) {
    return {
      message: "No subject offerings found for this section.",
    };
  }

  // Check if any offering has enrolled students
  const offeringIds = offerings.map((o) => o.id);
  const [enrollmentCount] = await db
    .select({ count: count() })
    .from(studentSubjectEnrollments)
    .where(
      and(
        inArray(studentSubjectEnrollments.subjectOfferingId, offeringIds),
        eq(studentSubjectEnrollments.isActive, true),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

  if (enrollmentCount.count > 0) {
    return {
      message: `Cannot delete offerings: ${enrollmentCount.count} student enrollment(s) exist. Remove student enrollments first.`,
    };
  }

  // Soft delete all offerings
  await db
    .update(subjectOfferings)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
    })
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        isNull(subjectOfferings.deletedAt)
      )
    );

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:delete_all",
    targetEntity: "subject_offerings",
    targetId: sectionId,
    newState: {
      sectionId,
      schoolYearId,
      deletedCount: offerings.length,
      subjectCodes: offerings.map((o) => o.subjectCode),
    },
  });

  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return {
    success: true,
    deletedCount: offerings.length,
    message: `Successfully deleted ${offerings.length} subject offering(s).`,
  };
}
