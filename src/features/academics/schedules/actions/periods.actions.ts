"use server";

import { db } from "@/lib/db";
import { periods } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { revalidatePath } from "next/cache";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import {
  createPeriodSchema,
  updatePeriodSchema,
  deletePeriodSchema,
  type CreatePeriodFormState,
  type UpdatePeriodFormState,
} from "../schedules.schema";
import { getPeriodSlotCount } from "../queries";

// ─── Period Actions ──────────────────────────────────────────────────────────

export async function createPeriodAction(
  _prevState: CreatePeriodFormState,
  formData: FormData
): Promise<CreatePeriodFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_periods")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE_PERIODS };
  }

  const result = parseFormData(createPeriodSchema, formData, {
    booleanFields: ["isClassPeriod"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const { schoolYearId, name, periodNumber, startTime, endTime, isClassPeriod, gradeGroup, gradeLevelId } =
    result.data;

  // Check for duplicate (same school year + period number + grade group + grade level)
  const existing = await db
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.periodNumber, periodNumber),
        gradeGroup
          ? eq(periods.gradeGroup, gradeGroup)
          : isNull(periods.gradeGroup),
        gradeLevelId
          ? eq(periods.gradeLevelId, gradeLevelId)
          : isNull(periods.gradeLevelId),
        isNull(periods.deletedAt)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        periodNumber: [
          "A period with this number already exists for this school year and grade assignment.",
        ],
      },
    };
  }

  try {
    const newPeriodId = await db.transaction(async (tx) => {
      const [newPeriod] = await tx
        .insert(periods)
        .values({
          schoolYearId,
          name,
          periodNumber,
          startTime,
          endTime,
          isClassPeriod: isClassPeriod ?? true,
          gradeGroup: gradeGroup ?? null,
          gradeLevelId: gradeLevelId ?? null,
          createdBy: session.userId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .returning({ id: periods.id });

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:create_period",
          targetEntity: "periods",
          targetId: newPeriod.id,
          newState: { name, periodNumber, startTime, endTime, gradeGroup, gradeLevelId },
        },
        { throwOnFail: true }
      );

      return newPeriod.id;
    });

    revalidatePath("/staff/academics/schedules/periods");
    invalidateTag(CACHE_TAGS.PERIODS);

    return {
      success: true,
      message: "Period created successfully.",
      periodId: newPeriodId,
    };
  } catch (error) {
    logger.error("[schedules] Failed to create period", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function updatePeriodAction(
  _prevState: UpdatePeriodFormState,
  formData: FormData
): Promise<UpdatePeriodFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_periods")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE_PERIODS };
  }

  const result = parseFormData(updatePeriodSchema, formData, {
    booleanFields: ["isClassPeriod"],
  });
  if (!result.success) {
    return { errors: result.errors };
  }

  const { id, schoolYearId, name, periodNumber, startTime, endTime, isClassPeriod, gradeGroup, gradeLevelId } =
    result.data;

  // Check for duplicate (excluding self)
  const existing = await db
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.periodNumber, periodNumber),
        gradeGroup
          ? eq(periods.gradeGroup, gradeGroup)
          : isNull(periods.gradeGroup),
        gradeLevelId
          ? eq(periods.gradeLevelId, gradeLevelId)
          : isNull(periods.gradeLevelId),
        isNull(periods.deletedAt),
        sql`${periods.id} != ${id}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        periodNumber: [
          "A period with this number already exists for this school year and grade assignment.",
        ],
      },
    };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(periods)
        .set({
          name,
          periodNumber,
          startTime,
          endTime,
          isClassPeriod: isClassPeriod ?? true,
          gradeGroup: gradeGroup ?? null,
          gradeLevelId: gradeLevelId ?? null,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(periods.id, id), isNull(periods.deletedAt)))
        .returning({ id: periods.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:update_period",
          targetEntity: "periods",
          targetId: id,
          newState: { name, periodNumber, startTime, endTime, gradeGroup, gradeLevelId },
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!updated) {
      return { message: "Period not found or has been deleted." };
    }

    revalidatePath("/staff/academics/schedules/periods");
    invalidateTag(CACHE_TAGS.PERIODS);

    return {
      success: true,
      message: "Period updated successfully.",
    };
  } catch (error) {
    logger.error("[schedules] Failed to update period", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function deletePeriodAction(
  periodId: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_periods")) {
    return {
      success: false,
      message: PERMISSION_ERRORS.SCHEDULES_MANAGE_PERIODS,
    };
  }

  const idResult = deletePeriodSchema.safeParse({ id: periodId });
  if (!idResult.success) {
    return { success: false, message: "Invalid period reference." };
  }
  const { id: validPeriodId } = idResult.data;

  // Check for schedule slots using this period
  const slotCount = await getPeriodSlotCount(validPeriodId);
  if (slotCount > 0) {
    return {
      success: false,
      message: `Cannot delete period with ${slotCount} schedule slot${slotCount > 1 ? "s" : ""}.`,
    };
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .update(periods)
        .set({
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(and(eq(periods.id, validPeriodId), isNull(periods.deletedAt)))
        .returning({ id: periods.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:delete_period",
          targetEntity: "periods",
          targetId: validPeriodId,
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!deleted) {
      return {
        success: false,
        message: "Period not found or has already been deleted.",
      };
    }

    revalidatePath("/staff/academics/schedules/periods");
    invalidateTag(CACHE_TAGS.PERIODS);

    return {
      success: true,
      message: "Period deleted successfully.",
    };
  } catch (error) {
    logger.error("[schedules] Failed to delete period", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Toggle period active status.
 */
export async function togglePeriodActiveAction(
  periodId: string
): Promise<{ success: boolean; message: string; isActive?: boolean }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_periods")) {
    return {
      success: false,
      message: PERMISSION_ERRORS.SCHEDULES_MANAGE_PERIODS,
    };
  }

  const idResult = deletePeriodSchema.safeParse({ id: periodId });
  if (!idResult.success) {
    return { success: false, message: "Invalid period reference." };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Get current state
      const current = await tx
        .select({ id: periods.id, isActive: periods.isActive })
        .from(periods)
        .where(and(eq(periods.id, periodId), isNull(periods.deletedAt)))
        .limit(1);

      if (current.length === 0) {
        return null;
      }

      const newIsActive = !current[0].isActive;

      await tx
        .update(periods)
        .set({
          isActive: newIsActive,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(periods.id, periodId));

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: newIsActive
            ? "schedules:activate_period"
            : "schedules:deactivate_period",
          targetEntity: "periods",
          targetId: periodId,
          newState: { isActive: newIsActive },
        },
        { throwOnFail: true }
      );

      return newIsActive;
    });

    if (result === null) {
      return {
        success: false,
        message: "Period not found or has been deleted.",
      };
    }

    revalidatePath("/staff/academics/schedules/periods");
    invalidateTag(CACHE_TAGS.PERIODS);

    return {
      success: true,
      message: result ? "Period activated." : "Period deactivated.",
      isActive: result,
    };
  } catch (error) {
    logger.error("[schedules] Failed to toggle period active", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

