"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  curriculums,
  curriculumAdoptions,
  gradeRecords,
  teacherAssignments,
  subjects,
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
  const existingGrades = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gradeRecords)
    .innerJoin(teacherAssignments, eq(gradeRecords.teacherAssignmentId, teacherAssignments.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .where(
      and(
        eq(gradeRecords.schoolYearId, schoolYearId),
        eq(subjects.gradeLevelId, gradeLevelId)
      )
    );

  const hasGradeRecords = (existingGrades[0]?.count ?? 0) > 0;
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
    if (existingAdoption) {
      // Update existing adoption
      await db
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
      const [newAdoption] = await db
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
 * Internal function to copy adoptions from one school year to another.
 * Used during school year creation to inherit curriculum assignments.
 */
export async function rollForwardAdoptionsFromPriorYear(
  fromSchoolYearId: string,
  toSchoolYearId: string,
  actorId: string
): Promise<{ copied: number; errors: string[] }> {
  const errors: string[] = [];
  let copied = 0;

  try {
    // Get all adoptions from the source year
    const sourceAdoptions = await db.query.curriculumAdoptions.findMany({
      where: eq(curriculumAdoptions.schoolYearId, fromSchoolYearId),
    });

    for (const adoption of sourceAdoptions) {
      // Check if curriculum is still published
      const curriculum = await db.query.curriculums.findFirst({
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
      const existingAdoption = await db.query.curriculumAdoptions.findFirst({
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
      await db.insert(curriculumAdoptions).values({
        schoolYearId: toSchoolYearId,
        gradeLevelId: adoption.gradeLevelId,
        curriculumId: adoption.curriculumId,
        adoptedBy: actorId,
      });

      copied++;
    }

    if (copied > 0) {
      await logAudit({
        actor: actorId,
        actorRole: "system",
        action: "curriculum_adoptions:roll_forward",
        targetEntity: "curriculum_adoptions",
        targetId: toSchoolYearId,
        context: `Copied ${copied} adoptions from school year ${fromSchoolYearId}`,
      });

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

  // Get adoption
  const adoption = await db.query.curriculumAdoptions.findFirst({
    where: eq(curriculumAdoptions.id, adoptionId),
  });

  if (!adoption) {
    return { success: false, message: "Adoption not found." };
  }

  // Check if grades exist
  const existingGrades = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(gradeRecords)
    .innerJoin(teacherAssignments, eq(gradeRecords.teacherAssignmentId, teacherAssignments.id))
    .innerJoin(subjects, eq(teacherAssignments.subjectId, subjects.id))
    .where(
      and(
        eq(gradeRecords.schoolYearId, adoption.schoolYearId),
        eq(subjects.gradeLevelId, adoption.gradeLevelId)
      )
    );

  if ((existingGrades[0]?.count ?? 0) > 0) {
    return {
      success: false,
      message: "Cannot remove adoption: grade records exist for this school year and grade level.",
    };
  }

  try {
    await db
      .delete(curriculumAdoptions)
      .where(eq(curriculumAdoptions.id, adoptionId));

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
