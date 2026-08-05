"use server";

import { db } from "@/lib/db";
import {
  curriculums,
  curriculumAdoptions,
  subjects,
  schoolYears,
} from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logCreateAction, logUpdateAction, logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import {
  CreateCurriculumSchema,
  UpdateCurriculumMetaSchema,
  CloneCurriculumSchema,
  PublishCurriculumSchema,
  ArchiveCurriculumSchema,
  type CreateCurriculumFormState,
  type UpdateCurriculumMetaFormState,
  type CloneCurriculumFormState,
  type PublishCurriculumFormState,
  type ArchiveCurriculumFormState,
} from "./curriculums.schema";
import {
  prepareSubjectsForClone,
  getNextVersion,
  generateDraftName,
} from "./curriculum-clone";
import { validatePublishPreflight } from "./curriculum-preflight";
import { checkArchiveEligibility, type AdoptionTiming } from "./archive-guard";
import {
  isCurriculumNameTaken,
  getPublishedCurriculumNames,
  getActiveSchoolYear,
} from "./curriculums.queries";

// ─── Create Curriculum ──────────────────────────────────────────────────────

export async function createCurriculumAction(
  _prevState: CreateCurriculumFormState,
  formData: FormData
): Promise<CreateCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:create")) {
    return { message: "You do not have permission to create curriculums." };
  }

  const result = parseFormData(CreateCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { name, description } = result.data;

  // Check name uniqueness
  if (await isCurriculumNameTaken(name)) {
    return { errors: { name: ["A curriculum with this name already exists."] } };
  }

  try {
    const newCurriculumId = await db.transaction(async (tx) => {
      const [newCurriculum] = await tx
        .insert(curriculums)
        .values({
          name,
          description: description ?? null,
          status: "draft",
          version: 1,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: curriculums.id });

      // Set rootId to self (this is v1 of its own chain)
      await tx
        .update(curriculums)
        .set({ rootId: newCurriculum.id })
        .where(eq(curriculums.id, newCurriculum.id));

      await logCreateAction(
        session,
        "curriculums",
        newCurriculum.id,
        { name, description },
        { throwOnFail: true }
      );

      return newCurriculum.id;
    });

    // Cache invalidation runs only after the transaction commits.
    invalidateTag(CACHE_TAGS.CURRICULUMS);
    invalidateTag(CACHE_TAGS.CURRICULUMS);

    return { success: true, curriculumId: newCurriculumId };
  } catch (error) {
    logger.error("[curriculums] Failed to create curriculum", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Update Curriculum Meta ─────────────────────────────────────────────────

export async function updateCurriculumMetaAction(
  _prevState: UpdateCurriculumMetaFormState,
  formData: FormData
): Promise<UpdateCurriculumMetaFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:edit")) {
    return { message: "You do not have permission to edit curriculums." };
  }

  const result = parseFormData(UpdateCurriculumMetaSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { curriculumId, name, description } = result.data;

  // Verify curriculum exists and is a draft
  const existing = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, curriculumId),
    columns: { id: true, status: true, name: true },
  });

  if (!existing) {
    return { message: "Curriculum not found." };
  }

  if (existing.status !== "draft") {
    return { message: "Only draft curriculums can be edited." };
  }

  // Check name uniqueness (excluding self)
  if (name !== existing.name && (await isCurriculumNameTaken(name, curriculumId))) {
    return { errors: { name: ["A curriculum with this name already exists."] } };
  }

  try {
    await db
      .update(curriculums)
      .set({
        name,
        description: description ?? null,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(curriculums.id, curriculumId));

    await logUpdateAction(
      session,
      "curriculums",
      curriculumId,
      { name: existing.name },
      { name, description },
      { throwOnFail: true }
    );

    invalidateTag(CACHE_TAGS.CURRICULUMS);

    return { success: true, message: "Curriculum updated successfully." };
  } catch (error) {
    logger.error("[curriculums] Failed to update curriculum", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Clone Curriculum ───────────────────────────────────────────────────────

export async function cloneCurriculumAction(
  _prevState: CloneCurriculumFormState,
  formData: FormData
): Promise<CloneCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:edit")) {
    return { message: "You do not have permission to clone curriculums." };
  }

  const result = parseFormData(CloneCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { sourceCurriculumId, name: customName } = result.data;

  // Get source curriculum
  const source = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, sourceCurriculumId),
    columns: {
      id: true,
      name: true,
      description: true,
      status: true,
      rootId: true,
      version: true,
    },
  });

  if (!source) {
    return { message: "Source curriculum not found." };
  }

  if (source.status === "draft") {
    return { message: "Cannot clone a draft curriculum. Publish it first." };
  }

  // Check if there's already a draft from this source
  const existingDraft = await db.query.curriculums.findFirst({
    where: and(
      eq(curriculums.predecessorId, sourceCurriculumId),
      eq(curriculums.status, "draft")
    ),
  });

  if (existingDraft) {
    return {
      message: "A draft already exists from this curriculum. Edit the existing draft instead.",
    };
  }

  // Get version chain to determine next version number
  const chainVersions = await db
    .select({ version: curriculums.version })
    .from(curriculums)
    .where(eq(curriculums.rootId, source.rootId ?? source.id));

  const nextVersion = getNextVersion(chainVersions.map((c) => c.version));

  // Generate name
  const draftName = customName || generateDraftName(source.name, nextVersion);

  // Check name uniqueness
  if (await isCurriculumNameTaken(draftName)) {
    return { errors: { name: ["A curriculum with this name already exists."] } };
  }

  try {
    // Get source subjects (read is safe outside the transaction)
    const sourceSubjects = await db.query.subjects.findMany({
      where: and(
        eq(subjects.curriculumId, sourceCurriculumId),
        isNull(subjects.deletedAt)
      ),
    });
    const subjectsToClone = prepareSubjectsForClone(sourceSubjects);

    const newCurriculumId = await db.transaction(async (tx) => {
      // Create new draft
      const [newCurriculum] = await tx
        .insert(curriculums)
        .values({
          name: draftName,
          description: source.description,
          status: "draft",
          version: nextVersion,
          rootId: source.rootId ?? source.id,
          predecessorId: source.id,
          createdBy: session.userId,
          updatedBy: session.userId,
        })
        .returning({ id: curriculums.id });

      // Clone subjects
      if (subjectsToClone.length > 0) {
        await tx.insert(subjects).values(
          subjectsToClone.map((s) => ({
            ...s,
            curriculumId: newCurriculum.id,
            createdBy: session.userId,
            updatedBy: session.userId,
          }))
        );
      }

      await logCreateAction(
        session,
        "curriculums",
        newCurriculum.id,
        {
          clonedFrom: sourceCurriculumId,
          name: draftName,
          version: nextVersion,
          subjectsCloned: subjectsToClone.length,
        },
        { throwOnFail: true }
      );

      return newCurriculum.id;
    });

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    invalidateTag(CACHE_TAGS.CURRICULUMS);

    return { success: true, curriculumId: newCurriculumId };
  } catch (error) {
    logger.error("[curriculums] Failed to clone curriculum", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Publish Curriculum ─────────────────────────────────────────────────────

export async function publishCurriculumAction(
  _prevState: PublishCurriculumFormState,
  formData: FormData
): Promise<PublishCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:publish")) {
    return { message: "You do not have permission to publish curriculums." };
  }

  const result = parseFormData(PublishCurriculumSchema, formData, {
    arrayFields: ["adoptForGradeLevels"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const { curriculumId, adoptForGradeLevels, schoolYearId } = result.data;

  // Verify curriculum exists and is a draft
  const curriculum = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, curriculumId),
    columns: { id: true, status: true, name: true },
  });

  if (!curriculum) {
    return { message: "Curriculum not found." };
  }

  if (curriculum.status !== "draft") {
    return { message: "Only draft curriculums can be published." };
  }

  // Get subjects for preflight
  const curriculumSubjects = await db
    .select({
      id: subjects.id,
      code: subjects.code,
      gradeLevelId: subjects.gradeLevelId,
    })
    .from(subjects)
    .innerJoin(
      sql`grade_levels`,
      eq(subjects.gradeLevelId, sql`grade_levels.id`)
    )
    .where(and(eq(subjects.curriculumId, curriculumId), isNull(subjects.deletedAt)));

  // Run preflight validation
  const publishedNames = await getPublishedCurriculumNames();
  const preflight = validatePublishPreflight(
    curriculum.status,
    curriculumSubjects.map((s) => ({
      ...s,
      gradeLevelName: "", // Will be filled by the validation
    })),
    adoptForGradeLevels
  );

  if (!preflight.canPublish) {
    return { message: preflight.errors.join(" ") };
  }

  // Validate name uniqueness among published
  if (publishedNames.some((n) => n.toLowerCase() === curriculum.name.toLowerCase())) {
    return { message: "A published curriculum with this name already exists." };
  }

  // Fail closed: never publish while silently skipping requested adoptions.
  if (adoptForGradeLevels && adoptForGradeLevels.length > 0 && !schoolYearId) {
    return {
      errors: {
        schoolYearId: ["A school year is required to adopt this curriculum."],
      },
    };
  }

  try {
    await db.transaction(async (tx) => {
      // Publish the curriculum
      await tx
        .update(curriculums)
        .set({
          status: "published",
          publishedAt: new Date(),
          publishedBy: session.userId,
          updatedAt: new Date(),
          updatedBy: session.userId,
        })
        .where(eq(curriculums.id, curriculumId));

      // Create adoptions if requested
      if (adoptForGradeLevels && adoptForGradeLevels.length > 0 && schoolYearId) {
        for (const gradeLevelId of adoptForGradeLevels) {
          // Upsert adoption (replace existing if any)
          await tx
            .insert(curriculumAdoptions)
            .values({
              schoolYearId,
              gradeLevelId,
              curriculumId,
              adoptedBy: session.userId,
            })
            .onConflictDoUpdate({
              target: [curriculumAdoptions.schoolYearId, curriculumAdoptions.gradeLevelId],
              // The unique index is partial (deleted_at IS NULL); the conflict
              // arbiter must carry the same predicate to match it.
              targetWhere: isNull(curriculumAdoptions.deletedAt),
              set: {
                curriculumId,
                adoptedAt: new Date(),
                adoptedBy: session.userId,
              },
            });
        }
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "curriculums:publish",
          targetEntity: "curriculums",
          targetId: curriculumId,
          newState: {
            adoptedFor: adoptForGradeLevels?.length ?? 0,
            schoolYearId,
          },
        },
        { throwOnFail: true }
      );
    });

    invalidateTag(CACHE_TAGS.CURRICULUMS);
    invalidateTag(CACHE_TAGS.CURRICULUM_ADOPTIONS);

    return { success: true, message: "Curriculum published successfully." };
  } catch (error) {
    logger.error("[curriculums] Failed to publish curriculum", { error });
    return { message: "An unexpected error occurred." };
  }
}

// ─── Archive Curriculum ─────────────────────────────────────────────────────

/**
 * Classifies an adoption's timing relative to the active school year.
 * Returns `"unknown"` (which blocks archival) when timing cannot be determined —
 * e.g. a non-active adoption with no active-year reference point to compare against.
 * Never silently classifies undetermined timing as historical.
 */
function classifyAdoptionTiming(
  isActive: boolean,
  schoolYearStartDate: string | Date | null,
  activeStart: number | null
): AdoptionTiming {
  if (isActive) return "active";
  // Without a reference point, non-active adoptions cannot be classified.
  if (activeStart === null) return "unknown";
  const startMs =
    schoolYearStartDate != null ? new Date(schoolYearStartDate).getTime() : NaN;
  if (Number.isNaN(startMs)) return "unknown";
  return startMs > activeStart ? "future" : "historical";
}

export async function archiveCurriculumAction(
  _prevState: ArchiveCurriculumFormState,
  formData: FormData
): Promise<ArchiveCurriculumFormState> {
  const session = await requireSession();
  if (!hasPermission(session.role, "curriculums:archive")) {
    return { message: "You do not have permission to archive curriculums." };
  }

  const result = parseFormData(ArchiveCurriculumSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { curriculumId, confirmName } = result.data;

  // Get curriculum
  const curriculum = await db.query.curriculums.findFirst({
    where: eq(curriculums.id, curriculumId),
    columns: { id: true, name: true, status: true },
  });

  if (!curriculum) {
    return { message: "Curriculum not found." };
  }

  // Verify confirmation name matches
  if (confirmName.trim().toLowerCase() !== curriculum.name.toLowerCase()) {
    return { errors: { confirmName: ["Name does not match. Please type the exact curriculum name."] } };
  }

  // Get adoptions (include the school year's start date so we can classify
  // future vs past adoptions for the archive guard).
  const adoptions = await db
    .select({
      schoolYearId: curriculumAdoptions.schoolYearId,
      schoolYearLabel: schoolYears.label,
      schoolYearStartDate: schoolYears.startDate,
      gradeLevelId: curriculumAdoptions.gradeLevelId,
      isActive: schoolYears.isActive,
    })
    .from(curriculumAdoptions)
    .innerJoin(schoolYears, eq(curriculumAdoptions.schoolYearId, schoolYears.id))
    .innerJoin(sql`grade_levels`, eq(curriculumAdoptions.gradeLevelId, sql`grade_levels.id`))
    .where(
      and(
        eq(curriculumAdoptions.curriculumId, curriculumId),
        isNull(curriculumAdoptions.deletedAt)
      )
    );

  const activeSchoolYear = await getActiveSchoolYear();
  // Reference point: the active year's start. Adoptions for years starting after
  // it are "future"; before it are "historical". Without a reference point we
  // cannot classify non-active adoptions — those are "unknown" and block archival.
  const activeStart = activeSchoolYear?.startDate
    ? new Date(activeSchoolYear.startDate).getTime()
    : null;

  // Check archive eligibility
  const guardResult = checkArchiveEligibility(
    curriculum.status,
    adoptions.map((a) => ({
      schoolYearId: a.schoolYearId,
      schoolYearLabel: a.schoolYearLabel,
      gradeLevelId: a.gradeLevelId,
      gradeLevelName: "", // Not needed for check
      timing: classifyAdoptionTiming(a.isActive, a.schoolYearStartDate, activeStart),
    })),
    activeSchoolYear?.id ?? null
  );

  if (!guardResult.canArchive) {
    return { message: guardResult.blockers.join(" ") };
  }

  try {
    await db
      .update(curriculums)
      .set({
        status: "archived",
        archivedAt: new Date(),
        archivedBy: session.userId,
        updatedAt: new Date(),
        updatedBy: session.userId,
      })
      .where(eq(curriculums.id, curriculumId));

    await logAudit({
      actor: session.userId,
      actorRole: session.role,
      action: "curriculums:archive",
      targetEntity: "curriculums",
      targetId: curriculumId,
      previousState: { status: curriculum.status },
      newState: { status: "archived" },
    });

    invalidateTag(CACHE_TAGS.CURRICULUMS);

    return { success: true, message: "Curriculum archived successfully." };
  } catch (error) {
    logger.error("[curriculums] Failed to archive curriculum", { error });
    return { message: "An unexpected error occurred." };
  }
}
