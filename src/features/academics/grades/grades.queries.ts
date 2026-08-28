import "server-only";

/**
 * Grade Queries - Re-exports for backward compatibility
 *
 * This file re-exports all grade-related queries from their focused modules:
 * - grade-sheet.queries.ts: Grade sheet CRUD and approval
 * - adviser.queries.ts: Adviser sections and grade entry
 * - shs.queries.ts: SHS strand-based queries
 * - teacher-assignments.queries.ts: Legacy teacher assignments
 *
 * Import from specific modules for new code:
 * - import { getGradeSheetById } from "@/features/academics/grades/grade-sheet.queries";
 * - import { getAdviserSections } from "@/features/academics/grades/adviser.queries";
 * - import { getStudentsWithStrandsInSection } from "@/features/academics/grades/shs.queries";
 */

// ─── Re-exports from canonical locations ─────────────────────────────────────
export { getActiveSchoolYear } from "@/lib/queries/schoolYears";

// ─── Grade Sheet Queries ─────────────────────────────────────────────────────
export {
  // List queries
  getAdviserGradeSheets,
  getPrincipalPendingReviews,
  getReadyToPublishSheets,
  getPublishedSheets,
  getLockedSheets,
  getGradeSheetById,
  // Entry queries
  getGradeSheetEntries,
  getPublishedGradesForStudent,
  // Approval
  getGradeSheetApprovalHistory,
  // Grade entry data
  type GradeSheetData,
  getGradeSheetForPeriod,
  type PeriodCompletionStatus,
  getPeriodsCompletionStatus,
  // Unified page data fetcher
  type GradeEntryPageData,
  type RegularGradeEntryPageData,
  type SHSGradeEntryPageData,
  getGradeEntryPageData,
} from "./grade-sheet.queries";

// ─── Adviser Queries ─────────────────────────────────────────────────────────
export {
  // Types
  type AdviserSectionCard,
  type SectionStudent,
  type GradeLevelSubject,
  // Section queries
  getAdviserSections,
  isAdviserForSection,
  sectionHasAdviser,
  getSectionDetails,
  getSectionsForAssignment,
  // Student queries
  getStudentsInSection,
  // Subject queries
  getSubjectsForGradeLevel,
  getSubjectsForAssignment,
} from "./adviser.queries";

// ─── SHS Queries ─────────────────────────────────────────────────────────────
export {
  // Types
  type SubjectOfferingForGrades,
  type SHSSubjectOffering,
  type SHSGradeEntrySubjects,
  type SHSSectionStudent,
  type StudentWithSSE,
  // Helper
  getGradingSystemType,
  // Subject queries
  getSubjectsFromOfferingsForSection,
  getSubjectsForSHSGradeEntry,
  // Student queries
  getStudentsWithStrandsInSection,
  getStudentsWithSSEForSection,
} from "./shs.queries";

// ─── Teacher Assignments (Legacy) ────────────────────────────────────────────
export {
  // Types
  type TeacherAssignmentListItem,
  // Queries
  isTeacherAssignedToSection,
  getAllTeacherAssignments,
  getPaginatedTeacherAssignments,
} from "./teacher-assignments.queries";
