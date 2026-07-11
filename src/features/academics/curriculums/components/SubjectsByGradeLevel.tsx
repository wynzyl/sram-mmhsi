"use client";

import { useState, useActionState, useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import type { SubjectListRow } from "../curriculums.types";
import type { CurriculumStatus } from "../curriculums.schema";
import {
  deleteSubjectFromCurriculumAction,
  restoreSubjectInCurriculumAction,
} from "../subjects.actions";
import type {
  DeleteSubjectFromCurriculumFormState,
  RestoreSubjectInCurriculumFormState,
} from "../curriculums.schema";

interface GradeLevelGroup {
  gradeLevelId: string;
  gradeLevelName: string;
  subjects: SubjectListRow[];
}

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SubjectsByGradeLevelProps {
  groups: GradeLevelGroup[];
  curriculumStatus: CurriculumStatus;
  /** Reserved for future use (e.g., reordering) */
  curriculumId: string;
  /** All available grade levels - used to show empty grade levels in draft mode */
  availableGradeLevels?: GradeLevelOption[];
  onAddSubject?: (gradeLevelId: string) => void;
  onEditSubject?: (subject: SubjectListRow) => void;
}

export function SubjectsByGradeLevel({
  groups,
  curriculumStatus,
  curriculumId: _curriculumId,
  availableGradeLevels = [],
  onAddSubject,
  onEditSubject,
}: SubjectsByGradeLevelProps) {
  const isDraft = curriculumStatus === "draft";

  // In draft mode, merge available grade levels with existing groups
  // This allows adding subjects to grade levels that don't have subjects yet
  const displayGroups = useMemo(() => {
    if (!isDraft || availableGradeLevels.length === 0) {
      return groups;
    }

    // Create a map of existing groups
    const existingGroupMap = new Map(
      groups.map((g) => [g.gradeLevelId, g])
    );

    // Merge available grade levels with existing groups
    const merged: GradeLevelGroup[] = availableGradeLevels.map((gl) => {
      const existing = existingGroupMap.get(gl.id);
      if (existing) {
        return existing;
      }
      // Create empty group for grade level without subjects
      return {
        gradeLevelId: gl.id,
        gradeLevelName: gl.name,
        subjects: [],
      };
    });

    return merged;
  }, [groups, availableGradeLevels, isDraft]);

  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(
    new Set(displayGroups.map((g) => g.gradeLevelId))
  );

  const toggleGrade = (gradeLevelId: string) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(gradeLevelId)) {
        next.delete(gradeLevelId);
      } else {
        next.add(gradeLevelId);
      }
      return next;
    });
  };

  // Count total subjects across all groups
  const totalSubjects = groups.reduce(
    (sum, g) => sum + g.subjects.filter((s) => !s.isDeleted).length,
    0
  );

  if (displayGroups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No subjects defined yet.</p>
        {isDraft && onAddSubject && (
          <button
            type="button"
            onClick={() => onAddSubject("")}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Add the first subject
          </button>
        )}
      </div>
    );
  }

  // Show helpful message for new draft curriculums
  const showEmptyDraftHint = isDraft && totalSubjects === 0;

  return (
    <div className="space-y-4">
      {showEmptyDraftHint && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-2">
          <p className="text-sm text-primary">
            <span className="font-medium">Getting started:</span> Click on any grade level below and use &quot;+ Add Subject&quot; to add subjects to your curriculum.
          </p>
        </div>
      )}
      {displayGroups.map((group) => {
        const isExpanded = expandedGrades.has(group.gradeLevelId);
        const activeSubjects = group.subjects.filter((s) => !s.isDeleted);
        const deletedSubjects = group.subjects.filter((s) => s.isDeleted);

        return (
          <div
            key={group.gradeLevelId}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Header */}
            <button
              type="button"
              onClick={() => toggleGrade(group.gradeLevelId)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform",
                    isExpanded && "rotate-90"
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="font-medium">{group.gradeLevelName}</span>
                <span className="text-sm text-muted-foreground">
                  ({activeSubjects.length} subject
                  {activeSubjects.length !== 1 ? "s" : ""})
                </span>
              </div>
              {isDraft && onAddSubject && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddSubject(group.gradeLevelId);
                  }}
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  + Add Subject
                </span>
              )}
            </button>

            {/* Content */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {activeSubjects.length === 0 && deletedSubjects.length === 0 ? (
                  <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                    No subjects in this grade level
                  </div>
                ) : (
                  <>
                    {activeSubjects.map((subject) => (
                      <SubjectRow
                        key={subject.id}
                        subject={subject}
                        isDraft={isDraft}
                        onEdit={onEditSubject}
                      />
                    ))}
                    {deletedSubjects.length > 0 && isDraft && (
                      <div className="px-4 py-2 bg-muted/20">
                        <p className="text-xs text-muted-foreground mb-2">
                          Deleted subjects ({deletedSubjects.length})
                        </p>
                        {deletedSubjects.map((subject) => (
                          <DeletedSubjectRow key={subject.id} subject={subject} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Subject Row ────────────────────────────────────────────────────────────

interface SubjectRowProps {
  subject: SubjectListRow;
  isDraft: boolean;
  onEdit?: (subject: SubjectListRow) => void;
}

function SubjectRow({ subject, isDraft, onEdit }: SubjectRowProps) {
  const [, deleteAction, deleting] = useActionState<
    DeleteSubjectFromCurriculumFormState,
    FormData
  >(deleteSubjectFromCurriculumAction, {});

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary text-xs font-mono rounded">
          {subject.code}
        </span>
        <div className="min-w-0">
          <p className="font-medium truncate">{subject.name}</p>
          {subject.description && (
            <p className="text-xs text-muted-foreground truncate max-w-md">
              {subject.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{subject.units} units</span>
          {!subject.isCore && (
            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Elective</span>
          )}
        </div>

        {isDraft && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(subject)}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                Edit
              </button>
            )}
            <form action={deleteAction}>
              <input type="hidden" name="subjectId" value={subject.id} />
              <button
                type="submit"
                disabled={deleting}
                className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                {deleting ? "..." : "Delete"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deleted Subject Row ────────────────────────────────────────────────────

function DeletedSubjectRow({ subject }: { subject: SubjectListRow }) {
  const [, restoreAction, restoring] = useActionState<
    RestoreSubjectInCurriculumFormState,
    FormData
  >(restoreSubjectInCurriculumAction, {});

  return (
    <div className="flex items-center justify-between py-2 opacity-60">
      <div className="flex items-center gap-2">
        <span className="line-through text-sm">{subject.code}</span>
        <span className="line-through text-sm text-muted-foreground">
          {subject.name}
        </span>
      </div>
      <form action={restoreAction}>
        <input type="hidden" name="subjectId" value={subject.id} />
        <button
          type="submit"
          disabled={restoring}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          {restoring ? "..." : "Restore"}
        </button>
      </form>
    </div>
  );
}
