import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  enrollments,
  sections,
  gradeLevels,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CACHE_TAGS } from "@/lib/cache/cache-tags";
import type {
  ScheduleSlotView,
  ScheduleGridRow,
  DayOfWeek,
} from "../schedules.schema";
import { getScheduleForSection, getSectionDaySchedule } from "./section-schedule.queries";

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
