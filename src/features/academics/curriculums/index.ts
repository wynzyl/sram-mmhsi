/**
 * Curriculum Management Feature
 *
 * Provides versioned, immutable curriculum management with adoption bindings.
 *
 * NOTE: This index re-exports server-only code (queries).
 * For client components, import directly from:
 * - curriculums.types.ts (client-safe types)
 * - curriculums.schema.ts (validation schemas & form types)
 * - curriculums.actions.ts (server actions)
 * - subjects.actions.ts (subject server actions)
 * - adoption.actions.ts (adoption server actions)
 *
 * @module features/academics/curriculums
 */

// Schema & Types (safe for client components)
export * from "./curriculums.schema";

// Client-safe types (for components that need type imports without server-only)
export type {
  CurriculumListRow,
  CurriculumDetail,
  SubjectListRow,
  AdoptionRow,
  CurriculumVersionRow,
  AdoptionMatrixCell,
  CurriculumDropdownOption,
} from "./curriculums.types";

// Queries (server-only - will cause build errors if imported in client components)
export {
  listCurriculums,
  getCurriculumById,
  getCurriculumVersionChain,
  getCurrentCurriculumForGradeAndYear,
  getAdoptionMatrix,
  getPublishedCurriculumsForDropdown,
  getSubjectsByGradeLevelForCurriculum,
  isCurriculumNameTaken,
  getActiveSchoolYear,
  getPublishedCurriculumNames,
  getGradeLevelsForDropdown,
  // Strand-related queries (server-only)
  getSubjectStrandAssociations,
  getSubjectsWithStrandsForCurriculum,
} from "./curriculums.queries";

export type {
  SubjectWithStrands,
} from "./curriculums.queries";

// Client-safe type exports
export type {
  GradeLevelDropdownOption,
  SubjectStrandAssociation,
} from "./curriculums.types";

// Actions - Curriculum lifecycle (safe for client components as server actions)
export {
  createCurriculumAction,
  updateCurriculumMetaAction,
  cloneCurriculumAction,
  publishCurriculumAction,
  archiveCurriculumAction,
} from "./curriculums.actions";

// Actions - Subject management
export {
  addSubjectToCurriculumAction,
  updateSubjectInCurriculumAction,
  deleteSubjectFromCurriculumAction,
  restoreSubjectInCurriculumAction,
  reorderSubjectsAction,
  getSubjectStrandsAction,
} from "./subjects.actions";

// Actions - Adoption management
export {
  updateAdoptionAction,
  removeAdoptionAction,
  rollForwardAdoptionsFromPriorYear,
} from "./adoption.actions";

// Pure logic functions (safe for client components)
export {
  prepareSubjectsForClone,
  getNextVersion,
  generateDraftName,
} from "./curriculum-clone";

export {
  validatePublishPreflight,
  validateCurriculumName,
  type PreflightSubjectSummary,
  type PreflightResult,
} from "./curriculum-preflight";

export {
  checkArchiveEligibility,
  isCurriculumInUse,
  checkAdoptionChangeEligibility,
  type AdoptionInfo,
  type ArchiveGuardResult,
} from "./archive-guard";
