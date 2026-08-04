// Schema and types
export * from "./electives.schema";

// Queries
export {
  getElectiveSubjects,
  getElectivesByStrand,
  getElectivesForSection,
} from "./electives.queries";

// Components
export { ElectiveSubjectsTable, ElectivesByStrandView } from "./components";
