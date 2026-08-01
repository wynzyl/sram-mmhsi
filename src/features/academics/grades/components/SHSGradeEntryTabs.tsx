"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  createOrGetGradeSheetAction,
  saveGradeSheetEntriesAction,
  submitGradeSheetAction,
} from "../grades.actions";
import type {
  SaveGradeSheetEntriesFormState,
  SubmitGradeSheetFormState,
} from "../grades.schema";
import type { SHSGradeEntrySubjects, SHSSectionStudent, SHSSubjectOffering } from "../grades.queries";
import type { ShsStrandCode } from "@/lib/constants/strands";
import {
  SHS_STRAND_SHORT_LABELS,
  SHS_STRAND_ORDER,
} from "@/lib/constants/strands";
import { getGradeRemarks } from "@/lib/constants/grading-periods";

type TabCategory = "core" | ShsStrandCode;

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

  // Active tab
  const [activeTab, setActiveTab] = useState<TabCategory>("core");

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
  const [saveState, setSaveState] = useState<SaveGradeSheetEntriesFormState>({});
  const [submitState, setSubmitState] = useState<SubmitGradeSheetFormState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit confirmation dialog state
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Get tabs configuration
  const tabs = useMemo(() => {
    const tabList: Array<{ key: TabCategory; label: string; count: number }> = [];

    // All Strands tab - all students with all subjects
    tabList.push({
      key: "core",
      label: "All Strands",
      count: students.length,
    });

    // Strand-specific tabs - only show strands that have subjects and students
    for (const strandCode of subjects.availableStrands) {
      const strandStudents = students.filter((s) => s.strandCode === strandCode);
      if (strandStudents.length > 0) {
        tabList.push({
          key: strandCode,
          label: SHS_STRAND_SHORT_LABELS[strandCode],
          count: strandStudents.length,
        });
      }
    }

    return tabList;
  }, [students, subjects.availableStrands]);

  // Get all subjects combined (core + all strand electives)
  const allSubjectsCombined = useMemo(() => {
    const allElectives: SHSSubjectOffering[] = [];
    for (const strandSubjs of subjects.strandSubjects.values()) {
      allElectives.push(...strandSubjs);
    }
    return [...subjects.universalCore, ...allElectives];
  }, [subjects]);

  // Get filtered students and subjects for active tab
  const { filteredStudents, filteredSubjects } = useMemo(() => {
    if (activeTab === "core") {
      // All Strands tab: all students, ALL subjects (core + all electives)
      return {
        filteredStudents: students,
        filteredSubjects: allSubjectsCombined,
      };
    } else {
      // Strand tab: only students in that strand, core + that strand's electives
      const strandStudents = students.filter((s) => s.strandCode === activeTab);
      const strandSubjects = subjects.strandSubjects.get(activeTab) || [];
      const allSubjectsForStrand = [...subjects.universalCore, ...strandSubjects];
      return {
        filteredStudents: strandStudents,
        filteredSubjects: allSubjectsForStrand,
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
    } catch (error) {
      setCreateError("An unexpected error occurred while creating grade sheet");
      return null;
    } finally {
      setIsCreatingSheet(false);
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
        router.refresh();
      }
    } catch {
      setSubmitState({ message: "An unexpected error occurred while submitting." });
    } finally {
      setIsSubmitting(false);
    }
  }, [handleSave, ensureGradeSheet, router]);

  // Get grade value for a student-subject pair
  const getGrade = (studentId: string, subjectId: string): string => {
    return grades.get(`${studentId}:${subjectId}`) || "";
  };

  /**
   * Check if a subject is applicable to a student based on strand.
   * - Core subjects (isCore = true) → applicable to all students
   * - Strand electives → only applicable if student's strand matches subject's strand
   */
  const isSubjectApplicableToStudent = (
    student: SHSSectionStudent,
    subject: SHSSubjectOffering
  ): boolean => {
    // Core subjects are applicable to all students
    if (subject.isCore) return true;
    // Strand-specific subjects - only applicable if student's strand matches
    if (subject.strandCode) {
      return student.strandCode === subject.strandCode;
    }
    // Edge case: non-core without strand (shouldn't happen but handle gracefully)
    return true;
  };

  // Calculate overall completion status (across ALL subjects, not just current tab)
  // Must count only APPLICABLE entries (core for all, strand-specific for matching students)
  const totalCompletion = useMemo(() => {
    let totalExpected = 0;
    let totalEntered = 0;

    for (const student of students) {
      // Core subjects - all students take these
      for (const subject of subjects.universalCore) {
        totalExpected++;
        if (grades.has(`${student.id}:${subject.subjectId}`)) {
          totalEntered++;
        }
      }

      // Strand electives - only for students in that strand
      if (student.strandCode) {
        const strandSubjs = subjects.strandSubjects.get(student.strandCode) || [];
        for (const subject of strandSubjs) {
          totalExpected++;
          if (grades.has(`${student.id}:${subject.subjectId}`)) {
            totalEntered++;
          }
        }
      }
    }

    const missingCount = totalExpected - totalEntered;
    const isComplete = totalExpected > 0 && missingCount === 0;

    return { totalExpected, totalEntered, missingCount, isComplete };
  }, [students, subjects, grades]);

  // Current tab completion
  const tabCompletion = useMemo(() => {
    let expected = 0;
    let entered = 0;

    if (activeTab === "core") {
      // "All Strands" tab: each student has core + their strand's electives
      for (const student of filteredStudents) {
        // Core subjects for all students
        expected += subjects.universalCore.length;
        for (const subject of subjects.universalCore) {
          if (grades.has(`${student.id}:${subject.subjectId}`)) {
            entered++;
          }
        }
        // Strand electives only for students with a strand
        if (student.strandCode) {
          const strandSubjs = subjects.strandSubjects.get(student.strandCode) || [];
          expected += strandSubjs.length;
          for (const subject of strandSubjs) {
            if (grades.has(`${student.id}:${subject.subjectId}`)) {
              entered++;
            }
          }
        }
      }
    } else {
      // Strand tab: all filtered students have the same subjects (core + strand electives)
      expected = filteredStudents.length * filteredSubjects.length;
      for (const student of filteredStudents) {
        for (const subject of filteredSubjects) {
          if (grades.has(`${student.id}:${subject.subjectId}`)) {
            entered++;
          }
        }
      }
    }

    return { expected, entered, missing: expected - entered };
  }, [activeTab, filteredStudents, filteredSubjects, subjects, grades]);

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
            <span className="text-sm text-amber-600 flex-row-1">
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
                activeTab === tab.key && tab.key === "core" && "bg-blue-600 hover:bg-blue-700 border-blue-600"
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
          {activeTab === "core" ? (
            <>Entering grades for <strong>All Strands</strong> — all students with all subjects (core + electives)</>
          ) : (
            <>Entering grades for <strong>{activeTab}</strong> students — core + {activeTab} electives</>
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
      {filteredStudents.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">
            {activeTab === "core" ? "No students found" : "No students in this strand"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "core"
              ? "No enrolled students found in this section."
              : `No students are enrolled in the ${activeTab} strand.`}
          </p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-foreground">No subjects configured</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeTab === "core"
              ? "No subjects are configured for this section."
              : `No subjects are configured for the ${activeTab} strand.`}
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
                          <input
                            type="number"
                            min="60"
                            max="100"
                            value={getGrade(student.id, subject.subjectId)}
                            onChange={(e) =>
                              handleGradeChange(student.id, subject.subjectId, e.target.value)
                            }
                            disabled={!canEdit || !isApplicable}
                            className={cn(
                              "w-16 text-center rounded-md border-border shadow-sm text-sm",
                              !isApplicable
                                ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                                : canEdit
                                  ? "bg-background text-foreground focus:border-primary focus:ring-primary"
                                  : "bg-muted text-muted-foreground cursor-not-allowed"
                            )}
                            placeholder={isApplicable ? "--" : ""}
                            title={
                              !isApplicable
                                ? `Not applicable - student is ${student.strandCode || "no strand"}`
                                : undefined
                            }
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
      <div className="border-t border-border p-4 bg-muted">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Grading Scale
        </h4>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span><strong className="text-foreground">90-100:</strong> Outstanding</span>
          <span><strong className="text-foreground">85-89:</strong> Very Satisfactory</span>
          <span><strong className="text-foreground">80-84:</strong> Satisfactory</span>
          <span><strong className="text-foreground">75-79:</strong> Fairly Satisfactory</span>
          <span><strong className="text-foreground">Below 75:</strong> Did Not Meet Expectations</span>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
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
