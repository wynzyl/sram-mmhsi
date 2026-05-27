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
 *
 * Only namespaces with live `useQuery`/invalidation references are kept here.
 * Add a namespace when a feature actually subscribes to it — not before.
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
} as const;

// ─────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────
export type QueryKeys = typeof queryKeys;
