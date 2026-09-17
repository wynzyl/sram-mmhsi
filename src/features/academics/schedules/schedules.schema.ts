import { z } from "zod";
import {
  nameSchema,
  uuidSchema,
  integerSchema,
  optionalTextSchema,
  type BaseFormState,
} from "@/lib/validators/common-schemas";

// ─── Day of Week ─────────────────────────────────────────────────────────────

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export const DAY_OF_WEEK_SHORT_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
};

export const dayOfWeekSchema = z.enum(DAYS_OF_WEEK);

// ─── Room Types ──────────────────────────────────────────────────────────────

export const ROOM_TYPES = [
  "classroom",
  "laboratory",
  "computer_lab",
  "library",
  "gymnasium",
  "auditorium",
  "other",
] as const;

export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  classroom: "Classroom",
  laboratory: "Laboratory",
  computer_lab: "Computer Lab",
  library: "Library",
  gymnasium: "Gymnasium",
  auditorium: "Auditorium",
  other: "Other",
};

export const roomTypeSchema = z.enum(ROOM_TYPES);

// ─── Time Format ─────────────────────────────────────────────────────────────

/**
 * Time format validator (HH:mm format, 24-hour).
 * Examples: "07:30", "14:45", "08:00"
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Time must be in HH:mm format (e.g., 07:30)");

// ─── Period Schemas ──────────────────────────────────────────────────────────

export const createPeriodSchema = z
  .object({
    schoolYearId: uuidSchema,
    name: nameSchema.pipe(z.string().max(50, "Period name must be 50 characters or less")),
    periodNumber: integerSchema.pipe(z.number().min(1, "Period number must be at least 1")),
    startTime: timeSchema,
    endTime: timeSchema,
    isClassPeriod: z.boolean().default(true),
    /** Optional grade level for grade-specific schedules (null = all grades/universal) */
    gradeLevelId: uuidSchema.nullable().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;

export type CreatePeriodFormState = BaseFormState<CreatePeriodInput> & {
  periodId?: string;
};

export const updatePeriodSchema = createPeriodSchema.extend({
  id: uuidSchema,
});

export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;

export type UpdatePeriodFormState = BaseFormState<UpdatePeriodInput>;

export const deletePeriodSchema = z.object({
  id: uuidSchema,
});

// ─── Room Schemas ────────────────────────────────────────────────────────────

export const createRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Room code is required")
    .max(20, "Room code must be 20 characters or less")
    .regex(/^[A-Z0-9-]+$/i, "Room code can only contain letters, numbers, and hyphens"),
  name: nameSchema.pipe(z.string().max(100, "Room name must be 100 characters or less")),
  building: optionalTextSchema.pipe(z.string().max(50, "Building name must be 50 characters or less").optional()),
  floor: optionalTextSchema.pipe(z.string().max(20, "Floor must be 20 characters or less").optional()),
  capacity: integerSchema.pipe(z.number().min(1, "Capacity must be at least 1")).optional(),
  roomType: roomTypeSchema.default("classroom"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

export type CreateRoomFormState = BaseFormState<CreateRoomInput> & {
  roomId?: string;
};

export const updateRoomSchema = createRoomSchema.extend({
  id: uuidSchema,
});

export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;

export type UpdateRoomFormState = BaseFormState<UpdateRoomInput>;

export const deleteRoomSchema = z.object({
  id: uuidSchema,
});

// ─── Schedule Slot Schemas ───────────────────────────────────────────────────

export const createScheduleSlotSchema = z.object({
  subjectOfferingId: uuidSchema,
  dayOfWeek: dayOfWeekSchema,
  periodId: uuidSchema,
  roomId: uuidSchema.nullable().optional(),
});

export type CreateScheduleSlotInput = z.infer<typeof createScheduleSlotSchema>;

export type CreateScheduleSlotFormState = BaseFormState<CreateScheduleSlotInput> & {
  slotId?: string;
  conflicts?: ScheduleConflict[];
};

export const updateScheduleSlotSchema = createScheduleSlotSchema.extend({
  id: uuidSchema,
});

export type UpdateScheduleSlotInput = z.infer<typeof updateScheduleSlotSchema>;

export type UpdateScheduleSlotFormState = BaseFormState<UpdateScheduleSlotInput> & {
  conflicts?: ScheduleConflict[];
};

export const deleteScheduleSlotSchema = z.object({
  id: uuidSchema,
});

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export const bulkCreateSlotsSchema = z.object({
  slots: z.array(createScheduleSlotSchema).min(1, "At least one slot is required"),
});

export type BulkCreateSlotsInput = z.infer<typeof bulkCreateSlotsSchema>;

export type BulkCreateSlotsFormState = BaseFormState<BulkCreateSlotsInput> & {
  created?: number;
  conflicts?: ScheduleConflict[];
};

// ─── View Types (Query Results) ──────────────────────────────────────────────

export interface PeriodView {
  id: string;
  schoolYearId: string;
  schoolYearLabel: string;
  name: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isClassPeriod: boolean;
  gradeLevelId: string | null;
  gradeLevelName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface RoomView {
  id: string;
  code: string;
  name: string;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  roomType: RoomType;
  isActive: boolean;
  createdAt: Date;
  /** Number of schedule slots using this room */
  slotCount: number;
}

export interface ScheduleSlotView {
  id: string;
  subjectOfferingId: string;
  subjectName: string;
  subjectCode: string | null;
  dayOfWeek: DayOfWeek;
  periodId: string;
  periodName: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  roomId: string | null;
  roomCode: string | null;
  roomName: string | null;
  sectionId: string;
  sectionName: string;
  teacherId: string | null;
  teacherName: string | null;
  schoolYearId: string;
}

/**
 * Weekly schedule grid cell - represents a period slot for a day.
 */
export interface ScheduleGridCell {
  periodId: string;
  periodName: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  isClassPeriod: boolean;
  slot: ScheduleSlotView | null;
}

/**
 * Weekly schedule grid row - one row per period.
 */
export interface ScheduleGridRow {
  period: {
    id: string;
    name: string;
    periodNumber: number;
    startTime: string;
    endTime: string;
    isClassPeriod: boolean;
  };
  monday: ScheduleSlotView | null;
  tuesday: ScheduleSlotView | null;
  wednesday: ScheduleSlotView | null;
  thursday: ScheduleSlotView | null;
  friday: ScheduleSlotView | null;
}

// ─── Conflict Types ──────────────────────────────────────────────────────────

export type ConflictType = "section" | "teacher" | "room";

export interface ScheduleConflict {
  type: ConflictType;
  dayOfWeek: DayOfWeek;
  periodId: string;
  periodName: string;
  conflictingSlotId: string;
  /** Description of the conflict (e.g., "Section 7-A already has Math at this time") */
  description: string;
}

// ─── Dropdown Options ────────────────────────────────────────────────────────

export interface PeriodOption {
  value: string;
  label: string;
  startTime: string;
  endTime: string;
  isClassPeriod: boolean;
}

export interface RoomOption {
  value: string;
  label: string;
  code: string;
  roomType: RoomType;
  capacity: number | null;
}
