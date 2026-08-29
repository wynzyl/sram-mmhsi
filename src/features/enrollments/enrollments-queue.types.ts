/**
 * Enrollment Queue feature type definitions
 *
 * Shared DTO types for enrollment queue-related queries and components.
 * These types are extracted from enrollments-queue.queries.ts for better
 * organization and reusability across the codebase.
 */

import type { EnrollmentIntakeDocuments } from "@/lib/db/schema";

// ─────────────────────────────────────────────────────────────────
// Ready to Enroll Types
// ─────────────────────────────────────────────────────────────────

/**
 * Lean DTO for table display (14 fields)
 * Used by ReadyToEnrollTable - excludes heavy fields like intakeDocuments
 */
export type ReadyToEnrollListRow = {
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  isSpecialEducation: boolean;
  studentType: "new_student" | "transferee" | "old_student";

  // For new/transferee students
  registrationId: string | null;
  registrationGradeLevelId: string | null;
  registrationGradeName: string | null;

  // For old students
  previousGradeName: string | null;
  suggestedGradeLevelId: string | null;
  suggestedGradeName: string | null;

  // Balance info (for old students only)
  hasOutstandingBalance: boolean;
  outstandingAmount: string | null;

  // Document completion
  hasCompleteDocuments: boolean;
};

/**
 * Detail DTO for drawer/detail view (includes intakeDocuments)
 * Fetched on-demand when drawer opens via getReadyToEnrollDetail()
 */
export type ReadyToEnrollDetail = ReadyToEnrollListRow & {
  intakeDocuments: EnrollmentIntakeDocuments | null;
};

/**
 * @deprecated Use ReadyToEnrollListRow for tables, ReadyToEnrollDetail for drawer
 * Kept for backward compatibility during migration
 */
export type ReadyToEnrollStudent = {
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  studentType: "new_student" | "transferee" | "old_student";

  // For new/transferee students (from approved registration)
  registrationId: string | null;
  registrationGradeLevelId: string | null;
  registrationGradeName: string | null;
  intakeDocuments: EnrollmentIntakeDocuments | null;

  // For old students (from previous enrollment)
  previousEnrollmentId: string | null;
  previousGradeLevelId: string | null;
  previousGradeName: string | null;
  previousGradeOrder: number | null;
  suggestedGradeLevelId: string | null;
  suggestedGradeName: string | null;
  suggestedGradeOrder: number | null;

  // Balance info (for old students only)
  hasOutstandingBalance: boolean;
  outstandingAmount: string | null;

  // Document completion
  hasCompleteDocuments: boolean;
};

// ─────────────────────────────────────────────────────────────────
// Pending Enrollment Types
// ─────────────────────────────────────────────────────────────────

export type PendingEnrollment = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  isSpecialEducation: boolean;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  studentType: "new_student" | "transferee" | "old_student";
  createdAt: Date;
  createdBy: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Assessed Enrollment Types
// ─────────────────────────────────────────────────────────────────

export type AssessedEnrollment = {
  enrollmentId: string;
  assessmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  isSpecialEducation: boolean;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  totalAmount: string;
  totalPaid: string;
  balance: string;
  billingStatus: "outstanding" | "fully_paid" | "cancelled";
  createdAt: Date;
};

// ─────────────────────────────────────────────────────────────────
// Enrolled Student Types
// ─────────────────────────────────────────────────────────────────

export type EnrolledStudent = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  isSpecialEducation: boolean;
  gradeLevelId: string;
  gradeName: string;
  sectionId: string | null;
  sectionName: string | null;
  enrolledAt: Date;
  studentType: "new_student" | "transferee" | "old_student";
};

// ─────────────────────────────────────────────────────────────────
// Cancelled Enrollment Types
// ─────────────────────────────────────────────────────────────────

export type CancelledEnrollment = {
  enrollmentId: string;
  studentId: string;
  studentRef: string;
  firstName: string;
  lastName: string;
  isSpecialEducation: boolean;
  gradeLevelId: string;
  gradeName: string;
  studentType: "new_student" | "transferee" | "old_student";
  cancelledAt: Date;
  cancelledBy: string | null;
  cancelRemarks: string | null;
};

// ─────────────────────────────────────────────────────────────────
// Enrollment Queue Data Types
// ─────────────────────────────────────────────────────────────────

export type EnrollmentQueueData = {
  readyToEnroll: ReadyToEnrollStudent[];
  pending: PendingEnrollment[];
  assessed: AssessedEnrollment[];
  enrolled: EnrolledStudent[];
  cancelled: CancelledEnrollment[];
};

export type TabKey = "ready-to-enroll" | "pending" | "assessed" | "enrolled" | "cancelled";

// ─────────────────────────────────────────────────────────────────
// Queue Filter Types
// ─────────────────────────────────────────────────────────────────

/**
 * Optional filters applied at the SQL level so search works across ALL pages,
 * not just the currently fetched one (audit finding F5).
 */
export type EnrollmentQueueFilters = {
  /** Matches first name, last name, or student reference number (ILIKE). */
  search?: string;
  /** Filters by the enrolling grade level id. */
  gradeLevelId?: string;
};

// ─────────────────────────────────────────────────────────────────
// Queue Counts Types
// ─────────────────────────────────────────────────────────────────

export type EnrollmentQueueCounts = {
  readyToEnroll: number;
  pending: number;
  assessed: number;
  enrolled: number;
  cancelled: number;
};
