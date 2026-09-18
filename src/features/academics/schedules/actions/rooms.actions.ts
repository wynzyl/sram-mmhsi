"use server";

import { db } from "@/lib/db";
import { rooms } from "@/lib/db/schema";
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
  createRoomSchema,
  updateRoomSchema,
  deleteRoomSchema,
  type CreateRoomFormState,
  type UpdateRoomFormState,
} from "../schedules.schema";
import { getRoomSlotCount } from "../queries";

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
