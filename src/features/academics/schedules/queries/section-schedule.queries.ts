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
  schoolYears,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and, isNull, asc, or } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import { getPeriodGradeGroup } from "@/lib/constants/period-grade-groups";
import type {
  ScheduleSlotView,
  ScheduleGridRow,
  DayOfWeek,
} from "../schedules.schema";

// ─── Section Schedule Queries ─────────────────────────────────────────────────

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

  // Get the section's grade level ID and name
  const sectionInfo = await db
    .select({
      gradeLevelId: sections.gradeLevelId,
      gradeLevelName: gradeLevels.name,
    })
    .from(sections)
    .innerJoin(gradeLevels, eq(sections.gradeLevelId, gradeLevels.id))
    .where(eq(sections.id, sectionId))
    .limit(1);

  const gradeLevelId = sectionInfo[0]?.gradeLevelId ?? null;
  const gradeLevelName = sectionInfo[0]?.gradeLevelName ?? null;

  // Determine the period grade group for this section's grade level
  const gradeGroup = gradeLevelName ? getPeriodGradeGroup(gradeLevelName) : undefined;

  // Get periods for the school year, filtered by grade level applicability
  // Include periods that:
  // 1. Are universal (gradeGroup=null AND gradeLevelId=null)
  // 2. Match the section's grade group (e.g., "elementary" for Grade 1-6)
  // 3. Match the section's specific grade level
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
        // Filter by grade level applicability
        or(
          // Universal periods (no gradeGroup and no gradeLevelId)
          and(isNull(periods.gradeGroup), isNull(periods.gradeLevelId)),
          // Grade group match (if section has a mapped grade group)
          ...(gradeGroup ? [eq(periods.gradeGroup, gradeGroup)] : []),
          // Specific grade level match
          ...(gradeLevelId ? [eq(periods.gradeLevelId, gradeLevelId)] : [])
        )
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
 * Get section details for schedule page header.
 */
export async function getSectionDetails(sectionId: string): Promise<{
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  schoolYearLabel: string;
} | null> {
  const rows = await db
    .select({
      id: sections.id,
      name: sections.name,
      gradeLevelId: sections.gradeLevelId,
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
