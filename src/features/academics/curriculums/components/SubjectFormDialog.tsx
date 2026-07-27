"use client";

import { useActionState, useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import {
  addSubjectToCurriculumAction,
  updateSubjectInCurriculumAction,
} from "../subjects.actions";
import type {
  AddSubjectToCurriculumFormState,
  UpdateSubjectInCurriculumFormState,
  StrandAssociation,
} from "../curriculums.schema";
import type { SubjectListRow, SubjectStrandAssociation } from "../curriculums.types";
import { SHS_STRAND_LABELS, type ShsStrandCode } from "@/lib/constants/strands";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface StrandOption {
  id: string;
  code: string;
  name: string;
}

interface SubjectFormDialogProps {
  mode: "add" | "edit";
  curriculumId: string;
  gradeLevels: GradeLevelOption[];
  subject?: SubjectListRow;
  defaultGradeLevelId?: string;
  onClose: () => void;
  /** Available strands for SHS elective selection */
  availableStrands?: StrandOption[];
  /** Existing strand associations for the subject (edit mode) */
  existingStrandAssociations?: SubjectStrandAssociation[];
}

export function SubjectFormDialog({
  mode,
  curriculumId,
  gradeLevels,
  subject,
  defaultGradeLevelId,
  onClose,
  availableStrands = [],
  existingStrandAssociations = [],
}: SubjectFormDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Track isCore state for conditional strand display
  const [isCore, setIsCore] = useState(subject?.isCore ?? true);
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState(
    subject?.gradeLevelId ?? defaultGradeLevelId ?? ""
  );

  // Track strand associations: Map<strandId, { selected: boolean, isStrandCore: boolean }>
  const [strandSelections, setStrandSelections] = useState<
    Map<string, { selected: boolean; isStrandCore: boolean }>
  >(() => {
    const map = new Map();
    // Initialize with existing associations
    for (const assoc of existingStrandAssociations) {
      map.set(assoc.strandId, { selected: true, isStrandCore: assoc.isStrandCore });
    }
    return map;
  });

  const [addState, addAction, addPending] = useActionState<
    AddSubjectToCurriculumFormState,
    FormData
  >(addSubjectToCurriculumAction, {});

  const [updateState, updateAction, updatePending] = useActionState<
    UpdateSubjectInCurriculumFormState,
    FormData
  >(updateSubjectInCurriculumAction, {});

  const state = mode === "add" ? addState : updateState;
  const action = mode === "add" ? addAction : updateAction;
  const isPending = mode === "add" ? addPending : updatePending;

  useFormToast(state, {
    successMessage: mode === "add" ? "Subject added" : "Subject updated",
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const handleClose = () => {
    dialogRef.current?.close();
    onClose();
  };

  // Check if selected grade level is SHS (Grade 11 or 12)
  const selectedGradeLevel = gradeLevels.find((gl) => gl.id === selectedGradeLevelId);
  const isSHSGradeLevel = useMemo(() => {
    if (!selectedGradeLevel) return false;
    const name = selectedGradeLevel.name.toLowerCase();
    return name.includes("grade 11") || name.includes("grade 12") || name.includes("g11") || name.includes("g12");
  }, [selectedGradeLevel]);

  // Show strand selection only for SHS electives
  const showStrandSelection = !isCore && isSHSGradeLevel && availableStrands.length > 0;

  // Build strand associations JSON for form submission
  const strandAssociationsJson = useMemo(() => {
    if (!showStrandSelection) return "";
    const associations: StrandAssociation[] = [];
    strandSelections.forEach((value, strandId) => {
      if (value.selected) {
        associations.push({ strandId, isStrandCore: value.isStrandCore });
      }
    });
    return JSON.stringify(associations);
  }, [strandSelections, showStrandSelection]);

  const handleStrandToggle = (strandId: string) => {
    setStrandSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(strandId);
      if (current?.selected) {
        next.delete(strandId);
      } else {
        next.set(strandId, { selected: true, isStrandCore: false });
      }
      return next;
    });
  };

  const handleStrandCoreToggle = (strandId: string) => {
    setStrandSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(strandId);
      if (current) {
        next.set(strandId, { ...current, isStrandCore: !current.isStrandCore });
      }
      return next;
    });
  };

  const inputClass =
    "w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent p-0 m-auto backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {mode === "add" ? "Add Subject" : "Edit Subject"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form action={action} className="space-y-4">
          {mode === "add" && (
            <input type="hidden" name="curriculumId" value={curriculumId} />
          )}
          {mode === "edit" && subject && (
            <input type="hidden" name="subjectId" value={subject.id} />
          )}

          <div className="space-y-1.5">
            <label htmlFor="code" className="block text-sm font-medium text-foreground">
              Subject Code
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="code"
              name="code"
              type="text"
              placeholder="e.g., ENG101"
              defaultValue={subject?.code ?? ""}
              required
              className={inputClass}
            />
            {state.errors?.code && (
              <p className="text-sm text-destructive">{state.errors.code[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-foreground">
              Subject Name
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="e.g., English Language Arts"
              defaultValue={subject?.name ?? ""}
              required
              className={inputClass}
            />
            {state.errors?.name && (
              <p className="text-sm text-destructive">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gradeLevelId" className="block text-sm font-medium text-foreground">
              Grade Level
              <span className="text-destructive ml-0.5">*</span>
            </label>
            <select
              id="gradeLevelId"
              name="gradeLevelId"
              value={selectedGradeLevelId}
              onChange={(e) => setSelectedGradeLevelId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Select grade level...</option>
              {gradeLevels.map((gl) => (
                <option key={gl.id} value={gl.id}>
                  {gl.name}
                </option>
              ))}
            </select>
            {state.errors?.gradeLevelId && (
              <p className="text-sm text-destructive">{state.errors.gradeLevelId[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="description" className="block text-sm font-medium text-foreground">
              Description
              <span className="text-muted-foreground ml-1">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={2}
              placeholder="Brief description..."
              defaultValue={subject?.description ?? ""}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="units" className="block text-sm font-medium text-foreground">
                Units
              </label>
              <input
                id="units"
                name="units"
                type="text"
                placeholder="1.0"
                defaultValue={subject?.units ?? "1.0"}
                className={inputClass}
              />
              {state.errors?.units && (
                <p className="text-sm text-destructive">{state.errors.units[0]}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="isCore" className="block text-sm font-medium text-foreground">
                Type
              </label>
              <select
                id="isCore"
                name="isCore"
                value={isCore ? "true" : "false"}
                onChange={(e) => setIsCore(e.target.value === "true")}
                className={inputClass}
              >
                <option value="true">Core Subject</option>
                <option value="false">Elective</option>
              </select>
            </div>
          </div>

          {/* Strand Selection for SHS Electives */}
          {showStrandSelection && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                Available to Strands
                <span className="text-muted-foreground ml-1 font-normal">(select applicable strands)</span>
              </label>
              <div className="space-y-2 border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                {availableStrands.map((strand) => {
                  const selection = strandSelections.get(strand.id);
                  const isSelected = selection?.selected ?? false;
                  const isStrandCore = selection?.isStrandCore ?? false;

                  return (
                    <div key={strand.id} className="flex items-center gap-3">
                      <label className="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleStrandToggle(strand.id)}
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="text-sm">
                          {strand.code} - {SHS_STRAND_LABELS[strand.code as ShsStrandCode] ?? strand.name}
                        </span>
                      </label>
                      {isSelected && (
                        <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isStrandCore}
                            onChange={() => handleStrandCoreToggle(strand.id)}
                            className="h-3 w-3 rounded border-border"
                          />
                          Required
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Check "Required" if students in that strand must take this subject.
              </p>
              {/* Hidden input to submit strand associations */}
              <input type="hidden" name="strandAssociations" value={strandAssociationsJson} />
            </div>
          )}

          {/* Form-level errors are shown via useFormToast, field errors stay inline */}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving..." : mode === "add" ? "Add Subject" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
