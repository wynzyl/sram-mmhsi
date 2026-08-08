"use client";

import { useActionState, useEffect, useRef, useState, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import {
  addSubjectToCurriculumAction,
  updateSubjectInCurriculumAction,
} from "../subjects.actions";
import { CLEAR_STRAND_ID } from "../curriculums.schema";
import type {
  AddSubjectToCurriculumFormState,
  UpdateSubjectInCurriculumFormState,
  StrandAssociation,
} from "../curriculums.schema";
import type { SubjectListRow, SubjectStrandAssociation } from "../curriculums.types";
import {
  TERM_OFFERING_LABELS,
  getValidTermsForSystem,
  type TermOffering,
} from "@/lib/constants/term-offerings";
import type { GradingSystemType } from "@/lib/constants/grading-systems";
import { getGradeGroup } from "@/lib/constants/grade-groups";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface StrandOption {
  id: string;
  code: string;
  shortCode: string;
  name: string;
}

interface SubjectFormDialogProps {
  mode: "add" | "edit";
  curriculumId: string;
  gradeLevels: GradeLevelOption[];
  subject?: SubjectListRow & { strandId?: string | null; termOffered?: TermOffering };
  defaultGradeLevelId?: string;
  onClose: () => void;
  /** Available tracks for SHS subject assignment */
  availableStrands?: StrandOption[];
  /** @deprecated - use strandId direct ownership instead */
  existingStrandAssociations?: SubjectStrandAssociation[];
  /** School year grading system type for term options */
  gradingSystemType?: GradingSystemType;
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
  gradingSystemType = "quarterly",
}: SubjectFormDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Track isCore state for conditional UI
  const [isCore, setIsCore] = useState(subject?.isCore ?? true);
  const [selectedGradeLevelId, setSelectedGradeLevelId] = useState(
    subject?.gradeLevelId ?? defaultGradeLevelId ?? ""
  );

  // Track selection for SHS subjects (direct ownership model)
  const [selectedTrackId, setSelectedTrackId] = useState<string>(subject?.strandId ?? "");

  // Term offered selection
  const [termOffered, setTermOffered] = useState<TermOffering>(subject?.termOffered ?? "full_year");

  // Legacy strand associations (deprecated - for backward compatibility)
  const [strandSelections, setStrandSelections] = useState<
    Map<string, { selected: boolean; isStrandCore: boolean }>
  >(() => {
    const map = new Map();
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
      startTransition(() => {
        router.refresh();
      });
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
    return getGradeGroup(selectedGradeLevel.name) === "shs";
  }, [selectedGradeLevel]);

  // Show track selection for SHS subjects (always show for SHS since "All Tracks" is available)
  const showTrackSelection = isSHSGradeLevel;

  // Get valid term options based on grading system
  const termOptions = useMemo(() => {
    return getValidTermsForSystem(gradingSystemType).map(term => ({
      value: term,
      label: TERM_OFFERING_LABELS[term],
    }));
  }, [gradingSystemType]);

  // Legacy: Build strand associations JSON for form submission (deprecated)
  const strandAssociationsJson = useMemo(() => {
    if (!isSHSGradeLevel || selectedTrackId) return ""; // Use direct ownership if track selected
    const associations: StrandAssociation[] = [];
    strandSelections.forEach((value, strandId) => {
      if (value.selected) {
        associations.push({ strandId, isStrandCore: value.isStrandCore });
      }
    });
    return JSON.stringify(associations);
  }, [strandSelections, isSHSGradeLevel, selectedTrackId]);

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
              placeholder="e.g., STEM-GM11"
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
              placeholder="e.g., General Mathematics"
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
              onChange={(e) => {
                setSelectedGradeLevelId(e.target.value);
                // Reset track selection when grade level changes
                setSelectedTrackId("");
              }}
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

          {/* Track Selection for SHS Subjects */}
          {showTrackSelection && (
            <>
              <div className="space-y-1.5">
                <label htmlFor="strandId" className="block text-sm font-medium text-foreground">
                  Track
                </label>
                <select
                  id="strandId"
                  name="strandId"
                  value={selectedTrackId}
                  onChange={(e) => setSelectedTrackId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">All Tracks (Core)</option>
                  {availableStrands.map((strand) => (
                    <option key={strand.id} value={strand.id}>
                      {strand.shortCode} - {strand.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {selectedTrackId
                    ? "This subject belongs exclusively to the selected track."
                    : "Core subject available to all SHS students regardless of track."}
                </p>
                {state.errors?.strandId && (
                  <p className="text-sm text-destructive">{state.errors.strandId[0]}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="termOffered" className="block text-sm font-medium text-foreground">
                  Term Offered
                </label>
                <select
                  id="termOffered"
                  name="termOffered"
                  value={termOffered}
                  onChange={(e) => setTermOffered(e.target.value as TermOffering)}
                  className={inputClass}
                >
                  {termOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  When this subject is available during the school year.
                </p>
              </div>
            </>
          )}

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

            {/* Show Type (Core/Elective) selection only for SHS subjects */}
            {isSHSGradeLevel && (
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
            )}
          </div>

          {/* Non-SHS subjects are implicitly core - no track-specific electives */}
          {!isSHSGradeLevel && (
            <input type="hidden" name="isCore" value="true" />
          )}


          {/*
            Moving a subject off an SHS grade level must drop its track. The
            Track control is unmounted for non-SHS, so without this the field is
            simply absent and updateSubjectInCurriculumAction — which skips
            undefined fields — leaves the old SHS strandId on a non-SHS subject.
            Edit-only: a new subject has no track to clear, and
            AddSubjectToCurriculumSchema has no preprocess for this sentinel.
          */}
          {mode === "edit" && !isSHSGradeLevel && (
            <input type="hidden" name="strandId" value={CLEAR_STRAND_ID} />
          )}

          {/* Legacy strand associations for backward compatibility */}
          {strandAssociationsJson && (
            <input type="hidden" name="strandAssociations" value={strandAssociationsJson} />
          )}

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
