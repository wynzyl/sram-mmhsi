"use client";

import { getStatusLabel, getStatusColor, isEditableStatus } from "../utils";

interface GradeEntryToolbarProps {
  currentStatus: string | null;
  hasUnsavedChanges: boolean;
  isCreatingSheet: boolean;
  totalExpected: number;
  totalEntered: number;
  isSaving: boolean;
  isSubmitting: boolean;
  onSave: () => void;
  onSubmitClick: () => void;
}

export function GradeEntryToolbar({
  currentStatus,
  hasUnsavedChanges,
  isCreatingSheet,
  totalExpected,
  totalEntered,
  isSaving,
  isSubmitting,
  onSave,
  onSubmitClick,
}: GradeEntryToolbarProps) {
  const canEdit = isEditableStatus(currentStatus);
  const missingCount = totalExpected - totalEntered;
  const isComplete = totalExpected > 0 && missingCount === 0;
  const canSubmit = canEdit && isComplete && totalExpected > 0;

  return (
    <div className="border-b border-border p-4 flex items-center justify-between">
      <div className="flex-row-2">
        {currentStatus && (
          <span
            className={`inline-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}
          >
            {getStatusLabel(currentStatus)}
          </span>
        )}
        {hasUnsavedChanges && canEdit && (
          <span className="text-sm text-amber-600 flex-row-1">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            Unsaved changes
          </span>
        )}
        {isCreatingSheet && (
          <span className="text-secondary">Initializing...</span>
        )}
        {!canEdit && (
          <span className="text-secondary">
            (Read-only - grades have been submitted)
          </span>
        )}
        {canEdit && totalExpected > 0 && (
          <span
            className={`text-sm ${
              isComplete ? "text-success" : "text-muted-foreground"
            }`}
          >
            {totalEntered}/{totalExpected} grades entered
            {!isComplete && ` (${missingCount} missing)`}
          </span>
        )}
      </div>

      <div className="flex-row-3">
        {canEdit && (
          <>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || isCreatingSheet || !hasUnsavedChanges}
              className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <LoadingSpinner />
                  Saving...
                </>
              ) : (
                "Save Draft"
              )}
            </button>

            <button
              type="button"
              onClick={onSubmitClick}
              disabled={isSubmitting || isCreatingSheet || !canSubmit}
              title={
                !canSubmit && missingCount > 0
                  ? `${missingCount} grade${missingCount > 1 ? "s" : ""} missing`
                  : undefined
              }
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <LoadingSpinner />
                  Submitting...
                </>
              ) : (
                "Submit for Review"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
