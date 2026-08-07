/**
 * Grade sheet status labels and colors.
 * Shared across all grade entry components to avoid duplication.
 */

import type { GradeSheetStatus } from "@/lib/constants/grading-periods";

/**
 * Human-readable labels for grade sheet statuses.
 */
export const GRADE_SHEET_STATUS_LABELS: Record<GradeSheetStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for Approval",
  returned: "Returned for Revision",
  principal_approved: "Principal Approved",
  published: "Published",
  locked: "Locked",
};

/**
 * Tailwind CSS classes for grade sheet status badges.
 */
export const GRADE_SHEET_STATUS_COLORS: Record<GradeSheetStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  principal_approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  published: "bg-success/15 text-success",
  locked: "bg-muted text-muted-foreground",
};

/**
 * Get human-readable label for a grade sheet status.
 */
export function getStatusLabel(status: string): string {
  return GRADE_SHEET_STATUS_LABELS[status as GradeSheetStatus] || status;
}

/**
 * Get Tailwind CSS classes for a grade sheet status badge.
 */
export function getStatusColor(status: string): string {
  return GRADE_SHEET_STATUS_COLORS[status as GradeSheetStatus] || "bg-muted text-muted-foreground";
}

/**
 * Statuses that allow editing grades.
 */
export const EDITABLE_STATUSES: GradeSheetStatus[] = ["draft", "returned"];

/**
 * Check if a grade sheet status allows editing.
 */
export function isEditableStatus(status: string | null): boolean {
  if (!status) return true; // No status means new sheet, editable
  return EDITABLE_STATUSES.includes(status as GradeSheetStatus);
}
