"use server";

import { db } from "@/lib/db";
import { scheduleSlots, subjectOfferings } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { logAudit } from "@/lib/utils/audit-logger";
import { parseFormData } from "@/lib/utils/form-validation";
import { revalidatePath } from "next/cache";
import { invalidateTag, CACHE_TAGS } from "@/lib/cache/cache-tags";
import { logger } from "@/lib/observability/logger";
import { PERMISSION_ERRORS } from "@/lib/constants/error-messages";
import {
  createScheduleSlotSchema,
  updateScheduleSlotSchema,
  deleteScheduleSlotSchema,
  type CreateScheduleSlotFormState,
  type UpdateScheduleSlotFormState,
  type DayOfWeek,
} from "../schedules.schema";
import { checkScheduleConflicts } from "../queries";

// ─── Schedule Slot Actions ────────────────────────────────────────────────────

export async function createScheduleSlotAction(
  _prevState: CreateScheduleSlotFormState,
  formData: FormData
): Promise<CreateScheduleSlotFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE };
  }

  const result = parseFormData(createScheduleSlotSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { subjectOfferingId, dayOfWeek, periodId, roomId } = result.data;

  // Get subject offering details (for denormalized fields)
  const offering = await db
    .select({
      sectionId: subjectOfferings.sectionId,
      teacherId: subjectOfferings.teacherId,
      schoolYearId: subjectOfferings.schoolYearId,
    })
    .from(subjectOfferings)
    .where(
      and(eq(subjectOfferings.id, subjectOfferingId), isNull(subjectOfferings.deletedAt))
    )
    .limit(1);

  if (offering.length === 0) {
    return { message: "Subject offering not found." };
  }

  const { sectionId, teacherId, schoolYearId } = offering[0];

  // Check for conflicts
  const conflicts = await checkScheduleConflicts({
    dayOfWeek: dayOfWeek as DayOfWeek,
    periodId,
    schoolYearId,
    sectionId,
    teacherId,
    roomId: roomId ?? null,
  });

  if (conflicts.length > 0) {
    return {
      message: "Schedule conflict detected.",
      conflicts,
    };
  }

  try {
    const newSlotId = await db.transaction(async (tx) => {
      const [newSlot] = await tx
        .insert(scheduleSlots)
        .values({
          subjectOfferingId,
          dayOfWeek: dayOfWeek as DayOfWeek,
          periodId,
          roomId: roomId ?? null,
          schoolYearId,
          sectionId,
          teacherId,
          createdBy: session.userId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .returning({ id: scheduleSlots.id });

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:create_slot",
          targetEntity: "schedule_slots",
          targetId: newSlot.id,
          newState: { subjectOfferingId, dayOfWeek, periodId, roomId, sectionId },
        },
        { throwOnFail: true }
      );

      return newSlot.id;
    });

    revalidatePath("/staff/academics/schedules");
    invalidateTag(CACHE_TAGS.SCHEDULES);

    return {
      success: true,
      message: "Schedule slot created successfully.",
      slotId: newSlotId,
    };
  } catch (error) {
    // Check for unique constraint violation (conflict at DB level)
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      return {
        message: "A schedule conflict was detected. Please try a different time slot.",
      };
    }
    logger.error("[schedules] Failed to create schedule slot", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function updateScheduleSlotAction(
  _prevState: UpdateScheduleSlotFormState,
  formData: FormData
): Promise<UpdateScheduleSlotFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE };
  }

  const result = parseFormData(updateScheduleSlotSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { id, subjectOfferingId, dayOfWeek, periodId, roomId } = result.data;

  // Get subject offering details
  const offering = await db
    .select({
      sectionId: subjectOfferings.sectionId,
      teacherId: subjectOfferings.teacherId,
      schoolYearId: subjectOfferings.schoolYearId,
    })
    .from(subjectOfferings)
    .where(
      and(eq(subjectOfferings.id, subjectOfferingId), isNull(subjectOfferings.deletedAt))
    )
    .limit(1);

  if (offering.length === 0) {
    return { message: "Subject offering not found." };
  }

  const { sectionId, teacherId, schoolYearId } = offering[0];

  // Check for conflicts (excluding self)
  const conflicts = await checkScheduleConflicts({
    dayOfWeek: dayOfWeek as DayOfWeek,
    periodId,
    schoolYearId,
    sectionId,
    teacherId,
    roomId: roomId ?? null,
    excludeSlotId: id,
  });

  if (conflicts.length > 0) {
    return {
      message: "Schedule conflict detected.",
      conflicts,
    };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(scheduleSlots)
        .set({
          subjectOfferingId,
          dayOfWeek: dayOfWeek as DayOfWeek,
          periodId,
          roomId: roomId ?? null,
          schoolYearId,
          sectionId,
          teacherId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(scheduleSlots.id, id), isNull(scheduleSlots.deletedAt)))
        .returning({ id: scheduleSlots.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:update_slot",
          targetEntity: "schedule_slots",
          targetId: id,
          newState: { subjectOfferingId, dayOfWeek, periodId, roomId, sectionId },
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!updated) {
      return { message: "Schedule slot not found or has been deleted." };
    }

    revalidatePath("/staff/academics/schedules");
    invalidateTag(CACHE_TAGS.SCHEDULES);

    return {
      success: true,
      message: "Schedule slot updated successfully.",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("unique constraint")
    ) {
      return {
        message: "A schedule conflict was detected. Please try a different time slot.",
      };
    }
    logger.error("[schedules] Failed to update schedule slot", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteScheduleSlotAction(
  slotId: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage")) {
    return {
      success: false,
      message: PERMISSION_ERRORS.SCHEDULES_MANAGE,
    };
  }

  const idResult = deleteScheduleSlotSchema.safeParse({ id: slotId });
  if (!idResult.success) {
    return { success: false, message: "Invalid slot reference." };
  }
  const { id: validSlotId } = idResult.data;

  try {
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .update(scheduleSlots)
        .set({
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(and(eq(scheduleSlots.id, validSlotId), isNull(scheduleSlots.deletedAt)))
        .returning({ id: scheduleSlots.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:delete_slot",
          targetEntity: "schedule_slots",
          targetId: validSlotId,
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!deleted) {
      return {
        success: false,
        message: "Schedule slot not found or has already been deleted.",
      };
    }

    revalidatePath("/staff/academics/schedules");
    invalidateTag(CACHE_TAGS.SCHEDULES);

    return {
      success: true,
      message: "Schedule slot deleted successfully.",
    };
  } catch (error) {
    logger.error("[schedules] Failed to delete schedule slot", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}
