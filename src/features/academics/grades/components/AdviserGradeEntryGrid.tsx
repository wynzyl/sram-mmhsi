"use client";

import { useState, useCallback, useRef, startTransition, memo } from "react";
import { useRouter } from "next/navigation";
import {
  createOrGetGradeSheetAction,
  saveGradeSheetEntriesAction,
  submitGradeSheetAction,
} from "../grades.actions";
import type { SectionStudent, GradeLevelSubject } from "../grades.queries";
import type {
  SaveGradeSheetEntriesFormState,
  SubmitGradeSheetFormState,
} from "../grades.schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getGradeRemarks } from "@/lib/constants/grading-periods";
import {
  isAcceptableGradeInput,
  resolveGradeCommit,
} from "../grade-entry-validation";

interface AdviserGradeEntryGridProps {
  sectionId: string;
  schoolYearId: string;
  gradingPeriod: string;
  students: SectionStudent[];
  subjects: GradeLevelSubject[];
  initialGradeSheetId?: string | null;
  initialEntries?: Array<{
    studentId: string;
    subjectId: string;
    grade: string | null;
  }>;
  gradeSheetStatus?: string | null;
}

// Statuses that allow editing
const EDITABLE_STATUSES = ["draft", "returned"];

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted for Approval",
    principal_approved: "Principal Approved",
    published: "Published",
    locked: "Locked",
    returned: "Returned for Revision",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    principal_approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    published: "bg-success/15 text-success",
    locked: "bg-muted text-muted-foreground",
    returned: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  };
  return colors[status] || "bg-muted text-muted-foreground";
}

// Use the shared getGradeRemarks function from constants

/**
 * Memoized GradeCell component.
 * Owns its local input state and syncs to parent on blur.
 * This prevents re-rendering 400+ cells on every keystroke.
 */
interface GradeCellProps {
  studentId: string;
  subjectId: string;
  initialValue: string;
  disabled: boolean;
  onCommit: (studentId: string, subjectId: string, value: string) => void;
}

const GradeCell = memo(function GradeCell({
  studentId,
  subjectId,
  initialValue,
  disabled,
  onCommit,
}: GradeCellProps) {
  const [localValue, setLocalValue] = useState(initialValue);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!isAcceptableGradeInput(value)) return;
    setLocalValue(value);

    // Sync complete, in-range drafts upward immediately so the toolbar counter
    // and Save/Submit eligibility track typing instead of lagging until blur.
    // Partial drafts ("6" on the way to "60") resolve to `revert` and are left
    // uncommitted — reverting mid-typing would make the cell impossible to fill.
    const decision = resolveGradeCommit(value);
    if (decision.action === "commit") {
      onCommit(studentId, subjectId, decision.value);
    }
  };

  const handleBlur = () => {
    const decision = resolveGradeCommit(localValue);
    if (decision.action === "commit") {
      onCommit(studentId, subjectId, decision.value);
    } else {
      setLocalValue(initialValue);
    }
  };

  return (
    <input
      type="number"
      min="60"
      max="100"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      className={`w-16 text-center rounded-md border-border bg-background text-foreground shadow-sm text-sm ${
        disabled
          ? "bg-muted text-muted-foreground cursor-not-allowed"
          : "focus:border-primary focus:ring-primary"
      }`}
      placeholder="--"
    />
  );
});

export function AdviserGradeEntryGrid({
  sectionId,
  schoolYearId,
  gradingPeriod,
  students,
  subjects,
  initialGradeSheetId = null,
  initialEntries = [],
  gradeSheetStatus = null,
}: AdviserGradeEntryGridProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Grade sheet state
  const [gradeSheetId, setGradeSheetId] = useState<string | null>(initialGradeSheetId);
  const [currentStatus, setCurrentStatus] = useState<string | null>(gradeSheetStatus);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Determine if editing is allowed based on status
  const canEdit = !currentStatus || EDITABLE_STATUSES.includes(currentStatus);

  // Grade entries state: Map of "studentId:subjectId" -> grade value
  const [grades, setGrades] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    initialEntries.forEach((entry) => {
      if (entry.grade) {
        map.set(`${entry.studentId}:${entry.subjectId}`, entry.grade);
      }
    });
    return map;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Action states — these flows run imperatively (create sheet → save → submit),
  // so results and pending flags are tracked manually rather than via useActionState
  // dispatchers (which don't return the result the sequential flow depends on).
  const [saveState, setSaveState] = useState<SaveGradeSheetEntriesFormState>({});
  const [submitState, setSubmitState] = useState<SubmitGradeSheetFormState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit confirmation dialog state (replaces browser confirm())
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Create grade sheet on first interaction
  const ensureGradeSheet = useCallback(async (): Promise<string | null> => {
    if (gradeSheetId) return gradeSheetId;

    setIsCreatingSheet(true);
    setCreateError(null);

    const formData = new FormData();
    formData.append("sectionId", sectionId);
    formData.append("schoolYearId", schoolYearId);
    formData.append("gradingPeriod", gradingPeriod);

    const result = await createOrGetGradeSheetAction({}, formData);
    setIsCreatingSheet(false);

    if (result.success && result.gradeSheetId) {
      setGradeSheetId(result.gradeSheetId);
      // New grade sheets are always in draft status
      if (!currentStatus) {
        setCurrentStatus("draft");
      }
      return result.gradeSheetId;
    } else {
      setCreateError(result.message || "Failed to create grade sheet");
      return null;
    }
  }, [gradeSheetId, sectionId, schoolYearId, gradingPeriod, currentStatus]);

  // Handle grade input change
  const handleGradeChange = useCallback(
    (studentId: string, subjectId: string, value: string) => {
      const key = `${studentId}:${subjectId}`;
      setGrades((prev) => {
        const next = new Map(prev);
        if (value === "") {
          next.delete(key);
        } else {
          // Validate grade range
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            next.set(key, value);
          }
        }
        return next;
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  // Save grades. Awaits the server action so callers can sequence off its result.
  // Returns true only when the save actually succeeded.
  const handleSave = useCallback(async (): Promise<boolean> => {
    const sheetId = await ensureGradeSheet();
    if (!sheetId) return false;

    const entries = Array.from(grades.entries()).map(([key, grade]) => {
      const [studentId, subjectId] = key.split(":");
      const numGrade = parseInt(grade, 10);
      return {
        studentId,
        subjectId,
        grade: numGrade,
        remarks: !isNaN(numGrade) ? getGradeRemarks(numGrade) : undefined,
      };
    });

    const formData = new FormData();
    formData.append("gradeSheetId", sheetId);
    formData.append("entries", JSON.stringify(entries));

    setIsSaving(true);
    try {
      const result = await saveGradeSheetEntriesAction({}, formData);
      setSaveState(result);
      if (result.success) {
        setHasUnsavedChanges(false);
        return true;
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [ensureGradeSheet, grades]);

  // Submit for review — save first, and only submit if that save actually succeeded.
  const handleSubmit = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;

    const sheetId = await ensureGradeSheet();
    if (!sheetId) return;

    const formData = new FormData();
    formData.append("gradeSheetId", sheetId);

    setIsSubmitting(true);
    try {
      const result = await submitGradeSheetAction({}, formData);
      setSubmitState(result);
      if (result.success) {
        setCurrentStatus("submitted");
        startTransition(() => {
          router.refresh();
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSave, ensureGradeSheet, router]);

  // Get grade value for a student-subject pair
  const getGrade = (studentId: string, subjectId: string): string => {
    return grades.get(`${studentId}:${subjectId}`) || "";
  };

  // Calculate completion status for submit validation
  const totalExpected = students.length * subjects.length;
  const totalEntered = grades.size;
  const missingCount = totalExpected - totalEntered;
  const isComplete = totalExpected > 0 && missingCount === 0;

  // Determine if submit is allowed
  const canSubmit = canEdit && isComplete && totalExpected > 0;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex-row-2">
          {currentStatus && (
            <span className={`inline-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
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
                onClick={handleSave}
                disabled={isSaving || isCreatingSheet || !hasUnsavedChanges}
                className="inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
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
                    Saving...
                  </>
                ) : (
                  "Save Draft"
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
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

      {/* Status Messages */}
      {createError && (
        <div className="p-4 border-b bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800">
          {createError}
        </div>
      )}

      {saveState.message && (
        <div
          className={`p-4 border-b ${
            saveState.success
              ? "bg-success/10 text-success border-success/30"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {saveState.message}
        </div>
      )}

      {submitState.message && (
        <div
          className={`p-4 border-b ${
            submitState.success
              ? "bg-success/10 text-success border-success/30"
              : "bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {submitState.message}
        </div>
      )}

      {/* Grade Entry Grid */}
      <div className="overflow-x-auto">
        <form ref={formRef}>
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-muted px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-r border-border min-w-[200px]"
                >
                  Student Name
                </th>
                {subjects.map((subject) => (
                  <th
                    key={subject.id}
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]"
                    title={subject.name}
                  >
                    {subject.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {students.map((student, studentIndex) => (
                <tr
                  key={student.id}
                  className={studentIndex % 2 === 0 ? "bg-card" : "bg-muted/50"}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 whitespace-nowrap text-sm font-medium text-foreground border-r border-border">
                    <div className="flex flex-col">
                      <span>{student.fullName}</span>
                      <span className="text-helper">
                        {student.studentRef}
                      </span>
                    </div>
                  </td>
                  {subjects.map((subject) => (
                    <td key={subject.id} className="px-2 py-2 text-center">
                      <GradeCell
                        studentId={student.id}
                        subjectId={subject.id}
                        initialValue={getGrade(student.id, subject.id)}
                        disabled={!canEdit}
                        onCommit={handleGradeChange}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </form>
      </div>

      {/* Legend */}
      <div className="border-t border-border p-4 bg-muted">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Grading Scale
        </h4>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">90-100:</strong> Outstanding
          </span>
          <span>
            <strong className="text-foreground">85-89:</strong> Very Satisfactory
          </span>
          <span>
            <strong className="text-foreground">80-84:</strong> Satisfactory
          </span>
          <span>
            <strong className="text-foreground">75-79:</strong> Fairly Satisfactory
          </span>
          <span>
            <strong className="text-foreground">Below 75:</strong> Did Not Meet Expectations
          </span>
        </div>
      </div>

      {/* Submit Confirmation Dialog - replaces browser confirm() for accessibility */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Grades for Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit these grades for principal approval?
              You will not be able to edit them until they are returned for revision.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowSubmitConfirm(false);
                handleSubmit();
              }}
            >
              Submit for Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
