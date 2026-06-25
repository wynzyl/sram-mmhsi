/**
 * Archive Feature Module
 *
 * Manages archived students (graduated, transferred, withdrawn, cancelled, inactive)
 * and End-of-Year (EOY) batch operations.
 */

// Guards
export {
  assertStudentMutable,
  isStudentArchived,
  getStudentStatus,
  formatArchiveError,
  StudentArchivedException,
  type ArchiveBlockedAction,
  ARCHIVE_BLOCKED_ACTION_LABELS,
} from "./archive.guards";

// Schemas
export {
  archiveStudentSchema,
  unarchiveStudentSchema,
  batchArchiveGraduatesSchema,
  batchCancelNoShowSchema,
  archiveFilterSchema,
  type ArchiveStudentInput,
  type ArchiveStudentFormState,
  type UnarchiveStudentInput,
  type UnarchiveStudentFormState,
  type BatchArchiveGraduatesInput,
  type BatchArchiveGraduatesFormState,
  type BatchCancelNoShowInput,
  type BatchCancelNoShowFormState,
  type ArchiveFilterInput,
  type ArchiveSummary,
} from "./archive.schema";

// Queries
export {
  fetchArchivedStudentsPage,
  getArchiveSummary,
  getArchivedStudent,
  getGraduationCandidates,
  getNoShowCandidates,
  ARCHIVE_DIRECTORY_PAGE_SIZE,
  type ArchivedStudentRow,
  type ArchiveSchoolYearOption,
} from "./archive.queries";

// Actions (re-exported for convenience but should be imported directly in client components)
export {
  archiveStudentAction,
  unarchiveStudentAction,
  batchArchiveGraduatesAction,
  batchCancelNoShowAction,
} from "./archive.actions";
