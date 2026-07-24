// Schemas and types
export * from "./subject-offerings.schema";

// Queries
export {
  getSubjectOfferingsForSection,
  getSubjectsForOfferingGeneration,
  getTeachersForAssignment,
  hasExistingOfferings,
  getSubjectOfferingById,
  getSubjectOfferingsForTeacher,
  type TeacherClassCard,
} from "./subject-offerings.queries";

// Actions
export {
  generateSubjectOfferingsAction,
  assignTeacherAction,
  deleteSubjectOfferingAction,
} from "./subject-offerings.actions";

// Components
export {
  SubjectOfferingsTable,
  AssignTeacherDialog,
  DeleteOfferingDialog,
  GenerateOfferingsButton,
  TeacherClassesCards,
} from "./components";
