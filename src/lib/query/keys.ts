/**
 * Query Key Factory
 *
 * Centralized query key management for TanStack Query.
 * Follows the factory pattern for type-safe, hierarchical keys.
 *
 * Usage:
 *   queryKeys.students.all         -> ['students']
 *   queryKeys.students.lists()     -> ['students', 'list']
 *   queryKeys.students.list({...}) -> ['students', 'list', {...}]
 *   queryKeys.students.detail(id)  -> ['students', 'detail', id]
 */

export const queryKeys = {
  // ─────────────────────────────────────────────────────────────────
  // Students
  // ─────────────────────────────────────────────────────────────────
  students: {
    all: ["students"] as const,
    lists: () => [...queryKeys.students.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.students.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.students.all, "detail", id] as const,
    search: (query: string) =>
      [...queryKeys.students.all, "search", query] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Enrollments
  // ─────────────────────────────────────────────────────────────────
  enrollments: {
    all: ["enrollments"] as const,
    lists: () => [...queryKeys.enrollments.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.enrollments.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.enrollments.all, "detail", id] as const,
    queue: () => [...queryKeys.enrollments.all, "queue"] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Registrations
  // ─────────────────────────────────────────────────────────────────
  registrations: {
    all: ["registrations"] as const,
    lists: () => [...queryKeys.registrations.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.registrations.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.registrations.all, "detail", id] as const,
    queue: () => [...queryKeys.registrations.all, "queue"] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Assessments
  // ─────────────────────────────────────────────────────────────────
  assessments: {
    all: ["assessments"] as const,
    lists: () => [...queryKeys.assessments.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.assessments.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.assessments.all, "detail", id] as const,
    byStudent: (studentId: string) =>
      [...queryKeys.assessments.all, "student", studentId] as const,
    byEnrollment: (enrollmentId: string) =>
      [...queryKeys.assessments.all, "enrollment", enrollmentId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Payments & Cashier
  // ─────────────────────────────────────────────────────────────────
  payments: {
    all: ["payments"] as const,
    lists: () => [...queryKeys.payments.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.payments.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.payments.all, "detail", id] as const,
    queue: () => [...queryKeys.payments.all, "queue"] as const,
    byStudent: (studentId: string) =>
      [...queryKeys.payments.all, "student", studentId] as const,
    byAssessment: (assessmentId: string) =>
      [...queryKeys.payments.all, "assessment", assessmentId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // OR Booklets
  // ─────────────────────────────────────────────────────────────────
  booklets: {
    all: ["booklets"] as const,
    lists: () => [...queryKeys.booklets.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.booklets.lists(), filters] as const)
        : queryKeys.booklets.lists(),
    detail: (id: string) => [...queryKeys.booklets.all, "detail", id] as const,
    active: () => [...queryKeys.booklets.all, "active"] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Finance: Fee Item Types
  // ─────────────────────────────────────────────────────────────────
  feeItemTypes: {
    all: ["feeItemTypes"] as const,
    lists: () => [...queryKeys.feeItemTypes.all, "list"] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.feeItemTypes.lists(), filters] as const)
        : queryKeys.feeItemTypes.lists(),
    detail: (id: string) =>
      [...queryKeys.feeItemTypes.all, "detail", id] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Finance: Fee Schedules
  // ─────────────────────────────────────────────────────────────────
  feeSchedules: {
    all: ["feeSchedules"] as const,
    lists: () => [...queryKeys.feeSchedules.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.feeSchedules.lists(), filters] as const,
    detail: (id: string) =>
      [...queryKeys.feeSchedules.all, "detail", id] as const,
    byBand: (band: string, schoolYearId: string) =>
      [...queryKeys.feeSchedules.all, "band", band, schoolYearId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Invoices
  // ─────────────────────────────────────────────────────────────────
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.invoices.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.invoices.all, "detail", id] as const,
    byStudent: (studentId: string) =>
      [...queryKeys.invoices.all, "student", studentId] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // School Years
  // ─────────────────────────────────────────────────────────────────
  schoolYears: {
    all: ["schoolYears"] as const,
    lists: () => [...queryKeys.schoolYears.all, "list"] as const,
    list: () => queryKeys.schoolYears.lists(),
    detail: (id: string) =>
      [...queryKeys.schoolYears.all, "detail", id] as const,
    active: () => [...queryKeys.schoolYears.all, "active"] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Grade Levels
  // ─────────────────────────────────────────────────────────────────
  gradeLevels: {
    all: ["gradeLevels"] as const,
    lists: () => [...queryKeys.gradeLevels.all, "list"] as const,
    list: () => queryKeys.gradeLevels.lists(),
    detail: (id: string) =>
      [...queryKeys.gradeLevels.all, "detail", id] as const,
    byBand: (band: string) =>
      [...queryKeys.gradeLevels.all, "band", band] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Sections
  // ─────────────────────────────────────────────────────────────────
  sections: {
    all: ["sections"] as const,
    lists: () => [...queryKeys.sections.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.sections.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.sections.all, "detail", id] as const,
    byGradeLevel: (gradeLevelId: string, schoolYearId?: string) =>
      [
        ...queryKeys.sections.all,
        "gradeLevel",
        gradeLevelId,
        schoolYearId,
      ] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Subjects & Curriculum
  // ─────────────────────────────────────────────────────────────────
  subjects: {
    all: ["subjects"] as const,
    lists: () => [...queryKeys.subjects.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.subjects.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.subjects.all, "detail", id] as const,
    byCurriculum: (curriculumId: string) =>
      [...queryKeys.subjects.all, "curriculum", curriculumId] as const,
  },

  curriculums: {
    all: ["curriculums"] as const,
    lists: () => [...queryKeys.curriculums.all, "list"] as const,
    list: () => queryKeys.curriculums.lists(),
    detail: (id: string) =>
      [...queryKeys.curriculums.all, "detail", id] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Grades (Student Grade Records)
  // ─────────────────────────────────────────────────────────────────
  grades: {
    all: ["grades"] as const,
    lists: () => [...queryKeys.grades.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.grades.lists(), filters] as const,
    byStudent: (studentId: string) =>
      [...queryKeys.grades.all, "student", studentId] as const,
    bySection: (sectionId: string, gradingPeriod?: string) =>
      [...queryKeys.grades.all, "section", sectionId, gradingPeriod] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Users
  // ─────────────────────────────────────────────────────────────────
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.users.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.users.all, "detail", id] as const,
    me: () => [...queryKeys.users.all, "me"] as const,
  },

  // ─────────────────────────────────────────────────────────────────
  // Dashboard Stats (Admin/Portal)
  // ─────────────────────────────────────────────────────────────────
  dashboard: {
    all: ["dashboard"] as const,
    admin: () => [...queryKeys.dashboard.all, "admin"] as const,
    portal: (userId: string) =>
      [...queryKeys.dashboard.all, "portal", userId] as const,
    finance: () => [...queryKeys.dashboard.all, "finance"] as const,
    registrar: () => [...queryKeys.dashboard.all, "registrar"] as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────
export type QueryKeys = typeof queryKeys;
