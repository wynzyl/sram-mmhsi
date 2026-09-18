import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  periods,
  rooms,
  scheduleSlots,
  subjectOfferings,
  subjects,
  sections,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type {
  ScheduleSlotView,
  ScheduleGridRow,
  DayOfWeek,
} from "../schedules.schema";

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
