"use client";

import { useActionState, useState, useCallback, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  createOrGetGradeSheetAction,
  saveGradeSheetEntriesAction,
  submitGradeSheetAction,
} from "../grades.actions";
import type { SectionStudent, GradeLevelSubject } from "../grades.queries";

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
    draft: "bg-gray-100 text-gray-800",
    submitted: "bg-blue-100 text-blue-800",
    principal_approved: "bg-purple-100 text-purple-800",
    published: "bg-green-100 text-green-800",
    locked: "bg-gray-100 text-gray-800",
    returned: "bg-amber-100 text-amber-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

function getRemarks(grade: number): string {
  if (grade < 75) return "Did Not Meet Expectations";
  if (grade < 80) return "Fairly Satisfactory";
  if (grade < 85) return "Satisfactory";
  if (grade < 90) return "Very Satisfactory";
  return "Outstanding";
}

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
  const [, startTransition] = useTransition();
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

  // Action states
  const [saveState, , isSaving] = useActionState(saveGradeSheetEntriesAction, {});
  const [submitState, , isSubmitting] = useActionState(submitGradeSheetAction, {});

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

  // Save grades
  const handleSave = useCallback(async () => {
    const sheetId = await ensureGradeSheet();
    if (!sheetId) return;

    const entries = Array.from(grades.entries()).map(([key, grade]) => {
      const [studentId, subjectId] = key.split(":");
      const numGrade = parseInt(grade, 10);
      return {
        studentId,
        subjectId,
        grade: numGrade,
        remarks: !isNaN(numGrade) ? getRemarks(numGrade) : undefined,
      };
    });

    const formData = new FormData();
    formData.append("gradeSheetId", sheetId);
    formData.append("entries", JSON.stringify(entries));

    startTransition(async () => {
      const result = await saveGradeSheetEntriesAction({}, formData);
      if (result.success) {
        setHasUnsavedChanges(false);
      }
    });
  }, [ensureGradeSheet, grades]);

  // Submit for review
  const handleSubmit = useCallback(async () => {
    // First save
    await handleSave();

    const sheetId = await ensureGradeSheet();
    if (!sheetId) return;

    const formData = new FormData();
    formData.append("gradeSheetId", sheetId);

    startTransition(async () => {
      const result = await submitGradeSheetAction({}, formData);
      if (result.success) {
        setCurrentStatus("submitted");
        router.refresh();
      }
    });
  }, [handleSave, ensureGradeSheet, router]);

  // Get grade value for a student-subject pair
  const getGrade = (studentId: string, subjectId: string): string => {
    return grades.get(`${studentId}:${subjectId}`) || "";
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {currentStatus && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(currentStatus)}`}>
              {getStatusLabel(currentStatus)}
            </span>
          )}
          {hasUnsavedChanges && canEdit && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
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
            <span className="text-sm text-gray-500">Initializing...</span>
          )}
          {!canEdit && (
            <span className="text-sm text-gray-500">
              (Read-only - grades have been submitted)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isCreatingSheet || !hasUnsavedChanges}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to submit these grades for principal approval? You won't be able to edit them until they are returned."
                    )
                  ) {
                    handleSubmit();
                  }
                }}
                disabled={isSubmitting || isCreatingSheet || grades.size === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="p-4 border-b bg-red-50 text-red-800 border-red-200">
          {createError}
        </div>
      )}

      {saveState.message && (
        <div
          className={`p-4 border-b ${
            saveState.success
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {saveState.message}
        </div>
      )}

      {submitState.message && (
        <div
          className={`p-4 border-b ${
            submitState.success
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {submitState.message}
        </div>
      )}

      {/* Grade Entry Grid */}
      <div className="overflow-x-auto">
        <form ref={formRef}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 min-w-[200px]"
                >
                  Student Name
                </th>
                {subjects.map((subject) => (
                  <th
                    key={subject.id}
                    scope="col"
                    className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px]"
                    title={subject.name}
                  >
                    {subject.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {students.map((student, studentIndex) => (
                <tr
                  key={student.id}
                  className={studentIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                    <div className="flex flex-col">
                      <span>{student.fullName}</span>
                      <span className="text-xs text-gray-500">
                        {student.studentRef}
                      </span>
                    </div>
                  </td>
                  {subjects.map((subject) => (
                    <td key={subject.id} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="60"
                        max="100"
                        value={getGrade(student.id, subject.id)}
                        onChange={(e) =>
                          handleGradeChange(student.id, subject.id, e.target.value)
                        }
                        disabled={!canEdit}
                        className={`w-16 text-center rounded-md border-gray-300 shadow-sm text-sm ${
                          canEdit
                            ? "focus:border-primary-500 focus:ring-primary-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                        placeholder="--"
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
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Grading Scale
        </h4>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span>
            <strong>90-100:</strong> Outstanding
          </span>
          <span>
            <strong>85-89:</strong> Very Satisfactory
          </span>
          <span>
            <strong>80-84:</strong> Satisfactory
          </span>
          <span>
            <strong>75-79:</strong> Fairly Satisfactory
          </span>
          <span>
            <strong>Below 75:</strong> Did Not Meet Expectations
          </span>
        </div>
      </div>
    </div>
  );
}
