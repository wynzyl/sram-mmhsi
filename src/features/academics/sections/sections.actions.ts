"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { sections } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import {
  createSectionSchema,
  updateSectionSchema,
  deleteSectionSchema,
  type CreateSectionFormState,
  type UpdateSectionFormState,
} from "./sections.schema";
import { getSectionDependencyCounts } from "./sections.queries";

// ─── Create Section ───────────────────────────────────────────────────────────

export async function createSectionAction(
  _prevState: CreateSectionFormState,
  formData: FormData
): Promise<CreateSectionFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:manage")) {
    return { message: "You do not have permission to manage sections." };
  }

  const result = parseFormData(createSectionSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { name, gradeLevelId, schoolYearId } = result.data;

  // Check for duplicate (same name + grade level + school year)
  const existing = await db
    .select({ id: sections.id })
    .from(sections)
    .where(
      and(
        eq(sections.name, name),
        eq(sections.gradeLevelId, gradeLevelId),
        eq(sections.schoolYearId, schoolYearId),
        isNull(sections.deletedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        name: ["A section with this name already exists for this grade level and school year."],
      },
    };
  }

  try {
    const newSectionId = await db.transaction(async (tx) => {
      const [newSection] = await tx
        .insert(sections)
        .values({
          name,
          gradeLevelId,
          schoolYearId,
          createdBy: session.userId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .returning({ id: sections.id });

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "sections:create",
          targetEntity: "sections",
          targetId: newSection.id,
          newState: { name, gradeLevelId, schoolYearId },
        },
        { throwOnFail: true }
      );

      return newSection.id;
    });

    revalidatePath("/staff/academics/sections");
    invalidateTag(CACHE_TAGS.SECTIONS);

    return {
      success: true,
      message: "Section created successfully.",
      sectionId: newSectionId,
    };
  } catch (error) {
    logger.error("[sections] Failed to create section", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Update Section ───────────────────────────────────────────────────────────

export async function updateSectionAction(
  _prevState: UpdateSectionFormState,
  formData: FormData
): Promise<UpdateSectionFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:manage")) {
    return { message: "You do not have permission to manage sections." };
  }

  const result = parseFormData(updateSectionSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { id, name, gradeLevelId, schoolYearId } = result.data;

  // Check for duplicate (excluding self)
  const existing = await db
    .select({ id: sections.id })
    .from(sections)
    .where(
      and(
        eq(sections.name, name),
        eq(sections.gradeLevelId, gradeLevelId),
        eq(sections.schoolYearId, schoolYearId),
        isNull(sections.deletedAt),
        sql`${sections.id} != ${id}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        name: ["A section with this name already exists for this grade level and school year."],
      },
    };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(sections)
        .set({
          name,
          gradeLevelId,
          schoolYearId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        // Never update a missing or soft-deleted section.
        .where(and(eq(sections.id, id), isNull(sections.deletedAt)))
        .returning({ id: sections.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "sections:update",
          targetEntity: "sections",
          targetId: id,
          newState: { name, gradeLevelId, schoolYearId },
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!updated) {
      return { message: "Section not found or has been deleted." };
    }

    revalidatePath("/staff/academics/sections");
    invalidateTag(CACHE_TAGS.SECTIONS);

    return {
      success: true,
      message: "Section updated successfully.",
    };
  } catch (error) {
    logger.error("[sections] Failed to update section", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Delete Section ───────────────────────────────────────────────────────────

export async function deleteSectionAction(
  sectionId: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:manage")) {
    return {
      success: false,
      message: "You do not have permission to manage sections.",
    };
  }

  // Validate the section ID (reject malformed UUIDs before any DB access)
  const idResult = deleteSectionSchema.safeParse({ id: sectionId });
  if (!idResult.success) {
    return { success: false, message: "Invalid section reference." };
  }
  const { id: validSectionId } = idResult.data;

  // Check for dependencies (enrollments and teacher assignments)
  const counts = await getSectionDependencyCounts(validSectionId);

  if (counts.enrollmentCount > 0 || counts.assignmentCount > 0) {
    const parts: string[] = [];
    if (counts.enrollmentCount > 0) {
      parts.push(`${counts.enrollmentCount} enrollment${counts.enrollmentCount > 1 ? "s" : ""}`);
    }
    if (counts.assignmentCount > 0) {
      parts.push(`${counts.assignmentCount} teacher assignment${counts.assignmentCount > 1 ? "s" : ""}`);
    }
    return {
      success: false,
      message: `Cannot delete section with ${parts.join(" and ")}.`,
    };
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      // Soft delete (only an active, non-deleted section is a valid target)
      const rows = await tx
        .update(sections)
        .set({
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(and(eq(sections.id, validSectionId), isNull(sections.deletedAt)))
        .returning({ id: sections.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "sections:delete",
          targetEntity: "sections",
          targetId: validSectionId,
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!deleted) {
      return {
        success: false,
        message: "Section not found or has already been deleted.",
      };
    }

    revalidatePath("/staff/academics/sections");
    invalidateTag(CACHE_TAGS.SECTIONS);

    return {
      success: true,
      message: "Section deleted successfully.",
    };
  } catch (error) {
    logger.error("[sections] Failed to delete section", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
