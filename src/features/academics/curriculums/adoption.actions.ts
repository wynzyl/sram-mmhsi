"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  curriculums,
  curriculumAdoptions,
  gradeRecords,
  teacherAssignments,
  sections,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction, logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import {
  UpdateAdoptionSchema,
  type UpdateAdoptionFormState,
} from "./curriculums.schema";
import { checkAdoptionChangeEligibility } from "./archive-guard";

// ─── Grade Record Check ─────────────────────────────────────────────────────

/**
 * Returns true if any grade records exist for the given school year + grade level.
 *
 * The grade level is derived from the SECTION being taught (via
 * teacherAssignments.sectionId → sections.gradeLevelId), which is the grade
 * level the curriculum adoption governs — not the subject's own grade level.
 */
async function hasGradeRecordsForGradeLevel(
  schoolYearId: string,
  gradeLevelId: string
): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gradeRecords)
    .innerJoin(
      teacherAssignments,
      eq(gradeRecords.teacherAssignmentId, teacherAssignments.id)
    )
    .innerJoin(sections, eq(teacherAssignments.sectionId, sections.id))
    .where(
      and(
        eq(gradeRecords.schoolYearId, schoolYearId),
        eq(sections.gradeLevelId, gradeLevelId)
      )
    );

  return (row?.count ?? 0) > 0;
}

// ─── Update Adoption ────────────────────────────────────────────────────────

export async function updateAdoptionAction(
  _prevState: UpdateAdoptionFormState,
  formData: FormData
): Promise<UpdateAdoptionFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:adopt")) {
    return { message: "You do not have permission to manage curriculum adoptions." };
  }

  const result = parseFormData(UpdateAdoptionSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { schoolYearId, gradeLevelId, curriculumId } = result.data;

  // Verify curriculum exists and is published
  const curriculum = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, curriculumId),
    columns: { id: true, status: true, name: true },
  });

  if (!curriculum) {
    return { message: "Curriculum not found." };
  }

  if (curriculum.status !== "published") {
    return { message: "Only published curriculums can be adopted." };
  }

  // Check if there are existing grade records for this school year + grade level
  // This would indicate grades have been entered and adoption shouldn't change
  const hasGradeRecords = await hasGradeRecordsForGradeLevel(
    schoolYearId,
    gradeLevelId
  );
  const eligibilityError = checkAdoptionChangeEligibility(hasGradeRecords);

  if (eligibilityError) {
    return { message: eligibilityError };
  }

  // Check existing adoption
  const existingAdoption = await db.query.curriculumAdoptions.findFirst({
    where: and(
      eq(curriculumAdoptions.schoolYearId, schoolYearId),
      eq(curriculumAdoptions.gradeLevelId, gradeLevelId)
    ),
    columns: { id: true, curriculumId: true },
  });

  try {
    await db.transaction(async (tx) => {
      if (existingAdoption) {
        // Update existing adoption
        await tx
          .update(curriculumAdoptions)
          .set({
            curriculumId,
            adoptedAt: new Date(),
            adoptedBy: session.userId,
          })
          .where(eq(curriculumAdoptions.id, existingAdoption.id));

        await logUpdateAction(
          session,
          "curriculum_adoptions",
          existingAdoption.id,
          { curriculumId: existingAdoption.curriculumId },
          { curriculumId },
          { throwOnFail: true }
        );
      } else {
        // Create new adoption
        const [newAdoption] = await tx
          .insert(curriculumAdoptions)
          .values({
            schoolYearId,
            gradeLevelId,
            curriculumId,
            adoptedBy: session.userId,
          })
          .returning({ id: curriculumAdoptions.id });

        await logCreateAction(
          session,
          "curriculum_adoptions",
          newAdoption.id,
          { schoolYearId, gradeLevelId, curriculumId },
          { throwOnFail: true }
        );
      }
    });

    invalidateTag(CACHE_TAGS.CURRICULUM_ADOPTIONS);
    invalidateTag(CACHE_TAGS.CURRICULUMS);
    revalidatePath("/staff/academics/curriculums/adoptions");

    return { success: true, message: "Adoption updated successfully." };
  } catch (error) {
    logger.error("[adoption] Failed to update adoption", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Roll Forward Adoptions ─────────────────────────────────────────────────

/**
 * Copies adoptions from one school year to another.
 * Used during school year creation to inherit curriculum assignments.
 *
 * This is exported from a "use server" module, so it is reachable as an RPC
 * endpoint. It requires an authenticated, authorized session and derives the
 * acting user from that session rather than trusting a caller-supplied ID.
 */
export async function rollForwardAdoptionsFromPriorYear(
  fromSchoolYearId: string,
  toSchoolYearId: string
): Promise<{ copied: number; errors: string[] }> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:adopt")) {
    return {
      copied: 0,
      errors: ["You do not have permission to manage curriculum adoptions."],
    };
  }
  const actorId = session.userId;

  const errors: string[] = [];
  let copied = 0;

  try {
    copied = await db.transaction(async (tx) => {
      let copiedInTx = 0;

      // Get all adoptions from the source year
      const sourceAdoptions = await tx.query.curriculumAdoptions.findMany({
        where: eq(curriculumAdoptions.schoolYearId, fromSchoolYearId),
      });

      for (const adoption of sourceAdoptions) {
        // Check if curriculum is still published
        const curriculum = await tx.query.curriculums.findFirst({
          where: eq(curriculums.id, adoption.curriculumId),
          columns: { id: true, status: true, name: true },
        });

        if (!curriculum || curriculum.status !== "published") {
          errors.push(
            `Skipped grade level adoption: curriculum "${curriculum?.name ?? adoption.curriculumId}" is no longer published.`
          );
          continue;
        }

        // Check if adoption already exists in target year
        const existingAdoption = await tx.query.curriculumAdoptions.findFirst({
          where: and(
            eq(curriculumAdoptions.schoolYearId, toSchoolYearId),
            eq(curriculumAdoptions.gradeLevelId, adoption.gradeLevelId)
          ),
        });

        if (existingAdoption) {
          // Skip - already has an adoption
          continue;
        }

        // Create adoption in new year
        await tx.insert(curriculumAdoptions).values({
          schoolYearId: toSchoolYearId,
          gradeLevelId: adoption.gradeLevelId,
          curriculumId: adoption.curriculumId,
          adoptedBy: actorId,
        });

        copiedInTx++;
      }

      if (copiedInTx > 0) {
        await logAudit(
          {
            actor: actorId,
            actorRole: session.role,
            action: "curriculum_adoptions:roll_forward",
            targetEntity: "curriculum_adoptions",
            targetId: toSchoolYearId,
            context: `Copied ${copiedInTx} adoptions from school year ${fromSchoolYearId}`,
          },
          { throwOnFail: true }
        );
      }

      return copiedInTx;
    });

    // Cache invalidation runs only after the transaction commits.
    if (copied > 0) {
      invalidateTag(CACHE_TAGS.CURRICULUM_ADOPTIONS);
    }

    return { copied, errors };
  } catch (error) {
    logger.error("[adoption] Failed to roll forward adoptions", { error });
    return { copied: 0, errors: ["Failed to copy adoptions from prior year."] };
  }
}

// ─── Remove Adoption ────────────────────────────────────────────────────────

export async function removeAdoptionAction(
  adoptionId: string
): Promise<{ success: boolean; message?: string }> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:adopt")) {
    return { success: false, message: "You do not have permission to manage curriculum adoptions." };
  }

  // Validate the incoming ID (reject malformed UUIDs before hitting the DB)
  const idResult = z.string().uuid().safeParse(adoptionId);
  if (!idResult.success) {
    return { success: false, message: "Invalid adoption reference." };
  }

  // Get adoption
  const adoption = await db.query.curriculumAdoptions.findFirst({
    where: eq(curriculumAdoptions.id, idResult.data),
  });

  if (!adoption) {
    return { success: false, message: "Adoption not found." };
  }

  // Check if grades exist
  const gradesExist = await hasGradeRecordsForGradeLevel(
    adoption.schoolYearId,
    adoption.gradeLevelId
  );

  if (gradesExist) {
    return {
      success: false,
      message: "Cannot remove adoption: grade records exist for this school year and grade level.",
    };
  }

  try {
    // TODO(soft-delete): curriculum_adoptions has no deletedAt/deletedBy columns,
    // so this is a hard delete. Converting to soft delete requires a schema
    // migration, a partial (deleted_at IS NULL) unique index on (school_year_id,
    // grade_level_id), and filtering deletedAt in all active-adoption reads.
    // Deferred as a follow-up; the grade-lock guard above already protects
    // adoptions that carry grade history.
    await db
      .delete(curriculumAdoptions)
      .where(eq(curriculumAdoptions.id, idResult.data));

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "curriculum_adoptions:delete",
      targetEntity: "curriculum_adoptions",
      targetId: adoptionId,
      previousState: {
        schoolYearId: adoption.schoolYearId,
        gradeLevelId: adoption.gradeLevelId,
        curriculumId: adoption.curriculumId,
      },
    });

    invalidateTag(CACHE_TAGS.CURRICULUM_ADOPTIONS);
    invalidateTag(CACHE_TAGS.CURRICULUMS);
    revalidatePath("/staff/academics/curriculums/adoptions");

    return { success: true, message: "Adoption removed successfully." };
  } catch (error) {
    logger.error("[adoption] Failed to remove adoption", { error });
    return { success: false, message: "An unexpected error occurred." };
  }
}
