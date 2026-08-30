"use client";

import { useState, useMemo, useCallback, useRef, startTransition, memo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createOrGetGradeSheetAction,
  saveGradeSheetEntriesAction,
  submitGradeSheetAction,
} from "../grade-sheet.actions";
import type {
  SaveGradeSheetEntriesFormState,
  SubmitGradeSheetFormState,
} from "../grades.schema";
import type { SHSGradeEntrySubjects, SHSSectionStudent, SHSSubjectOffering } from "../grades.queries";
import { getGradeRemarks } from "@/lib/constants/grading-periods";
import {
  isAcceptableGradeInput,
  resolveGradeCommit,
} from "../grade-entry-validation";
import {
  getStatusLabel,
  getStatusColor,
  isEditableStatus,
  gradeKey,
  parseGradeKey,
} from "../utils";
import { GradeEntryLegend } from "./GradeEntryLegend";
import { GradeEntryStatusMessage, GradeEntryErrorBanner } from "./GradeEntryStatusMessages";
import { GradeSubmitConfirmDialog } from "./GradeSubmitConfirmDialog";

type TabCategory = "all" | string; // "all" for all tracks, or track code

interface SHSGradeEntryTabsProps {
  sectionId: string;
  schoolYearId: string;
  gradingPeriod: string;
  students: SHSSectionStudent[];
  subjects: SHSGradeEntrySubjects;
  initialGradeSheetId?: string | null;
  initialEntries?: Array<{
    studentId: string;
    subjectId: string;
    grade: string | null;
  }>;
  gradeSheetStatus?: string | null;
}

/**
 * Memoized SHSGradeCell component.
 * Owns its local input state and syncs to parent on blur.
 * This prevents re-rendering all cells on every keystroke.
 */
interface SHSGradeCellProps {
  studentId: string;
  subjectId: string;
  initialValue: string;
  disabled: boolean;
  isApplicable: boolean;
  studentStrand: string | null;
  onCommit: (studentId: string, subjectId: string, value: string) => void;
}

const SHSGradeCell = memo(function SHSGradeCell({
  studentId,
  subjectId,
  initialValue,
  disabled,
  isApplicable,
  studentStrand,
  onCommit,
}: SHSGradeCellProps) {
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

  const cellDisabled = disabled || !isApplicable;

  return (
    <input
      type="number"
      min="60"
      max="100"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={cellDisabled}
      className={cn(
        "w-16 text-center rounded-md border-border shadow-sm text-sm",
        !isApplicable
          ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
          : !disabled
            ? "bg-background text-foreground focus:border-primary focus:ring-primary"
            : "bg-muted text-muted-foreground cursor-not-allowed"
      )}
      placeholder={isApplicable ? "--" : ""}
      title={
        !isApplicable
          ? `Not applicable - student is ${studentStrand || "no strand"}`
          : undefined
      }
    />
  );
});

/**
 * SHSGradeEntryTabs - Grade entry component for SHS sections with strand-based tabs.
 *
 * Tabs:
 * - "All Strands" - Shows ALL students with all subjects (core + all electives).
 *   Each student can enter grades for their applicable subjects (core + their strand's electives).
 * - Strand tabs (STEM, ABM, etc.) - Shows only students enrolled in that strand
 *   with core + that strand's electives.
 */
export function SHSGradeEntryTabs({
  sectionId,
  schoolYearId,
  gradingPeriod,
  students,
  subjects,
  initialGradeSheetId = null,
  initialEntries = [],
  gradeSheetStatus = null,
}: SHSGradeEntryTabsProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Active tab - default to first available track or "all"
  const [activeTab, setActiveTab] = useState<TabCategory>(() => {
    // If there are tracks with subjects, default to first track
    if (subjects.availableStrands.length > 0) {
      return subjects.availableStrands[0];
    }
    return "all";
  });

  // Grade sheet state
  const [gradeSheetId, setGradeSheetId] = useState<string | null>(initialGradeSheetId);
  const [currentStatus, setCurrentStatus] = useState<string | null>(gradeSheetStatus);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Determine if editing is allowed based on status
  const canEdit = isEditableStatus(currentStatus);

  // Grade entries state: Map of GradeKey -> grade value
  // Note: State is initialized from props on mount. Parent component uses `key` prop
  // (e.g., `key={sectionId}-${selectedPeriod}`) to force remount when period changes,
  // which resets this state with new initialEntries. No useEffect sync needed.
  const [grades, setGrades] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    initialEntries.forEach((entry) => {
      if (entry.grade) {
        map.set(gradeKey(entry.studentId, entry.subjectId), entry.grade);
      }
    });
    return map;
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Action states
  const [saveState, setSaveState] = useState<SaveGradeSheetEntriesFormState>({});
  const [submitState, setSubmitState] = useState<SubmitGradeSheetFormState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit confirmation dialog state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Get tabs configuration - track-based (no "All Strands" since each track has unique subjects)
  const tabs = useMemo(() => {
    const tabList: Array<{ key: TabCategory; label: string; count: number }> = [];

    // Track-specific tabs - each track has its own subjects
    for (const trackCode of subjects.availableStrands) {
      const trackStudents = students.filter((s) => s.strandCode === trackCode);
      if (trackStudents.length > 0) {
        tabList.push({
          key: trackCode,
          label: trackCode, // Use track code directly (e.g., "STEM", "ABM")
          count: trackStudents.length,
        });
      }
    }

    // Fallback: "All" tab if no track-specific tabs (shouldn't happen for SHS)
    if (tabList.length === 0) {
      tabList.push({
        key: "all",
        label: "All Students",
        count: students.length,
      });
    }

    return tabList;
  }, [students, subjects.availableStrands]);

  // Get all subjects combined (all track subjects)
  const allSubjectsCombined = useMemo(() => {
    const allSubjects: SHSSubjectOffering[] = [];
    for (const trackSubjs of subjects.strandSubjects.values()) {
      allSubjects.push(...trackSubjs);
    }
    return allSubjects;
  }, [subjects]);

  // Get filtered students and subjects for active tab
  const { filteredStudents, filteredSubjects } = useMemo(() => {
    if (activeTab === "all") {
      // All students with all subjects (fallback mode)
      return {
        filteredStudents: students,
        filteredSubjects: allSubjectsCombined,
      };
    } else {
      // Track tab: only students in that track, only that track's subjects
      const trackStudents = students.filter((s) => s.strandCode === activeTab);
      const trackSubjects = subjects.strandSubjects.get(activeTab as string) || [];
      return {
        filteredStudents: trackStudents,
        filteredSubjects: trackSubjects,
      };
    }
  }, [activeTab, students, subjects, allSubjectsCombined]);

  // Create grade sheet on first interaction
  const ensureGradeSheet = useCallback(async (): Promise<string | null> => {
    if (gradeSheetId) return gradeSheetId;

    setIsCreatingSheet(true);
    setCreateError(null);

    try {
      const formData = new FormData();
      formData.append("sectionId", sectionId);
      formData.append("schoolYearId", schoolYearId);
      formData.append("gradingPeriod", gradingPeriod);

      const result = await createOrGetGradeSheetAction({}, formData);

      if (result.success && result.gradeSheetId) {
        setGradeSheetId(result.gradeSheetId);
        if (!currentStatus) {
          setCurrentStatus("draft");
        }
        return result.gradeSheetId;
      } else {
        setCreateError(result.message || "Failed to create grade sheet");
        return null;
      }
    } catch {
      setCreateError("An unexpected error occurred while creating grade sheet");
      return null;
    } finally {
      setIsCreatingSheet(false);
    }
  }, [gradeSheetId, sectionId, schoolYearId, gradingPeriod, currentStatus]);

  // Handle grade input change
  const handleGradeChange = useCallback(
    (studentId: string, subjectId: string, value: string) => {
      const key = gradeKey(studentId, subjectId);
      setGrades((prev) => {
        const next = new Map(prev);
        if (value === "") {
          next.delete(key);
        } else {
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
  const handleSave = useCallback(async (): Promise<boolean> => {
    const sheetId = await ensureGradeSheet();
    if (!sheetId) return false;

    const entries = Array.from(grades.entries()).map(([key, grade]) => {
      const { studentId, subjectId } = parseGradeKey(key as ReturnType<typeof gradeKey>);
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
    setSaveState({}); // Clear previous state
    try {
      const result = await saveGradeSheetEntriesAction({}, formData);
      setSaveState(result);
      if (result.success) {
        setHasUnsavedChanges(false);
        // Auto-clear success message after 3 seconds
        setTimeout(() => setSaveState({}), 3000);
        return true;
      }
      return false;
    } catch {
      setSaveState({ message: "An unexpected error occurred while saving grades." });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [ensureGradeSheet, grades]);

  // Submit for review
  const handleSubmit = useCallback(async () => {
    const saved = await handleSave();
    if (!saved) return;

    const sheetId = await ensureGradeSheet();
    if (!sheetId) return;

    const formData = new FormData();
    formData.append("gradeSheetId", sheetId);

    setIsSubmitting(true);
    setSubmitState({}); // Clear previous state
    try {
      const result = await submitGradeSheetAction({}, formData);
      setSubmitState(result);
      if (result.success) {
        setCurrentStatus("submitted");
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      setSubmitState({ message: "An unexpected error occurred while submitting." });
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSave, ensureGradeSheet, router]);

  // Get grade value for a student-subject pair
  const getGrade = (studentId: string, subjectId: string): string => {
    return grades.get(gradeKey(studentId, subjectId)) || "";
  };

  /**
   * Check if a subject is applicable to a student based on track.
   * With the new model, each subject belongs to a track.
   * A subject is applicable if the student's track matches the subject's track.
   */
  const isSubjectApplicableToStudent = (
    student: SHSSectionStudent,
    subject: SHSSubjectOffering
  ): boolean => {
    // Subject belongs to a track - only applicable if student is in that track
    if (subject.strandCode) {
      return student.strandCode === subject.strandCode;
    }
    // Edge case: subject without track (legacy data) - applicable to all
    return true;
  };

  // Calculate overall completion status (across ALL subjects, not just current tab)
  // Each student only takes subjects from their track
  const totalCompletion = useMemo(() => {
    let totalExpected = 0;
    let totalEntered = 0;

    for (const student of students) {
      // Track subjects - only for students in that track
      if (student.strandCode) {
        const trackSubjs = subjects.strandSubjects.get(student.strandCode) || [];
        for (const subject of trackSubjs) {
          totalExpected++;
          if (grades.has(gradeKey(student.id, subject.subjectId))) {
            totalEntered++;
          }
        }
      }
    }

    const missingCount = totalExpected - totalEntered;
    const isComplete = totalExpected > 0 && missingCount === 0;

    return { totalExpected, totalEntered, missingCount, isComplete };
  }, [students, subjects.strandSubjects, grades]);

  // Current tab completion
  const tabCompletion = useMemo(() => {
    let expected = 0;
    let entered = 0;

    // All filtered students have the same track subjects
    expected = filteredStudents.length * filteredSubjects.length;
    for (const student of filteredStudents) {
      for (const subject of filteredSubjects) {
        if (grades.has(gradeKey(student.id, subject.subjectId))) {
          entered++;
        }
      }
    }

    return { expected, entered, missing: expected - entered };
  }, [filteredStudents, filteredSubjects, grades]);

  const canSubmit = canEdit && totalCompletion.isComplete && totalCompletion.totalExpected > 0;

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
            <span className="text-sm text-warning flex-row-1">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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
          {canEdit && totalCompletion.totalExpected > 0 && (
            <span
              className={`text-sm ${
                totalCompletion.isComplete ? "text-success" : "text-muted-foreground"
              }`}
            >
              {totalCompletion.totalEntered}/{totalCompletion.totalExpected} grades entered
              {!totalCompletion.isComplete && ` (${totalCompletion.missingCount} missing)`}
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
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
                  !canSubmit && totalCompletion.missingCount > 0
                    ? `${totalCompletion.missingCount} grade${totalCompletion.missingCount > 1 ? "s" : ""} missing`
                    : undefined
                }
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

      {/* Strand Tabs */}
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex flex-wrap flex-row-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              type="button"
              variant={activeTab === tab.key ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "gap-2 transition-colors",
                activeTab === tab.key && tab.key === "all" && "bg-info hover:bg-info border-info"
              )}
            >
              {tab.label}
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 px-1.5 py-0 text-xs font-normal",
                  activeTab === tab.key && "bg-white/20 text-white border-white/30"
                )}
              >
                {tab.count}
              </Badge>
            </Button>
          ))}
        </div>
        {/* Tab description */}
        <div className="mt-2 text-secondary">
          {activeTab === "all" ? (
            <>Entering grades for <strong>All Students</strong></>
          ) : (
            <>Entering grades for <strong>{activeTab}</strong> track students</>
          )}
          {tabCompletion.expected > 0 && (
            <span className="ml-2">
              ({tabCompletion.entered}/{tabCompletion.expected} entered
              {tabCompletion.missing > 0 && `, ${tabCompletion.missing} missing`})
            </span>
          )}
        </div>
      </div>

      {/* Status Messages */}
      <GradeEntryErrorBanner error={createError} />
      {saveState.message && (
        <GradeEntryStatusMessage message={saveState.message} isSuccess={!!saveState.success} />
      )}
      {submitState.message && (
        <GradeEntryStatusMessage message={submitState.message} isSuccess={!!submitState.success} />
      )}

      {/* Grade Entry Grid */}
      {filteredStudents.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">
            {activeTab === "all" ? "No students found" : "No students in this track"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "all"
              ? "No enrolled students found in this section."
              : `No students are enrolled in the ${activeTab} track.`}
          </p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No subjects configured</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "all"
              ? "No subjects are configured for this section."
              : `No subjects are configured for the ${activeTab} track.`}
          </p>
        </div>
      ) : (
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
                    {activeTab !== "core" && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">{activeTab}</Badge>
                    )}
                  </th>
                  {filteredSubjects.map((subject) => (
                    <th
                      key={subject.id}
                      scope="col"
                      className="px-3 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider min-w-[100px]"
                      title={subject.subjectName}
                    >
                      {subject.subjectCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {filteredStudents.map((student, studentIndex) => (
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
                    {filteredSubjects.map((subject) => {
                      const isApplicable = isSubjectApplicableToStudent(student, subject);
                      return (
                        <td key={subject.id} className="px-2 py-2 text-center">
                          <SHSGradeCell
                            studentId={student.id}
                            subjectId={subject.subjectId}
                            initialValue={getGrade(student.id, subject.subjectId)}
                            disabled={!canEdit}
                            isApplicable={isApplicable}
                            studentStrand={student.strandCode}
                            onCommit={handleGradeChange}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </form>
        </div>
      )}

      {/* Legend */}
      <GradeEntryLegend />

      {/* Submit Confirmation Dialog */}
      <GradeSubmitConfirmDialog
        open={showSubmitConfirm}
        onOpenChange={setShowSubmitConfirm}
        onConfirm={handleSubmit}
      />
    </div>
  );
}
