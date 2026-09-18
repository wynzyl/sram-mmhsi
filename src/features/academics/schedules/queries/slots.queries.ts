import "server-only";
import { db } from "@/lib/db";
import {
  periods,
  rooms,
  scheduleSlots,
  subjectOfferings,
  subjects,
  sections,
  users,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, ne } from "drizzle-orm";
import type {
  ScheduleSlotView,
  ScheduleConflict,
  DayOfWeek,
} from "../schedules.schema";

// ─── Schedule Slot Queries ────────────────────────────────────────────────────

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
  const { cacheTag: ct } = await import("next/cache");
  const { CACHE_TAGS } = await import("@/lib/cache/cache-tags");
  ct(CACHE_TAGS.SCHEDULES);

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
