"use client";

import { useActionState, useState, memo, useTransition } from "react";
import { saveGradesAction, submitGradesAction } from "@/features/academics/grades/grades.actions";

type StudentData = {
  id: string;
  name: string;
  grades: {
    Q1?: { grade: string; status: string };
    Q2?: { grade: string; status: string };
    Q3?: { grade: string; status: string };
    Q4?: { grade: string; status: string };
  };
};

/**
 * Memoized student grade row component.
 * Prevents unnecessary re-renders when parent state changes (e.g., tab switching, save state updates).
 * Only re-renders when the student's specific grade data or disabled state changes.
 *
 * @deprecated This is the legacy teacher-based grade encoding component.
 * Prefer the adviser-based workflow via AdviserGradeEntryGrid.tsx
 */
const StudentGradeRow = memo(
  ({
    student,
    activeTab,
    isDisabled,
  }: {
    student: StudentData;
    activeTab: "Q1" | "Q2" | "Q3" | "Q4";
    isDisabled: boolean;
  }) => {
    const gradeData = student.grades[activeTab];

    return (
      <tr className="border-b border-border">
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground border-r border-border">
          {student.name}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            name={`grade_${student.id}_${activeTab}`}
            defaultValue={gradeData?.grade || ""}
            disabled={isDisabled}
            className="block w-full px-3 py-2 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground"
          />
        </td>
      </tr>
    );
  },
  // Custom comparison function: only re-render if these specific props change
  (prevProps, nextProps) => {
    // Don't re-render if student ID, grade, and disabled state are unchanged
    const prevGrade = prevProps.student.grades[prevProps.activeTab]?.grade;
    const nextGrade = nextProps.student.grades[nextProps.activeTab]?.grade;

    return (
      prevProps.student.id === nextProps.student.id &&
      prevProps.activeTab === nextProps.activeTab &&
      prevGrade === nextGrade &&
      prevProps.isDisabled === nextProps.isDisabled
    );
  }
);

StudentGradeRow.displayName = "StudentGradeRow";

export default function GradeEncodingTable({
  assignmentId,
  schoolYearId,
  students,
}: {
  assignmentId: string;
  schoolYearId: string;
  students: StudentData[];
}) {
  const [saveState, saveAction, isSaving] = useActionState(saveGradesAction, {});
  const [submitState, submitAction, isSubmitting] = useActionState(submitGradesAction, {});
  const [, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"Q1" | "Q2" | "Q3" | "Q4">("Q1");

  // Format form data before submission to send complex JSON structure
  const handleSaveDraft = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const gradesToSave: { studentId: string; gradingPeriod: string; grade: number | null }[] = [];
    
    students.forEach((student) => {
      const val = formData.get(`grade_${student.id}_${activeTab}`);
      if (val !== null && val !== undefined) {
        gradesToSave.push({
          studentId: student.id,
          gradingPeriod: activeTab,
          grade: val === "" ? null : Number(val),
        });
      }
    });

    const actionData = new FormData();
    actionData.append("assignmentId", assignmentId);
    actionData.append("schoolYearId", schoolYearId);
    actionData.append("grades", JSON.stringify(gradesToSave));
    
    const formToSubmit = new FormData();
    formToSubmit.append("assignmentId", assignmentId);
    formToSubmit.append("schoolYearId", schoolYearId);
    formToSubmit.append("grades", JSON.stringify(gradesToSave));
    startTransition(() => {
      saveAction(formToSubmit);
    });
  };

  const currentStatus = students[0]?.grades[activeTab]?.status || "draft";
  const isLockedOrSubmitted = currentStatus === "submitted" || currentStatus === "locked";

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      {/* ── Tabs ── */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
          {(["Q1", "Q2", "Q3", "Q4"] as const).map((period) => (
            <button
              key={period}
              onClick={() => setActiveTab(period)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === period
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"}
              `}
            >
              {period}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-foreground">
            {activeTab} Grades
            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
              ${currentStatus === 'draft' ? 'bg-muted text-muted-foreground' :
                currentStatus === 'submitted' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-destructive/10 text-destructive'}`}>
              {currentStatus.toUpperCase()}
            </span>
          </h3>

          <div className="flex space-x-3">
            <button
              type="submit"
              form="save-draft-form"
              disabled={isSaving || isLockedOrSubmitted}
              className="inline-flex justify-center py-2 px-4 border border-border shadow-sm text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Draft"}
            </button>
            <form action={submitAction} className="inline">
              <input type="hidden" name="assignmentId" value={assignmentId} />
              <input type="hidden" name="gradingPeriod" value={activeTab} />
              <button
                type="submit"
                disabled={isSubmitting || isLockedOrSubmitted}
                onClick={(e) => {
                  if (!confirm(`Are you sure you want to submit grades for ${activeTab}? You cannot edit them after submission.`)) {
                    e.preventDefault();
                  }
                }}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Submit Grades"}
              </button>
            </form>
          </div>
        </div>

        {saveState.message && (
          <div className={`p-4 mb-4 rounded-md text-sm ${saveState.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
            {saveState.message}
          </div>
        )}

        {submitState.message && (
          <div className={`p-4 mb-4 rounded-md text-sm ${submitState.success ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
            {submitState.message}
          </div>
        )}

        <form id="save-draft-form" onSubmit={handleSaveDraft}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border border border-border">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border">
                    Student Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border w-32">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {students.map((student) => (
                  <StudentGradeRow
                    key={student.id}
                    student={student}
                    activeTab={activeTab}
                    isDisabled={isLockedOrSubmitted}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  );
}
