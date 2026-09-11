/**
 * Director's List Feature
 *
 * Re-exports all director's list functionality for clean imports.
 */

// Types and constants
export {
  DIRECTORS_LIST_THRESHOLDS,
  ACADEMIC_LEVEL_LABELS,
  getDirectorsListThreshold,
  qualifiesForDirectorsList,
  getThresholdForGradeLevel,
  getAcademicLevelLabel,
} from "./directors-list.types";

// Schemas
export {
  directorsListFilterSchema,
  type DirectorsListFilter,
  type DirectorsListEntry,
  type DirectorsListSummary,
  type DirectorsListResult,
  type DirectorsListReportMeta,
  type DirectorsListReportRow,
} from "./directors-list.schema";

// Queries
export {
  getDirectorsList,
  getTopPerformers,
  getAvailableGradingPeriods,
} from "./directors-list.queries";

// Components
export * from "./components";
