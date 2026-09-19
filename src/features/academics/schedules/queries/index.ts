// ─── Period Queries ──────────────────────────────────────────────────────────
export {
  getPeriodsForSchoolYear,
  getPeriodById,
  getPeriodsForDropdown,
  getPeriodSlotCount,
} from "./periods.queries";

// ─── Room Queries ────────────────────────────────────────────────────────────
export {
  getActiveRooms,
  getAllRooms,
  getRoomById,
  getRoomsForDropdown,
  getRoomSlotCount,
} from "./rooms.queries";

// ─── Schedule Slot Queries ────────────────────────────────────────────────────
export {
  getScheduleSlotById,
  checkScheduleConflicts,
  getSubjectOfferingsForSection,
  getTeachersForScheduleSlots,
  type SubjectOfferingOption,
} from "./slots.queries";

// ─── Section Schedule Queries ─────────────────────────────────────────────────
export {
  getScheduleForSection,
  getSectionDetails,
  getSectionDaySchedule,
} from "./section-schedule.queries";

// ─── Teacher Schedule Queries ─────────────────────────────────────────────────
export {
  getScheduleForTeacher,
  getTeacherDaySchedule,
} from "./teacher-schedule.queries";

// ─── Student Schedule Queries ─────────────────────────────────────────────────
export {
  getStudentEnrolledSection,
  getScheduleForStudent,
  getStudentTodaySchedule,
  getTodayDayOfWeek,
} from "./student-schedule.queries";
