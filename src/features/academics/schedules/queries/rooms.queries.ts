import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { rooms, scheduleSlots } from "@/lib/db/schema";
import { eq, and, isNull, asc, sql, inArray } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type { RoomView, RoomOption } from "../schedules.schema";

// ─── Room Queries ────────────────────────────────────────────────────────────

/**
 * Get all active rooms.
 * Ordered by room code.
 */
export async function getActiveRooms(): Promise<RoomView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.ROOMS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      name: rooms.name,
      building: rooms.building,
      floor: rooms.floor,
      capacity: rooms.capacity,
      roomType: rooms.roomType,
      isActive: rooms.isActive,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(and(eq(rooms.isActive, true), isNull(rooms.deletedAt)))
    .orderBy(asc(rooms.code));

  // Get slot counts for all rooms
  const roomIds = rows.map((r) => r.id);
  const slotCounts = await getRoomSlotCountsBatch(roomIds);

  return rows.map((row) => ({
    ...row,
    slotCount: slotCounts.get(row.id) ?? 0,
  }));
}

/**
 * Get all rooms (including inactive) for management.
 */
export async function getAllRooms(): Promise<RoomView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.ROOMS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      name: rooms.name,
      building: rooms.building,
      floor: rooms.floor,
      capacity: rooms.capacity,
      roomType: rooms.roomType,
      isActive: rooms.isActive,
      createdAt: rooms.createdAt,
    })
    .from(rooms)
    .where(isNull(rooms.deletedAt))
    .orderBy(asc(rooms.code));

  // Get slot counts for all rooms
  const roomIds = rows.map((r) => r.id);
  const slotCounts = await getRoomSlotCountsBatch(roomIds);

  return rows.map((row) => ({
    ...row,
    slotCount: slotCounts.get(row.id) ?? 0,
  }));
}

/**
 * Get a single room by ID.
 */
export async function getRoomById(roomId: string): Promise<RoomView | null> {
  const [rows, slotCount] = await Promise.all([
    db
      .select({
        id: rooms.id,
        code: rooms.code,
        name: rooms.name,
        building: rooms.building,
        floor: rooms.floor,
        capacity: rooms.capacity,
        roomType: rooms.roomType,
        isActive: rooms.isActive,
        createdAt: rooms.createdAt,
      })
      .from(rooms)
      .where(and(eq(rooms.id, roomId), isNull(rooms.deletedAt)))
      .limit(1),
    getRoomSlotCount(roomId),
  ]);

  const row = rows[0];
  if (!row) return null;

  return {
    ...row,
    slotCount,
  };
}

/**
 * Get rooms for dropdown selection.
 * Only returns active rooms.
 */
export async function getRoomsForDropdown(): Promise<RoomOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.ROOMS);
  cacheLife("hours");

  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      name: rooms.name,
      roomType: rooms.roomType,
      capacity: rooms.capacity,
    })
    .from(rooms)
    .where(and(eq(rooms.isActive, true), isNull(rooms.deletedAt)))
    .orderBy(asc(rooms.code));

  return rows.map((row) => ({
    value: row.id,
    label: `${row.code} - ${row.name}`,
    code: row.code,
    roomType: row.roomType,
    capacity: row.capacity,
  }));
}

/**
 * Get schedule slot count for a single room.
 */
export async function getRoomSlotCount(roomId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(scheduleSlots)
    .where(
      and(eq(scheduleSlots.roomId, roomId), isNull(scheduleSlots.deletedAt))
    );

  return Number(result[0]?.count ?? 0);
}

/**
 * Batch get slot counts for multiple rooms.
 */
async function getRoomSlotCountsBatch(
  roomIds: string[]
): Promise<Map<string, number>> {
  if (roomIds.length === 0) {
    return new Map();
  }

  const counts = await db
    .select({
      roomId: scheduleSlots.roomId,
      count: sql<number>`COUNT(*)`,
    })
    .from(scheduleSlots)
    .where(
      and(
        inArray(scheduleSlots.roomId, roomIds),
        isNull(scheduleSlots.deletedAt)
      )
    )
    .groupBy(scheduleSlots.roomId);

  return new Map(
    counts
      .filter((r) => r.roomId !== null)
      .map((r) => [r.roomId!, Number(r.count)])
  );
}
