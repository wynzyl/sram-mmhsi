// Schemas and types
export * from "./subject-offerings.schema";

// Re-export type only (no runtime import)
export type { TeacherClassCard } from "./subject-offerings.queries";

// NOTE: Query functions are NOT exported here because they contain "server-only".
// Import queries directly from "./subject-offerings.queries" in server components only.

// Actions
export {
  generateSubjectOfferingsAction,
  assignTeacherAction,
  deleteSubjectOfferingAction,
  deleteAllSubjectOfferingsAction,
  addManualSubjectOfferingAction,
  getAvailableSubjectsForManualOfferingAction,
  updateOfferingTrackAction,
} from "./subject-offerings.actions";

// Components
export {
  SubjectOfferingsTable,
  SubjectOfferingsByStrand,
  AssignTeacherDialog,
  DeleteOfferingDialog,
  ChangeTrackDialog,
  GenerateOfferingsButton,
  DeleteAllOfferingsButton,
  TeacherClassesCards,
  AddManualOfferingButton,
  AddManualOfferingDialog,
  type EnrolledStrandInfo,
} from "./components";
