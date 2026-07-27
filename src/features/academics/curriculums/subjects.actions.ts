"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { curriculums, subjects, subjectStrands, strands } from "@/lib/db/schema";
import { eq, and, isNull, sql, inArray, asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction, logDeleteAction, logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import {
  AddSubjectToCurriculumSchema,
  UpdateSubjectInCurriculumSchema,
  DeleteSubjectFromCurriculumSchema,
  RestoreSubjectInCurriculumSchema,
  ReorderSubjectsSchema,
  StrandAssociationSchema,
  type AddSubjectToCurriculumFormState,
  type UpdateSubjectInCurriculumFormState,
  type DeleteSubjectFromCurriculumFormState,
  type RestoreSubjectInCurriculumFormState,
  type ReorderSubjectsFormState,
  type StrandAssociation,
} from "./curriculums.schema";
import type { SubjectStrandAssociation } from "./curriculums.types";

// ─── Helper: Verify Draft Status ────────────────────────────────────────────

async function verifyCurriculumIsDraft(curriculumId: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  const curriculum = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, curriculumId),
    columns: { id: true, status: true },
  });

  if (!curriculum) {
    return { valid: false, error: "Curriculum not found." };
  }

  if (curriculum.status !== "draft") {
    return {
      valid: false,
      error: "Subjects can only be modified in draft curriculums. Clone the curriculum to create an editable version.",
    };
  }

  return { valid: true };
}

async function getSubjectCurriculumId(subjectId: string): Promise<string | null> {
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
    columns: { curriculumId: true },
  });
  return subject?.curriculumId ?? null;
}

/**
 * Check if a subject code already exists within a curriculum.
 * Extracts duplicate logic from add/update/restore actions.
 *
 * @param curriculumId - The curriculum to check within
 * @param code - The subject code to check
 * @param excludeSubjectId - Optional subject ID to exclude (for updates)
 * @returns true if code conflicts with another active subject
 */
async function checkSubjectCodeConflict(
  curriculumId: string,
  code: string,
  excludeSubjectId?: string
): Promise<boolean> {
  const conditions = [
    eq(subjects.curriculumId, curriculumId),
    sql`UPPER(${subjects.code}) = UPPER(${code})`,
    isNull(subjects.deletedAt),
  ];

  if (excludeSubjectId) {
    conditions.push(sql`${subjects.id} != ${excludeSubjectId}`);
  }

  const existing = await db.query.subjects.findFirst({
    where: and(...conditions),
    columns: { id: true },
  });

  return !!existing;
}

/**
 * Parse strand associations from JSON string and validate.
 */
function parseStrandAssociations(
  strandAssociationsJson: string | undefined
): StrandAssociation[] | null {
  if (!strandAssociationsJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(strandAssociationsJson);
    if (!Array.isArray(parsed)) {
      return null;
    }

    // Validate each association
    const validated: StrandAssociation[] = [];
    for (const item of parsed) {
      const result = StrandAssociationSchema.safeParse(item);
      if (result.success) {
        validated.push(result.data);
      }
    }

    return validated.length > 0 ? validated : null;
  } catch {
    return null;
  }
}

/**
 * Save strand associations for a subject.
 * Replaces all existing associations with the new ones.
 */
async function saveSubjectStrandAssociations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  subjectId: string,
  associations: StrandAssociation[],
  userId: string
): Promise<void> {
  // Delete existing associations
  await tx
    .delete(subjectStrands)
    .where(eq(subjectStrands.subjectId, subjectId));

  // Insert new associations
  if (associations.length > 0) {
    await tx.insert(subjectStrands).values(
      associations.map((a) => ({
        subjectId,
        strandId: a.strandId,
        isStrandCore: a.isStrandCore ?? false,
        createdBy: userId,
      }))
    );
  }
}

// ─── Add Subject to Curriculum ──────────────────────────────────────────────

export async function addSubjectToCurriculumAction(
  _prevState: AddSubjectToCurriculumFormState,
  formData: FormData
): Promise<AddSubjectToCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "subjects:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(AddSubjectToCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const {
    curriculumId,
    name,
    code,
    description,
    gradeLevelId,
    units,
    sequenceOrder,
    isCore,
    strandAssociations: strandAssociationsJson,
  } = result.data;

  // Verify curriculum is a draft
  const draftCheck = await verifyCurriculumIsDraft(curriculumId);
  if (!draftCheck.valid) {
    return { message: draftCheck.error };
  }

  // Check for duplicate code within this curriculum
  const hasConflict = await checkSubjectCodeConflict(curriculumId, code);
  if (hasConflict) {
    return { errors: { code: ["Subject code already exists in this curriculum."] } };
  }

  // Parse strand associations if provided
  const strandAssociations = parseStrandAssociations(strandAssociationsJson);

  try {
    // Get next sequence order if not provided
    let finalSequenceOrder = sequenceOrder ?? 0;
    if (sequenceOrder === undefined) {
      const [maxOrder] = await db
        .select({ max: sql<number>`COALESCE(MAX(${subjects.sequenceOrder}), 0)` })
        .from(subjects)
        .where(
          and(
            eq(subjects.curriculumId, curriculumId),
            eq(subjects.gradeLevelId, gradeLevelId),
            isNull(subjects.deletedAt)
          )
        );
      finalSequenceOrder = (maxOrder?.max ?? 0) + 1;
    }

    const newSubjectId = await db.transaction(async (tx) => {
      const [newSubject] = await tx
        .insert(subjects)
        .values({
          name,
          code,
          description: description ?? null,
          curriculumId,
          gradeLevelId,
          units: units ?? "0",
          sequenceOrder: finalSequenceOrder,
          isCore: isCore ?? true,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: subjects.id });

      // Save strand associations for elective subjects
      if (!isCore && strandAssociations && strandAssociations.length > 0) {
        await saveSubjectStrandAssociations(
          tx,
          newSubject.id,
          strandAssociations,
          session.userId
        );
      }

      return newSubject.id;
    });

    await logCreateAction(
      session,
      "subjects",
      newSubjectId,
      {
        name,
        code,
        curriculumId,
        gradeLevelId,
        strandCount: strandAssociations?.length ?? 0,
      },
      { throwOnFail: true }
    );

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    invalidateTag(CACHE_TAGS.STRANDS);
    revalidatePath(`/staff/academics/curriculums/${curriculumId}`);

    return { success: true, subjectId: newSubjectId };
  } catch (error) {
    logger.error("[subjects] Failed to add subject", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Update Subject in Curriculum ───────────────────────────────────────────

export async function updateSubjectInCurriculumAction(
  _prevState: UpdateSubjectInCurriculumFormState,
  formData: FormData
): Promise<UpdateSubjectInCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "subjects:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(UpdateSubjectInCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const {
    subjectId,
    name,
    code,
    description,
    gradeLevelId,
    units,
    sequenceOrder,
    isCore,
    strandAssociations: strandAssociationsJson,
  } = result.data;

  // Get subject's curriculum
  const curriculumId = await getSubjectCurriculumId(subjectId);
  if (!curriculumId) {
    return { message: "Subject not found." };
  }

  // Verify curriculum is a draft
  const draftCheck = await verifyCurriculumIsDraft(curriculumId);
  if (!draftCheck.valid) {
    return { message: draftCheck.error };
  }

  // Get existing subject for comparison
  const existing = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
    columns: { id: true, name: true, code: true, curriculumId: true, isCore: true },
  });

  if (!existing) {
    return { message: "Subject not found." };
  }

  // Check for duplicate code if code is being changed
  if (code && code !== existing.code) {
    const hasConflict = await checkSubjectCodeConflict(curriculumId, code, subjectId);
    if (hasConflict) {
      return { errors: { code: ["Subject code already exists in this curriculum."] } };
    }
  }

  // Parse strand associations if provided
  const strandAssociations = parseStrandAssociations(strandAssociationsJson);

  try {
    await db.transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
        updatedBy: session.userId,
      };

      if (name !== undefined) updateData.name = name;
      if (code !== undefined) updateData.code = code;
      if (description !== undefined) updateData.description = description;
      if (gradeLevelId !== undefined) updateData.gradeLevelId = gradeLevelId;
      if (units !== undefined) updateData.units = units;
      if (sequenceOrder !== undefined) updateData.sequenceOrder = sequenceOrder;
      if (isCore !== undefined) updateData.isCore = isCore;

      await tx
        .update(subjects)
        .set(updateData)
        .where(eq(subjects.id, subjectId));

      // Update strand associations
      // If subject is now core, remove all strand associations
      // If subject is elective, update associations
      const finalIsCore = isCore ?? existing.isCore;

      if (finalIsCore) {
        // Core subjects don't have strand associations - remove any existing
        await tx.delete(subjectStrands).where(eq(subjectStrands.subjectId, subjectId));
      } else if (strandAssociations !== null) {
        // Elective subject with explicit strand associations
        await saveSubjectStrandAssociations(
          tx,
          subjectId,
          strandAssociations,
          session.userId
        );
      }
      // If strandAssociations is null and subject is still elective, keep existing associations
    });

    await logUpdateAction(
      session,
      "subjects",
      subjectId,
      { name: existing.name, code: existing.code },
      {
        name,
        code,
        description,
        gradeLevelId,
        units,
        sequenceOrder,
        isCore,
        strandCount: strandAssociations?.length,
      },
      { throwOnFail: true }
    );

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    invalidateTag(CACHE_TAGS.STRANDS);
    revalidatePath(`/staff/academics/curriculums/${curriculumId}`);

    return { success: true, message: "Subject updated successfully." };
  } catch (error) {
    logger.error("[subjects] Failed to update subject", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Soft Delete Subject from Curriculum ────────────────────────────────────

export async function deleteSubjectFromCurriculumAction(
  _prevState: DeleteSubjectFromCurriculumFormState,
  formData: FormData
): Promise<DeleteSubjectFromCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "subjects:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(DeleteSubjectFromCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { subjectId } = result.data;

  // Get subject's curriculum
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
    columns: { id: true, curriculumId: true, name: true, code: true, deletedAt: true },
  });

  if (!subject) {
    return { message: "Subject not found." };
  }

  if (subject.deletedAt) {
    return { message: "Subject is already deleted." };
  }

  // Verify curriculum is a draft
  const draftCheck = await verifyCurriculumIsDraft(subject.curriculumId);
  if (!draftCheck.valid) {
    return { message: draftCheck.error };
  }

  try {
    await db
      .update(subjects)
      .set({
        deletedAt: new Date(),
        deletedBy: session.userId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(subjects.id, subjectId));

    await logDeleteAction(session, "subjects", subjectId, "Soft delete", { throwOnFail: true });

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    revalidatePath(`/staff/academics/curriculums/${subject.curriculumId}`);

    return { success: true, message: "Subject deleted successfully." };
  } catch (error) {
    logger.error("[subjects] Failed to delete subject", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Restore Subject in Curriculum ──────────────────────────────────────────

export async function restoreSubjectInCurriculumAction(
  _prevState: RestoreSubjectInCurriculumFormState,
  formData: FormData
): Promise<RestoreSubjectInCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "subjects:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(RestoreSubjectInCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { subjectId } = result.data;

  // Get subject including deleted
  const subject = await db.query.subjects.findFirst({
    where: eq(subjects.id, subjectId),
    columns: { id: true, curriculumId: true, code: true, deletedAt: true },
  });

  if (!subject) {
    return { message: "Subject not found." };
  }

  if (!subject.deletedAt) {
    return { message: "Subject is not deleted." };
  }

  // Verify curriculum is a draft
  const draftCheck = await verifyCurriculumIsDraft(subject.curriculumId);
  if (!draftCheck.valid) {
    return { message: draftCheck.error };
  }

  // Check if code now conflicts with another active subject
  const hasConflict = await checkSubjectCodeConflict(
    subject.curriculumId,
    subject.code,
    subjectId
  );
  if (hasConflict) {
    return {
      message: `Cannot restore: subject code "${subject.code}" is now used by another subject.`,
    };
  }

  try {
    await db
      .update(subjects)
      .set({
        deletedAt: null,
        deletedBy: null,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(subjects.id, subjectId));

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "subjects:restore",
      targetEntity: "subjects",
      targetId: subjectId,
    });

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    revalidatePath(`/staff/academics/curriculums/${subject.curriculumId}`);

    return { success: true, message: "Subject restored successfully." };
  } catch (error) {
    logger.error("[subjects] Failed to restore subject", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Reorder Subjects ───────────────────────────────────────────────────────

export async function reorderSubjectsAction(
  _prevState: ReorderSubjectsFormState,
  formData: FormData
): Promise<ReorderSubjectsFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "subjects:manage")) {
    return { message: "You do not have permission to manage subjects." };
  }

  const result = parseFormData(ReorderSubjectsSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { curriculumId, gradeLevelId, subjectOrder } = result.data;

  // Verify curriculum is a draft
  const draftCheck = await verifyCurriculumIsDraft(curriculumId);
  if (!draftCheck.valid) {
    return { message: draftCheck.error };
  }

  // Validate that subjectOrder is an exact permutation of the active subjects
  // for this curriculum + grade level (no duplicates, omissions, or foreign IDs).
  const activeSubjects = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(
      and(
        eq(subjects.curriculumId, curriculumId),
        eq(subjects.gradeLevelId, gradeLevelId),
        isNull(subjects.deletedAt)
      )
    );

  const activeIds = new Set(activeSubjects.map((s) => s.id));
  const orderedIds = new Set(subjectOrder);

  const isExactPermutation =
    subjectOrder.length === activeIds.size &&
    orderedIds.size === subjectOrder.length &&
    subjectOrder.every((id) => activeIds.has(id));

  if (!isExactPermutation) {
    return {
      message:
        "Invalid subject order: it must include each subject in this grade level exactly once.",
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Update sequence order for each subject
      for (let i = 0; i < subjectOrder.length; i++) {
        await tx
          .update(subjects)
          .set({
            sequenceOrder: i,
            updatedAt: new Date(),
            updatedBy: session.userId,
          })
          .where(
            and(
              eq(subjects.id, subjectOrder[i]),
              eq(subjects.curriculumId, curriculumId),
              eq(subjects.gradeLevelId, gradeLevelId)
            )
          );
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "subjects:reorder",
          targetEntity: "subjects",
          targetId: curriculumId,
          context: `Reordered subjects in grade level ${gradeLevelId}`,
        },
        { throwOnFail: true }
      );
    });

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    revalidatePath(`/staff/academics/curriculums/${curriculumId}`);

    return { success: true, message: "Subjects reordered successfully." };
  } catch (error) {
    logger.error("[subjects] Failed to reorder subjects", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Get Subject Strands (Client-Callable) ──────────────────────────────────

/**
 * Server action to fetch strand associations for a subject.
 * This wraps the query function so it can be called from client components.
 */
export async function getSubjectStrandsAction(
  subjectId: string
): Promise<SubjectStrandAssociation[]> {
  if (!subjectId) {
    return [];
  }

  const rows = await db
    .select({
      strandId: subjectStrands.strandId,
      strandCode: strands.code,
      strandName: strands.name,
      isStrandCore: subjectStrands.isStrandCore,
    })
    .from(subjectStrands)
    .innerJoin(strands, eq(subjectStrands.strandId, strands.id))
    .where(eq(subjectStrands.subjectId, subjectId))
    .orderBy(strands.displayOrder);

  return rows;
}
