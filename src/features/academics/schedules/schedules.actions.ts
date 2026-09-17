"use server";

import { db } from "@/lib/db";
import { periods, rooms, scheduleSlots, subjectOfferings } from "@/lib/db/schema";
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
  createRoomSchema,
  updateRoomSchema,
  deleteRoomSchema,
  createScheduleSlotSchema,
  updateScheduleSlotSchema,
  deleteScheduleSlotSchema,
  type CreatePeriodFormState,
  type UpdatePeriodFormState,
  type CreateRoomFormState,
  type UpdateRoomFormState,
  type CreateScheduleSlotFormState,
  type UpdateScheduleSlotFormState,
  type DayOfWeek,
} from "./schedules.schema";
import {
  getPeriodSlotCount,
  getRoomSlotCount,
  checkScheduleConflicts,
} from "./schedules.queries";

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

  const { schoolYearId, name, periodNumber, startTime, endTime, isClassPeriod, gradeLevelId } =
    result.data;

  // Check for duplicate (same school year + period number + grade level)
  const existing = await db
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.periodNumber, periodNumber),
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
          "A period with this number already exists for this school year and grade level.",
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
          newState: { name, periodNumber, startTime, endTime, gradeLevelId },
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

  const { id, schoolYearId, name, periodNumber, startTime, endTime, isClassPeriod, gradeLevelId } =
    result.data;

  // Check for duplicate (excluding self)
  const existing = await db
    .select({ id: periods.id })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.periodNumber, periodNumber),
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
          "A period with this number already exists for this school year and grade level.",
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
          newState: { name, periodNumber, startTime, endTime, gradeLevelId },
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

// ─── Room Actions ────────────────────────────────────────────────────────────

export async function createRoomAction(
  _prevState: CreateRoomFormState,
  formData: FormData
): Promise<CreateRoomFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_rooms")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE_ROOMS };
  }

  const result = parseFormData(createRoomSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { code, name, building, floor, capacity, roomType } = result.data;

  // Check for duplicate code
  const existing = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.code, code.toUpperCase()), isNull(rooms.deletedAt)))
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        code: ["A room with this code already exists."],
      },
    };
  }

  try {
    const newRoomId = await db.transaction(async (tx) => {
      const [newRoom] = await tx
        .insert(rooms)
        .values({
          code: code.toUpperCase(),
          name,
          building: building || null,
          floor: floor || null,
          capacity: capacity || null,
          roomType: roomType ?? "classroom",
          createdBy: session.userId,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .returning({ id: rooms.id });

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:create_room",
          targetEntity: "rooms",
          targetId: newRoom.id,
          newState: { code, name, building, floor, capacity, roomType },
        },
        { throwOnFail: true }
      );

      return newRoom.id;
    });

    revalidatePath("/staff/academics/schedules/rooms");
    invalidateTag(CACHE_TAGS.ROOMS);

    return {
      success: true,
      message: "Room created successfully.",
      roomId: newRoomId,
    };
  } catch (error) {
    logger.error("[schedules] Failed to create room", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function updateRoomAction(
  _prevState: UpdateRoomFormState,
  formData: FormData
): Promise<UpdateRoomFormState> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_rooms")) {
    return { message: PERMISSION_ERRORS.SCHEDULES_MANAGE_ROOMS };
  }

  const result = parseFormData(updateRoomSchema, formData);
  if (!result.success) {
    return { errors: result.errors };
  }

  const { id, code, name, building, floor, capacity, roomType } = result.data;

  // Check for duplicate code (excluding self)
  const existing = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.code, code.toUpperCase()),
        isNull(rooms.deletedAt),
        sql`${rooms.id} != ${id}`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return {
      errors: {
        code: ["A room with this code already exists."],
      },
    };
  }

  try {
    const updated = await db.transaction(async (tx) => {
      const rows = await tx
        .update(rooms)
        .set({
          code: code.toUpperCase(),
          name,
          building: building || null,
          floor: floor || null,
          capacity: capacity || null,
          roomType: roomType ?? "classroom",
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(rooms.id, id), isNull(rooms.deletedAt)))
        .returning({ id: rooms.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:update_room",
          targetEntity: "rooms",
          targetId: id,
          newState: { code, name, building, floor, capacity, roomType },
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!updated) {
      return { message: "Room not found or has been deleted." };
    }

    revalidatePath("/staff/academics/schedules/rooms");
    invalidateTag(CACHE_TAGS.ROOMS);

    return {
      success: true,
      message: "Room updated successfully.",
    };
  } catch (error) {
    logger.error("[schedules] Failed to update room", { error });
    return { message: "An unexpected error occurred. Please try again." };
  }
}

export async function deleteRoomAction(
  roomId: string
): Promise<{ success: boolean; message: string }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_rooms")) {
    return {
      success: false,
      message: PERMISSION_ERRORS.SCHEDULES_MANAGE_ROOMS,
    };
  }

  const idResult = deleteRoomSchema.safeParse({ id: roomId });
  if (!idResult.success) {
    return { success: false, message: "Invalid room reference." };
  }
  const { id: validRoomId } = idResult.data;

  // Check for schedule slots using this room
  const slotCount = await getRoomSlotCount(validRoomId);
  if (slotCount > 0) {
    return {
      success: false,
      message: `Cannot delete room with ${slotCount} schedule slot${slotCount > 1 ? "s" : ""}.`,
    };
  }

  try {
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .update(rooms)
        .set({
          deletedAt: new Date(),
          deletedBy: session.userId,
        })
        .where(and(eq(rooms.id, validRoomId), isNull(rooms.deletedAt)))
        .returning({ id: rooms.id });

      if (rows.length === 0) {
        return false;
      }

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: "schedules:delete_room",
          targetEntity: "rooms",
          targetId: validRoomId,
        },
        { throwOnFail: true }
      );

      return true;
    });

    if (!deleted) {
      return {
        success: false,
        message: "Room not found or has already been deleted.",
      };
    }

    revalidatePath("/staff/academics/schedules/rooms");
    invalidateTag(CACHE_TAGS.ROOMS);

    return {
      success: true,
      message: "Room deleted successfully.",
    };
  } catch (error) {
    logger.error("[schedules] Failed to delete room", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Toggle room active status.
 */
export async function toggleRoomActiveAction(
  roomId: string
): Promise<{ success: boolean; message: string; isActive?: boolean }> {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_rooms")) {
    return {
      success: false,
      message: PERMISSION_ERRORS.SCHEDULES_MANAGE_ROOMS,
    };
  }

  const idResult = deleteRoomSchema.safeParse({ id: roomId });
  if (!idResult.success) {
    return { success: false, message: "Invalid room reference." };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Get current state
      const current = await tx
        .select({ id: rooms.id, isActive: rooms.isActive })
        .from(rooms)
        .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
        .limit(1);

      if (current.length === 0) {
        return null;
      }

      const newIsActive = !current[0].isActive;

      await tx
        .update(rooms)
        .set({
          isActive: newIsActive,
          updatedBy: session.userId,
          updatedAt: new Date(),
        })
        .where(eq(rooms.id, roomId));

      await logAudit(
        {
          actor: session.userId,
          actorRole: session.role,
          action: newIsActive
            ? "schedules:activate_room"
            : "schedules:deactivate_room",
          targetEntity: "rooms",
          targetId: roomId,
          newState: { isActive: newIsActive },
        },
        { throwOnFail: true }
      );

      return newIsActive;
    });

    if (result === null) {
      return {
        success: false,
        message: "Room not found or has been deleted.",
      };
    }

    revalidatePath("/staff/academics/schedules/rooms");
    invalidateTag(CACHE_TAGS.ROOMS);

    return {
      success: true,
      message: result ? "Room activated." : "Room deactivated.",
      isActive: result,
    };
  } catch (error) {
    logger.error("[schedules] Failed to toggle room active", { error });
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    };
  }
}

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
