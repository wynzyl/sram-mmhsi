import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  periods,
  rooms,
  scheduleSlots,
  schoolYears,
  subjectOfferings,
  subjects,
  sections,
  users,
  gradeLevels,
  enrollments,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, sql, or, ne, inArray } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type {
  PeriodView,
  RoomView,
  PeriodOption,
  RoomOption,
  ScheduleSlotView,
  ScheduleGridRow,
  ScheduleConflict,
  DayOfWeek,
} from "./schedules.schema";

// ─── Period Queries ──────────────────────────────────────────────────────────

/**
 * Get all periods for a school year, optionally filtered by grade level.
 * Ordered by period number.
 */
export async function getPeriodsForSchoolYear(
  schoolYearId: string,
  gradeLevelId?: string | null
): Promise<PeriodView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  const conditions = [
    eq(periods.schoolYearId, schoolYearId),
    isNull(periods.deletedAt),
  ];

  // If gradeLevelId is provided, filter by it OR null (universal periods)
  if (gradeLevelId !== undefined) {
    if (gradeLevelId === null) {
      conditions.push(isNull(periods.gradeLevelId));
    } else {
      conditions.push(
        sql`(${periods.gradeLevelId} = ${gradeLevelId} OR ${periods.gradeLevelId} IS NULL)`
      );
    }
  }

  const rows = await db
    .select({
      id: periods.id,
      schoolYearId: periods.schoolYearId,
      schoolYearLabel: schoolYears.label,
      name: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
      gradeLevelId: periods.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      isActive: periods.isActive,
      createdAt: periods.createdAt,
    })
    .from(periods)
    .innerJoin(schoolYears, eq(periods.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(periods.gradeLevelId, gradeLevels.id))
    .where(and(...conditions))
    .orderBy(asc(gradeLevels.order), asc(periods.periodNumber));

  return rows;
}

/**
 * Get a single period by ID.
 */
export async function getPeriodById(
  periodId: string
): Promise<PeriodView | null> {
  const rows = await db
    .select({
      id: periods.id,
      schoolYearId: periods.schoolYearId,
      schoolYearLabel: schoolYears.label,
      name: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
      gradeLevelId: periods.gradeLevelId,
      gradeLevelName: gradeLevels.name,
      isActive: periods.isActive,
      createdAt: periods.createdAt,
    })
    .from(periods)
    .innerJoin(schoolYears, eq(periods.schoolYearId, schoolYears.id))
    .leftJoin(gradeLevels, eq(periods.gradeLevelId, gradeLevels.id))
    .where(and(eq(periods.id, periodId), isNull(periods.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Get periods for dropdown selection.
 * Only returns active class periods.
 */
export async function getPeriodsForDropdown(
  schoolYearId: string,
  gradeLevelId?: string | null
): Promise<PeriodOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.PERIODS);
  cacheLife("hours");

  const conditions = [
    eq(periods.schoolYearId, schoolYearId),
    eq(periods.isActive, true),
    eq(periods.isClassPeriod, true),
    isNull(periods.deletedAt),
  ];

  if (gradeLevelId !== undefined && gradeLevelId !== null) {
    conditions.push(
      sql`(${periods.gradeLevelId} = ${gradeLevelId} OR ${periods.gradeLevelId} IS NULL)`
    );
  }

  const rows = await db
    .select({
      id: periods.id,
      name: periods.name,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
    })
    .from(periods)
    .where(and(...conditions))
    .orderBy(asc(periods.periodNumber));

  return rows.map((row) => ({
    value: row.id,
    label: `${row.name} (${row.startTime} - ${row.endTime})`,
    startTime: row.startTime,
    endTime: row.endTime,
    isClassPeriod: row.isClassPeriod,
  }));
}

/**
 * Check if a period has any schedule slots assigned.
 */
export async function getPeriodSlotCount(periodId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(scheduleSlots)
    .where(
      and(eq(scheduleSlots.periodId, periodId), isNull(scheduleSlots.deletedAt))
    );

  return Number(result[0]?.count ?? 0);
}

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

// ─── Schedule Slot Queries ────────────────────────────────────────────────────

/**
 * Get all schedule slots for a section, organized as a weekly grid.
 * Returns periods as rows with slots for each day of the week.
 * Filters periods by the section's grade level.
 */
export async function getScheduleForSection(
  sectionId: string,
  schoolYearId: string
): Promise<ScheduleGridRow[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  // Get the section's grade level ID
  const sectionInfo = await db
    .select({
      gradeLevelId: sections.gradeLevelId,
    })
    .from(sections)
    .where(eq(sections.id, sectionId))
    .limit(1);

  const gradeLevelId = sectionInfo[0]?.gradeLevelId ?? null;

  // Get periods for the school year, filtered by grade level
  // Include periods that match the grade level OR have no grade level (universal periods)
  const allPeriods = await db
    .select({
      id: periods.id,
      name: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      isClassPeriod: periods.isClassPeriod,
    })
    .from(periods)
    .where(
      and(
        eq(periods.schoolYearId, schoolYearId),
        eq(periods.isActive, true),
        isNull(periods.deletedAt),
        // Filter by grade level: match grade level OR universal (null)
        gradeLevelId
          ? or(
              eq(periods.gradeLevelId, gradeLevelId),
              isNull(periods.gradeLevelId)
            )
          : isNull(periods.gradeLevelId)
      )
    )
    .orderBy(asc(periods.periodNumber));

  // Get all slots for this section
  const slots = await db
    .select({
      id: scheduleSlots.id,
      subjectOfferingId: scheduleSlots.subjectOfferingId,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodId: scheduleSlots.periodId,
      roomId: scheduleSlots.roomId,
      sectionId: scheduleSlots.sectionId,
      teacherId: scheduleSlots.teacherId,
      schoolYearId: scheduleSlots.schoolYearId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      periodName: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      roomCode: rooms.code,
      roomName: rooms.name,
      sectionName: sections.name,
      teacherName: users.username,
    })
    .from(scheduleSlots)
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .leftJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
    .leftJoin(users, eq(scheduleSlots.teacherId, users.id))
    .where(
      and(
        eq(scheduleSlots.sectionId, sectionId),
        eq(scheduleSlots.schoolYearId, schoolYearId),
        isNull(scheduleSlots.deletedAt)
      )
    );

  // Create a map of periodId+dayOfWeek -> slot
  const slotMap = new Map<string, ScheduleSlotView>();
  for (const slot of slots) {
    const key = `${slot.periodId}-${slot.dayOfWeek}`;
    slotMap.set(key, {
      id: slot.id,
      subjectOfferingId: slot.subjectOfferingId,
      subjectName: slot.subjectName,
      subjectCode: slot.subjectCode,
      dayOfWeek: slot.dayOfWeek as DayOfWeek,
      periodId: slot.periodId,
      periodName: slot.periodName,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomId: slot.roomId,
      roomCode: slot.roomCode,
      roomName: slot.roomName,
      sectionId: slot.sectionId,
      sectionName: slot.sectionName,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
      schoolYearId: slot.schoolYearId,
    });
  }

  // Build grid rows
  return allPeriods.map((period) => ({
    period: {
      id: period.id,
      name: period.name,
      periodNumber: period.periodNumber,
      startTime: period.startTime,
      endTime: period.endTime,
      isClassPeriod: period.isClassPeriod,
    },
    monday: slotMap.get(`${period.id}-monday`) ?? null,
    tuesday: slotMap.get(`${period.id}-tuesday`) ?? null,
    wednesday: slotMap.get(`${period.id}-wednesday`) ?? null,
    thursday: slotMap.get(`${period.id}-thursday`) ?? null,
    friday: slotMap.get(`${period.id}-friday`) ?? null,
  }));
}

/**
 * Get a single schedule slot by ID.
 */
export async function getScheduleSlotById(
  slotId: string
): Promise<ScheduleSlotView | null> {
  const rows = await db
    .select({
      id: scheduleSlots.id,
      subjectOfferingId: scheduleSlots.subjectOfferingId,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodId: scheduleSlots.periodId,
      roomId: scheduleSlots.roomId,
      sectionId: scheduleSlots.sectionId,
      teacherId: scheduleSlots.teacherId,
      schoolYearId: scheduleSlots.schoolYearId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      periodName: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      roomCode: rooms.code,
      roomName: rooms.name,
      sectionName: sections.name,
      teacherName: users.username,
    })
    .from(scheduleSlots)
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .leftJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
    .leftJoin(users, eq(scheduleSlots.teacherId, users.id))
    .where(and(eq(scheduleSlots.id, slotId), isNull(scheduleSlots.deletedAt)))
    .limit(1);

  const slot = rows[0];
  if (!slot) return null;

  return {
    id: slot.id,
    subjectOfferingId: slot.subjectOfferingId,
    subjectName: slot.subjectName,
    subjectCode: slot.subjectCode,
    dayOfWeek: slot.dayOfWeek as DayOfWeek,
    periodId: slot.periodId,
    periodName: slot.periodName,
    periodNumber: slot.periodNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomId: slot.roomId,
    roomCode: slot.roomCode,
    roomName: slot.roomName,
    sectionId: slot.sectionId,
    sectionName: slot.sectionName,
    teacherId: slot.teacherId,
    teacherName: slot.teacherName,
    schoolYearId: slot.schoolYearId,
  };
}

/**
 * Helper: Check if two time ranges overlap.
 * Times are strings in "HH:MM" format (e.g., "08:30", "10:30").
 * Overlap occurs when: start1 < end2 AND start2 < end1
 */
function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Check for schedule conflicts before creating/updating a slot.
 * Returns array of conflicts (empty if none).
 *
 * IMPORTANT: This function checks for actual TIME overlap, not just period ID match.
 * Different grade levels may have different period times (e.g., Junior Casa Period 1: 08:30-09:30,
 * Senior Casa Period 1: 10:30-12:30). These don't conflict because times don't overlap.
 */
export async function checkScheduleConflicts(params: {
  dayOfWeek: DayOfWeek;
  periodId: string;
  schoolYearId: string;
  sectionId: string;
  teacherId: string | null;
  roomId: string | null;
  excludeSlotId?: string; // For updates, exclude the slot being updated
}): Promise<ScheduleConflict[]> {
  const { dayOfWeek, periodId, schoolYearId, sectionId, teacherId, roomId, excludeSlotId } =
    params;
  const conflicts: ScheduleConflict[] = [];

  // Get the target period's time range for overlap checking
  const targetPeriodInfo = await db
    .select({
      name: periods.name,
      startTime: periods.startTime,
      endTime: periods.endTime,
    })
    .from(periods)
    .where(eq(periods.id, periodId))
    .limit(1);

  if (targetPeriodInfo.length === 0) {
    // Period not found - can't check conflicts
    return conflicts;
  }

  const targetPeriod = targetPeriodInfo[0];
  const periodName = targetPeriod.name ?? "Unknown Period";
  const targetStart = targetPeriod.startTime;
  const targetEnd = targetPeriod.endTime;

  // Build base conditions (WITHOUT periodId - we check time overlap instead)
  const baseConditions = [
    eq(scheduleSlots.dayOfWeek, dayOfWeek),
    eq(scheduleSlots.schoolYearId, schoolYearId),
    isNull(scheduleSlots.deletedAt),
  ];

  // Add exclusion for updates
  if (excludeSlotId) {
    baseConditions.push(ne(scheduleSlots.id, excludeSlotId));
  }

  // Check section conflict - find slots for this section on this day and check time overlap
  const sectionSlots = await db
    .select({
      id: scheduleSlots.id,
      sectionName: sections.name,
      subjectName: subjects.name,
      periodName: periods.name,
      periodStart: periods.startTime,
      periodEnd: periods.endTime,
    })
    .from(scheduleSlots)
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .where(and(...baseConditions, eq(scheduleSlots.sectionId, sectionId)));

  for (const slot of sectionSlots) {
    if (timesOverlap(targetStart, targetEnd, slot.periodStart, slot.periodEnd)) {
      conflicts.push({
        type: "section",
        dayOfWeek,
        periodId,
        periodName,
        conflictingSlotId: slot.id,
        description: `Section ${slot.sectionName} already has ${slot.subjectName} at this time (${slot.periodStart}-${slot.periodEnd})`,
      });
      break; // Only report first conflict per type
    }
  }

  // Check teacher conflict (only if teacher is assigned)
  if (teacherId) {
    const teacherSlots = await db
      .select({
        id: scheduleSlots.id,
        sectionName: sections.name,
        gradeLevelName: gradeLevels.name,
        subjectName: subjects.name,
        teacherName: users.username,
        periodName: periods.name,
        periodStart: periods.startTime,
        periodEnd: periods.endTime,
      })
      .from(scheduleSlots)
      .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
      .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
      .innerJoin(users, eq(scheduleSlots.teacherId, users.id))
      .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
      .where(and(...baseConditions, eq(scheduleSlots.teacherId, teacherId)));

    for (const slot of teacherSlots) {
      if (timesOverlap(targetStart, targetEnd, slot.periodStart, slot.periodEnd)) {
        conflicts.push({
          type: "teacher",
          dayOfWeek,
          periodId,
          periodName,
          conflictingSlotId: slot.id,
          description: `${slot.teacherName} is already teaching ${slot.subjectName} in ${slot.gradeLevelName} - ${slot.sectionName} at this time (${slot.periodStart}-${slot.periodEnd})`,
        });
        break; // Only report first conflict per type
      }
    }
  }

  // Check room conflict (only if room is assigned)
  if (roomId) {
    const roomSlots = await db
      .select({
        id: scheduleSlots.id,
        sectionName: sections.name,
        gradeLevelName: gradeLevels.name,
        subjectName: subjects.name,
        roomCode: rooms.code,
        roomName: rooms.name,
        periodName: periods.name,
        periodStart: periods.startTime,
        periodEnd: periods.endTime,
      })
      .from(scheduleSlots)
      .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
      .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
      .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
      .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
      .innerJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
      .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
      .where(and(...baseConditions, eq(scheduleSlots.roomId, roomId)));

    for (const slot of roomSlots) {
      if (timesOverlap(targetStart, targetEnd, slot.periodStart, slot.periodEnd)) {
        conflicts.push({
          type: "room",
          dayOfWeek,
          periodId,
          periodName,
          conflictingSlotId: slot.id,
          description: `${slot.roomCode} is already booked for ${slot.subjectName} (${slot.gradeLevelName} - ${slot.sectionName}) at this time (${slot.periodStart}-${slot.periodEnd})`,
        });
        break; // Only report first conflict per type
      }
    }
  }

  return conflicts;
}

// ─── Subject Offering Queries (for Schedule Slot Form) ────────────────────────

export interface SubjectOfferingOption {
  value: string;
  label: string;
  subjectCode: string | null;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
}

/**
 * Get subject offerings for a section (for dropdown in schedule slot form).
 * Only returns active offerings.
 */
export async function getSubjectOfferingsForSection(
  sectionId: string,
  schoolYearId: string
): Promise<SubjectOfferingOption[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  const rows = await db
    .select({
      id: subjectOfferings.id,
      subjectCode: subjects.code,
      subjectName: subjects.name,
      teacherId: subjectOfferings.teacherId,
      teacherName: users.username,
    })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .leftJoin(users, eq(subjectOfferings.teacherId, users.id))
    .where(
      and(
        eq(subjectOfferings.sectionId, sectionId),
        eq(subjectOfferings.schoolYearId, schoolYearId),
        eq(subjectOfferings.isActive, true),
        isNull(subjectOfferings.deletedAt)
      )
    )
    .orderBy(asc(subjectOfferings.sequenceOrder), asc(subjects.name));

  return rows.map((row) => ({
    value: row.id,
    label: row.subjectCode
      ? `${row.subjectCode} - ${row.subjectName}`
      : row.subjectName,
    subjectCode: row.subjectCode,
    subjectName: row.subjectName,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
  }));
}

/**
 * Get section details for schedule page header.
 */
export async function getSectionDetails(sectionId: string): Promise<{
  id: string;
  name: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
} | null> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelName: gradeLevels.name,
      schoolYearId: sections.schoolYearId,
      schoolYearLabel: schoolYears.label,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .innerJoin(schoolYears, eq(sections.schoolYearId, schoolYears.id))
    .where(and(eq(sections.id, sectionId), isNull(sections.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Teacher Schedule Queries ─────────────────────────────────────────────────

/**
 * Get all schedule slots for a teacher across all sections.
 * Organized as grid rows (periods × days).
 * Only shows periods where the teacher has at least one slot.
 */
export async function getScheduleForTeacher(
  teacherId: string,
  schoolYearId: string
): Promise<ScheduleGridRow[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  // Get all slots for this teacher first
  const slots = await db
    .select({
      id: scheduleSlots.id,
      subjectOfferingId: scheduleSlots.subjectOfferingId,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodId: scheduleSlots.periodId,
      roomId: scheduleSlots.roomId,
      sectionId: scheduleSlots.sectionId,
      teacherId: scheduleSlots.teacherId,
      schoolYearId: scheduleSlots.schoolYearId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      periodName: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      roomCode: rooms.code,
      roomName: rooms.name,
      sectionName: sections.name,
      teacherName: users.username,
    })
    .from(scheduleSlots)
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .leftJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
    .leftJoin(users, eq(scheduleSlots.teacherId, users.id))
    .where(
      and(
        eq(scheduleSlots.teacherId, teacherId),
        eq(scheduleSlots.schoolYearId, schoolYearId),
        isNull(scheduleSlots.deletedAt)
      )
    );

  // Create a map of periodId+dayOfWeek -> slot and collect unique periods
  const slotMap = new Map<string, ScheduleSlotView>();
  const periodMap = new Map<string, {
    id: string;
    name: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    isClassPeriod: boolean;
  }>();

  for (const slot of slots) {
    const key = `${slot.periodId}-${slot.dayOfWeek}`;
    slotMap.set(key, {
      id: slot.id,
      subjectOfferingId: slot.subjectOfferingId,
      subjectName: slot.subjectName,
      subjectCode: slot.subjectCode,
      dayOfWeek: slot.dayOfWeek as DayOfWeek,
      periodId: slot.periodId,
      periodName: slot.periodName,
      periodNumber: slot.periodNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomId: slot.roomId,
      roomCode: slot.roomCode,
      roomName: slot.roomName,
      sectionId: slot.sectionId,
      sectionName: slot.sectionName,
      teacherId: slot.teacherId,
      teacherName: slot.teacherName,
      schoolYearId: slot.schoolYearId,
    });

    // Collect unique periods from slots
    if (!periodMap.has(slot.periodId)) {
      periodMap.set(slot.periodId, {
        id: slot.periodId,
        name: slot.periodName,
        periodNumber: slot.periodNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isClassPeriod: true, // Slots are only created for class periods
      });
    }
  }

  // Sort periods by start time (not period number, since different grade levels
  // may have different times for the same period number)
  const uniquePeriods = Array.from(periodMap.values()).sort(
    (a, b) => a.startTime.localeCompare(b.startTime)
  );

  // Build grid rows only for periods where teacher has slots
  return uniquePeriods.map((period) => ({
    period,
    monday: slotMap.get(`${period.id}-monday`) ?? null,
    tuesday: slotMap.get(`${period.id}-tuesday`) ?? null,
    wednesday: slotMap.get(`${period.id}-wednesday`) ?? null,
    thursday: slotMap.get(`${period.id}-thursday`) ?? null,
    friday: slotMap.get(`${period.id}-friday`) ?? null,
  }));
}

/**
 * Get schedule slots for a teacher on a specific day.
 * Returns slots sorted by period number.
 */
export async function getTeacherDaySchedule(
  teacherId: string,
  schoolYearId: string,
  dayOfWeek: DayOfWeek
): Promise<ScheduleSlotView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  const slots = await db
    .select({
      id: scheduleSlots.id,
      subjectOfferingId: scheduleSlots.subjectOfferingId,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodId: scheduleSlots.periodId,
      roomId: scheduleSlots.roomId,
      sectionId: scheduleSlots.sectionId,
      teacherId: scheduleSlots.teacherId,
      schoolYearId: scheduleSlots.schoolYearId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      periodName: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      roomCode: rooms.code,
      roomName: rooms.name,
      sectionName: sections.name,
      teacherName: users.username,
    })
    .from(scheduleSlots)
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .leftJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
    .leftJoin(users, eq(scheduleSlots.teacherId, users.id))
    .where(
      and(
        eq(scheduleSlots.teacherId, teacherId),
        eq(scheduleSlots.schoolYearId, schoolYearId),
        eq(scheduleSlots.dayOfWeek, dayOfWeek),
        isNull(scheduleSlots.deletedAt)
      )
    )
    .orderBy(asc(periods.startTime));

  return slots.map((slot) => ({
    id: slot.id,
    subjectOfferingId: slot.subjectOfferingId,
    subjectName: slot.subjectName,
    subjectCode: slot.subjectCode,
    dayOfWeek: slot.dayOfWeek as DayOfWeek,
    periodId: slot.periodId,
    periodName: slot.periodName,
    periodNumber: slot.periodNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomId: slot.roomId,
    roomCode: slot.roomCode,
    roomName: slot.roomName,
    sectionId: slot.sectionId,
    sectionName: slot.sectionName,
    teacherId: slot.teacherId,
    teacherName: slot.teacherName,
    schoolYearId: slot.schoolYearId,
  }));
}

// ─── Student Schedule Queries ─────────────────────────────────────────────────

/**
 * Get a student's enrolled section for the school year.
 */
export async function getStudentEnrolledSection(
  studentId: string,
  schoolYearId: string
): Promise<{
  sectionId: string;
  sectionName: string;
  gradeLevelName: string;
} | null> {
  const rows = await db
    .select({
      sectionId: enrollments.sectionId,
      sectionName: sections.name,
      gradeLevelName: gradeLevels.name,
    })
    .from(enrollments)
    .innerJoin(sections, eq(enrollments.sectionId, sections.id))
    .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.schoolYearId, schoolYearId),
        eq(enrollments.status, "enrolled")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.sectionId) return null;

  return {
    sectionId: row.sectionId,
    sectionName: row.sectionName,
    gradeLevelName: row.gradeLevelName,
  };
}

/**
 * Get schedule for a student via their enrolled section.
 */
export async function getScheduleForStudent(
  studentId: string,
  schoolYearId: string
): Promise<{
  section: { id: string; name: string; gradeLevelName: string } | null;
  rows: ScheduleGridRow[];
}> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  const enrollment = await getStudentEnrolledSection(studentId, schoolYearId);

  if (!enrollment) {
    return { section: null, rows: [] };
  }

  const rows = await getScheduleForSection(enrollment.sectionId, schoolYearId);

  return {
    section: {
      id: enrollment.sectionId,
      name: enrollment.sectionName,
      gradeLevelName: enrollment.gradeLevelName,
    },
    rows,
  };
}

/**
 * Get today's schedule for a student.
 */
export async function getStudentTodaySchedule(
  studentId: string,
  schoolYearId: string
): Promise<{
  section: { id: string; name: string; gradeLevelName: string } | null;
  slots: ScheduleSlotView[];
  dayOfWeek: DayOfWeek | null;
}> {
  const enrollment = await getStudentEnrolledSection(studentId, schoolYearId);

  if (!enrollment) {
    return { section: null, slots: [], dayOfWeek: null };
  }

  const today = getTodayDayOfWeek();
  if (!today) {
    return {
      section: {
        id: enrollment.sectionId,
        name: enrollment.sectionName,
        gradeLevelName: enrollment.gradeLevelName,
      },
      slots: [],
      dayOfWeek: null,
    };
  }

  const slots = await getSectionDaySchedule(
    enrollment.sectionId,
    schoolYearId,
    today
  );

  return {
    section: {
      id: enrollment.sectionId,
      name: enrollment.sectionName,
      gradeLevelName: enrollment.gradeLevelName,
    },
    slots,
    dayOfWeek: today,
  };
}

/**
 * Get schedule slots for a section on a specific day.
 */
export async function getSectionDaySchedule(
  sectionId: string,
  schoolYearId: string,
  dayOfWeek: DayOfWeek
): Promise<ScheduleSlotView[]> {
  "use cache";
  cacheTag(CACHE_TAGS.SCHEDULES);
  cacheLife("hours");

  const slots = await db
    .select({
      id: scheduleSlots.id,
      subjectOfferingId: scheduleSlots.subjectOfferingId,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodId: scheduleSlots.periodId,
      roomId: scheduleSlots.roomId,
      sectionId: scheduleSlots.sectionId,
      teacherId: scheduleSlots.teacherId,
      schoolYearId: scheduleSlots.schoolYearId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      periodName: periods.name,
      periodNumber: periods.periodNumber,
      startTime: periods.startTime,
      endTime: periods.endTime,
      roomCode: rooms.code,
      roomName: rooms.name,
      sectionName: sections.name,
      teacherName: users.username,
    })
    .from(scheduleSlots)
    .innerJoin(subjectOfferings, eq(scheduleSlots.subjectOfferingId, subjectOfferings.id))
    .innerJoin(subjects, eq(subjectOfferings.subjectId, subjects.id))
    .innerJoin(periods, eq(scheduleSlots.periodId, periods.id))
    .innerJoin(sections, eq(scheduleSlots.sectionId, sections.id))
    .leftJoin(rooms, eq(scheduleSlots.roomId, rooms.id))
    .leftJoin(users, eq(scheduleSlots.teacherId, users.id))
    .where(
      and(
        eq(scheduleSlots.sectionId, sectionId),
        eq(scheduleSlots.schoolYearId, schoolYearId),
        eq(scheduleSlots.dayOfWeek, dayOfWeek),
        isNull(scheduleSlots.deletedAt)
      )
    )
    .orderBy(asc(periods.periodNumber));

  return slots.map((slot) => ({
    id: slot.id,
    subjectOfferingId: slot.subjectOfferingId,
    subjectName: slot.subjectName,
    subjectCode: slot.subjectCode,
    dayOfWeek: slot.dayOfWeek as DayOfWeek,
    periodId: slot.periodId,
    periodName: slot.periodName,
    periodNumber: slot.periodNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    roomId: slot.roomId,
    roomCode: slot.roomCode,
    roomName: slot.roomName,
    sectionId: slot.sectionId,
    sectionName: slot.sectionName,
    teacherId: slot.teacherId,
    teacherName: slot.teacherName,
    schoolYearId: slot.schoolYearId,
  }));
}

// ─── Utility Functions ────────────────────────────────────────────────────────

/**
 * Get today's day of week. Returns null for weekends.
 */
export function getTodayDayOfWeek(): DayOfWeek | null {
  const dayIndex = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayMap: Record<number, DayOfWeek> = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
  };
  return dayMap[dayIndex] ?? null;
}
