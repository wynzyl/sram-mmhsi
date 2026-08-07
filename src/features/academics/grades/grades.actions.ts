/**
 * Grade Actions - Re-exports for backward compatibility
 *
 * This file re-exports all grade-related actions from their focused modules:
 * - grade-sheet.actions.ts: CRUD operations for grade sheets
 * - grade-approval.actions.ts: Approval workflow actions
 *
 * NOTE: This file does NOT have "use server" directive because it's a barrel file.
 * The actual server actions have their own "use server" directives in their respective files.
 *
 * Import from specific modules for new code:
 * - import { createOrGetGradeSheetAction } from "@/features/academics/grades/grade-sheet.actions";
 * - import { principalApproveAction } from "@/features/academics/grades/grade-approval.actions";
 */

// ─── Grade Sheet CRUD Actions ────────────────────────────────────────────────
export {
  // Validation helpers (exported for testing/reuse)
  isAssignedSectionAdviser,
  validatePreviousPeriodsSubmitted,
  getValidSubjectIdsForSection,
  validateGradeSheetCompleteness,
  // Actions
  createOrGetGradeSheetAction,
  saveGradeSheetEntriesAction,
  submitGradeSheetAction,
} from "./grade-sheet.actions";

// ─── Grade Approval Actions ──────────────────────────────────────────────────
export {
  principalReturnAction,
  principalApproveAction,
  publishGradesAction,
  lockGradesAction,
  unlockGradesAction,
} from "./grade-approval.actions";
