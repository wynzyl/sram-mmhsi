"use server";

import { db } from "@/lib/db";
import { enrollments } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import {
  assignStudentsToSectionSchema,
  removeFromSectionSchema,
  type AssignStudentsToSectionFormState,
  type RemoveFromSectionFormState,
} from "./section-assignments.schema";
import {
  getEnrollmentGradeLevels,
  getSectionGradeLevelId,
} from "./section-assignments.queries";
import { generateStudentSubjectEnrollmentsAction } from "../student-subject-enrollments";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";

// ─── Assign Students to Section ───────────────────────────────────────────────

/**
 * Bulk assign multiple students to a section.
 * Validates that all selected enrollments are in the same grade level
 * and that the target section belongs to that grade level.
 */
export async function assignStudentsToSectionAction(
  _prevState: AssignStudentsToSectionFormState,
  formData: FormData
): Promise<AssignStudentsToSectionFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:assign")) {
    return { message: PERMISSION_ERRORS.SECTIONS_ASSIGN };
  }

  // Parse enrollmentIds from form data (comes as JSON string)
  const enrollmentIdsRaw = formData.get("enrollmentIds");
  let enrollmentIds: string[] = [];

  if (typeof enrollmentIdsRaw === "string") {
    try {
      enrollmentIds = JSON.parse(enrollmentIdsRaw);
    } catch {
      return { errors: { enrollmentIds: ["Invalid enrollment selection."] } };
    }
  }

  const result = assignStudentsToSectionSchema.safeParse({
    enrollmentIds,
    sectionId: formData.get("sectionId"),
  });

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors as AssignStudentsToSectionFormState["errors"] };
  }

  const { enrollmentIds: validIds, sectionId } = result.data;

  // Validate all enrollments share one grade level AND one school year
  const enrollmentScope = await getEnrollmentGradeLevels(validIds);
  if (!enrollmentScope) {
    return {
      message: "All selected students must be in the same grade level and school year.",
    };
  }

  // Validate section belongs to the same grade level and school year
  const sectionScope = await getSectionGradeLevelId(sectionId);
  if (!sectionScope) {
    return { message: "Selected section not found." };
  }

  if (enrollmentScope.gradeLevelId !== sectionScope.gradeLevelId) {
    return {
      message: "Section must be in the same grade level as the selected students.",
    };
  }

  if (enrollmentScope.schoolYearId !== sectionScope.schoolYearId) {
    return {
      message: "Section must be in the same school year as the selected students.",
    };
  }

  try {
    const assignedCount = await db.transaction(async (tx) => {
      // Update enrollments to assign section
      const updated = await tx
        .update(enrollments)
        .set({
          sectionId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(inArray(enrollments.id, validIds))
        .returning({ id: enrollments.id });

      // Log audit for each assignment
      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "sections:assign",
          targetEntity: "enrollments",
          targetId: sectionId,
          newState: {
            enrollmentIds: validIds,
            count: updated.length,
          },
        },
        { throwOnFail: true }
      );

      return updated.length;
    });

    invalidateTag(CACHE_TAGS.SECTIONS);

    // Generate student subject enrollments for each assigned student
    // This creates SSE records for applicable subject offerings (core + strand-matched electives)
    for (const enrollmentId of validIds) {
      await generateStudentSubjectEnrollmentsAction(enrollmentId);
    }

    invalidateTag(CACHE_TAGS.STUDENT_SUBJECT_ENROLLMENTS);

    return {
      success: true,
      message: `Successfully assigned ${assignedCount} student${assignedCount > 1 ? "s" : ""} to section.`,
      assignedCount,
    };
  } catch (error) {
    logger.error("[section-assignments] Failed to assign students to section", {
      error,
      enrollmentIds: validIds,
      sectionId,
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

// ─── Remove from Section ──────────────────────────────────────────────────────

/**
 * Remove a student's section assignment (set to null).
 */
export async function removeFromSectionAction(
  _prevState: RemoveFromSectionFormState,
  formData: FormData
): Promise<RemoveFromSectionFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:assign")) {
    return { message: PERMISSION_ERRORS.SECTIONS_MANAGE_ASSIGNMENTS };
  }

  const result = parseFormData(removeFromSectionSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { enrollmentId } = result.data;

  try {
    const removed = await db.transaction(async (tx) => {
      // Get current section for audit
      const [current] = await tx
        .select({ sectionId: enrollments.sectionId })
        .from(enrollments)
        .where(eq(enrollments.id, enrollmentId))
        .limit(1);

      if (!current) {
        return null;
      }

      // Update enrollment to remove section
      const [updated] = await tx
        .update(enrollments)
        .set({
          sectionId: null,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(enrollments.id, enrollmentId))
        .returning({ id: enrollments.id });

      if (!updated) {
        return null;
      }

      // Log audit
      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "sections:unassign",
          targetEntity: "enrollments",
          targetId: enrollmentId,
          previousState: { sectionId: current.sectionId },
          newState: { sectionId: null },
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!removed) {
      return { message: "Enrollment not found." };
    }

    invalidateTag(CACHE_TAGS.SECTIONS);

    return {
      success: true,
      message: "Student removed from section.",
    };
  } catch (error) {
    logger.error("[section-assignments] Failed to remove student from section", {
      error,
      enrollmentId,
    });
    return { message: "An unexpected error occurred. Please try again." };
  }
}
