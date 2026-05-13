// Actions
export * from "./enrollments.actions";
export * from "./enrollment-confirmation.actions";

// Queries - Export types only (functions are server-only, import directly from query files)
export type {
  ReadyToEnrollStudent,
  PendingEnrollment,
  AssessedEnrollment,
  EnrolledStudent,
  CancelledEnrollment,
  EnrollmentQueueData,
  TabKey,
} from "./enrollments-queue.queries";

export type {
  RegistrationEnrollmentContext,
} from "./enrollment-registration-context.queries";

// Query functions must be imported directly from the query files in server components
// Example: import { getEnrollmentQueueData } from "@/features/enrollments/enrollments-queue.queries";

// Schemas
export * from "./enrollments.schema";

// Components
export { default as CancelEnrollmentForm } from "./components/CancelEnrollmentForm";
export type { EnrollmentStatus, CancelEnrollmentFormProps } from "./components/CancelEnrollmentForm";
export { default as EnrollmentCard } from "./components/EnrollmentCard";
export type { EnrollmentCardRow, SectionOption } from "./components/EnrollmentCard";
export { default as EnrollmentConfirmationDrawer } from "./components/EnrollmentConfirmationDrawer";
export { default as EnrollmentGlobalFilters } from "./components/EnrollmentGlobalFilters";
export { default as EnrollmentQueueTabs } from "./components/EnrollmentQueueTabs";
export { default as EnrollmentsListView } from "./components/EnrollmentsListView";
export { default as EnrollmentsTable } from "./components/EnrollmentsTable";
export {
  PendingEnrollmentsTable,
  AssessedEnrollmentsTable,
  EnrolledStudentsTable,
  CancelledEnrollmentsTable,
} from "./components/EnrollmentStatusTables";
export { default as EnrollmentStepper } from "./components/EnrollmentStepper";
export type { StepDescriptor } from "./components/EnrollmentStepper";
export { default as EnrollmentWizardForm } from "./components/EnrollmentWizardForm";
export { default as IntakeRequirementsFieldset } from "./components/IntakeRequirementsFieldset";
export { default as NewEnrollmentForm } from "./components/NewEnrollmentForm";
export { default as PaymentProgressBar } from "./components/PaymentProgressBar";
export { default as PlacementPreviewCard } from "./components/PlacementPreviewCard";
export type { PlacementType } from "./components/PlacementPreviewCard";
export { default as ReadyToEnrollTable } from "./components/ReadyToEnrollTable";
export { default as ReadyToEnrollTableClient } from "./components/ReadyToEnrollTableClient";
export { default as StudentPicker } from "./components/StudentPicker";
export type { StudentPickerOption } from "./components/StudentPicker";

// Re-export intake document utilities
export { parseIntakeDocumentStatus } from '@/lib/validators/intake-documents';
