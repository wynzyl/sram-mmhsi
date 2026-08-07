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
  addManualSubjectOfferingSchema,
  availableSubjectsForManualOfferingSchema,
  updateOfferingTrackSchema,
  type GenerateSubjectOfferingsFormState,
  type AssignTeacherFormState,
  type DeleteSubjectOfferingFormState,
  type DeleteAllSubjectOfferingsFormState,
  type AddManualSubjectOfferingFormState,
  type UpdateOfferingTrackFormState,
} from "./subject-offerings.schema";
import {
  getSubjectsForOfferingGeneration,
  getSubjectOfferingById,
  getAvailableSubjectsForManualOffering,
} from "./subject-offerings.queries";
import type { SubjectForManualOffering } from "./subject-offerings.schema";
import { curriculums, sections, gradeLevels } from "@/lib/db/schema";

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

  // Check for enrolled students with grades (active enrollments are blocking)
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

  // Soft-delete all related student subject enrollments (including inactive ones)
  // This prevents orphaned SSE records from appearing in grade entry
  await db
    .update(studentSubjectEnrollments)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
      isActive: false,
    })
    .where(
      and(
        eq(studentSubjectEnrollments.subjectOfferingId, id),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

  // Soft delete the offering itself
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

  // Soft-delete all related student subject enrollments (including inactive ones)
  // This prevents orphaned SSE records from appearing in grade entry
  await db
    .update(studentSubjectEnrollments)
    .set({
      deletedAt: new Date(),
      deletedBy: session.userId,
      isActive: false,
    })
    .where(
      and(
        inArray(studentSubjectEnrollments.subjectOfferingId, offeringIds),
        isNull(studentSubjectEnrollments.deletedAt)
      )
    );

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

/**
 * Add a manual subject offering from any published curriculum.
 * Enables SHS elective flexibility without changing curriculum adoption.
 */
export async function addManualSubjectOfferingAction(
  _prevState: AddManualSubjectOfferingFormState,
  formData: FormData
): Promise<AddManualSubjectOfferingFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:create")) {
    return { message: "You do not have permission to add subject offerings." };
  }

  const strandIdRaw = formData.get("strandId");
  const termOfferedRaw = formData.get("termOffered");
  const parsed = addManualSubjectOfferingSchema.safeParse({
    sectionId: formData.get("sectionId"),
    schoolYearId: formData.get("schoolYearId"),
    subjectId: formData.get("subjectId"),
    sourceCurriculumId: formData.get("sourceCurriculumId"),
    strandId: strandIdRaw === "" || strandIdRaw === "null" ? null : strandIdRaw,
    sequenceOrder: formData.get("sequenceOrder") || 999,
    termOffered: termOfferedRaw === "" || !termOfferedRaw ? "full_year" : termOfferedRaw,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { sectionId, schoolYearId, subjectId, sourceCurriculumId, strandId, sequenceOrder, termOffered } = parsed.data;

  // 1. Validate curriculum is published
  const [curriculum] = await db
    .select({
      id: curriculums.id,
      name: curriculums.name,
      status: curriculums.status,
    })
    .from(curriculums)
    .where(eq(curriculums.id, sourceCurriculumId))
    .limit(1);

  if (!curriculum) {
    return { message: "Curriculum not found." };
  }

  if (curriculum.status !== "published") {
    return { message: "Cannot add subjects from unpublished curriculum." };
  }

  // 2. Validate subject exists in curriculum
  const [subject] = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      name: subjects.name,
      gradeLevelId: subjects.gradeLevelId,
      isCore: subjects.isCore,
    })
    .from(subjects)
    .where(
      and(
        eq(subjects.id, subjectId),
        eq(subjects.curriculumId, sourceCurriculumId),
        isNull(subjects.deletedAt)
      )
    )
    .limit(1);

  if (!subject) {
    return { message: "Subject not found in curriculum." };
  }

  // 3. Validate subject grade level matches section
  const [section] = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(eq(sections.id, sectionId))
    .limit(1);

  if (!section) {
    return { message: "Section not found." };
  }

  if (subject.gradeLevelId !== section.gradeLevelId) {
    return { message: "Subject grade level does not match section grade level." };
  }

  // 4. Check for existing offering - if it exists without strand, update it
  const [existingOffering] = await db
    .select({
      id: subjectOfferings.id,
      subjectId: subjectOfferings.subjectId,
      subjectCode: subjects.code,
      strandId: subjectOfferings.strandId,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjects.code, subject.code),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .limit(1);

  // If offering exists
  if (existingOffering) {
    // If it already has a strand, we can't update
    if (existingOffering.strandId) {
      return { message: `Subject "${subject.code}" already has a strand assignment in this section.` };
    }

    // If no strand yet and user selected a strand, UPDATE the existing offering
    if (strandId) {
      await db
        .update(subjectOfferings)
        .set({
          strandId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(subjectOfferings.id, existingOffering.id));

      await logAudit({
        actor: session.userId,
        actorRole: session.role,
        action: "subject_offerings:link_strand",
        targetEntity: "subject_offerings",
        targetId: existingOffering.id,
        previousState: { strandId: null },
        newState: {
          sectionName: section.name,
          subjectCode: subject.code,
          subjectName: subject.name,
          strandId,
        },
      });

      invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

      return { success: true };
    } else {
      return { message: `Subject "${subject.code}" is already offered without a strand.` };
    }
  }

  // 5. Insert new offering with sourceCurriculumId and termOffered
  const [newOffering] = await db
    .insert(subjectOfferings)
    .values({
      sectionId,
      subjectId,
      schoolYearId,
      strandId: strandId || null,
      sourceCurriculumId,
      termOffered: termOffered || "full_year",
      isActive: true,
      sequenceOrder: sequenceOrder || 999,
      createdBy: session.userId,
      updatedBy: session.userId,
    })
    .returning();

  // 6. Audit log with source curriculum info
  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:create",
    targetEntity: "subject_offerings",
    targetId: newOffering.id,
    newState: {
      sectionId,
      sectionName: section.name,
      subjectId,
      subjectCode: subject.code,
      subjectName: subject.name,
      sourceCurriculumId,
      sourceCurriculumName: curriculum.name,
      strandId,
      termOffered,
      schoolYearId,
    },
  });

  // 7. Invalidate cache
  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return { success: true };
}

/**
 * Server action wrapper for getAvailableSubjectsForManualOffering.
 * Allows client components to fetch available subjects safely.
 */
export async function getAvailableSubjectsForManualOfferingAction(
  curriculumId: string,
  gradeLevelId: string,
  sectionId: string,
  schoolYearId: string
): Promise<SubjectForManualOffering[]> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:read")) {
    return [];
  }

  // All four ids are client-supplied and are compared against uuid columns in
  // the query; an unparsed value surfaces as a Postgres 22P02 error instead of
  // an empty result. Mirrors the unauthorized case by returning no subjects.
  const parsed = availableSubjectsForManualOfferingSchema.safeParse({
    curriculumId,
    gradeLevelId,
    sectionId,
    schoolYearId,
  });

  if (!parsed.success) {
    return [];
  }

  return getAvailableSubjectsForManualOffering(
    parsed.data.curriculumId,
    parsed.data.gradeLevelId,
    parsed.data.sectionId,
    parsed.data.schoolYearId
  );
}

/**
 * Update the track (strand) assignment for a subject offering.
 * This allows changing which track a subject is offered to after curriculum is published.
 * Setting strandId to null means "All Tracks" (core behavior for SHS).
 */
export async function updateOfferingTrackAction(
  _prevState: UpdateOfferingTrackFormState,
  formData: FormData
): Promise<UpdateOfferingTrackFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "subject_offerings:generate")) {
    return { message: "You do not have permission to update track assignments." };
  }

  // Schema handles null conversion via preprocess (empty string, "null" → null)
  const parsed = updateOfferingTrackSchema.safeParse({
    id: formData.get("id"),
    strandId: formData.get("strandId"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { id, strandId } = parsed.data;

  // Get existing offering for validation and audit
  const existing = await getSubjectOfferingById(id);
  if (!existing) {
    return { message: "Subject offering not found." };
  }

  // Update the strand assignment
  await db
    .update(subjectOfferings)
    .set({
      strandId: strandId,
      updatedAt: new Date(),
      updatedBy: session.userId,
    })
    .where(eq(subjectOfferings.id, id));

  await logAudit({
    actor: session.userId,
    actorRole: session.role,
    action: "subject_offerings:update_track",
    targetEntity: "subject_offerings",
    targetId: id,
    previousState: {
      strandId: existing.strandId,
      strandCode: existing.strandCode,
    },
    newState: {
      strandId,
      subjectCode: existing.subjectCode,
      sectionName: existing.sectionName,
    },
  });

  invalidateTag(CACHE_TAGS.SUBJECT_OFFERINGS);

  return { success: true };
}
