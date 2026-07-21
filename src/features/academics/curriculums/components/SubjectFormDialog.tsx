"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import {
  addSubjectToCurriculumAction,
  updateSubjectInCurriculumAction,
} from "../subjects.actions";
import type {
  AddSubjectToCurriculumFormState,
  UpdateSubjectInCurriculumFormState,
} from "../curriculums.schema";
import type { SubjectListRow } from "../curriculums.types";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SubjectFormDialogProps {
  mode: "add" | "edit";
  curriculumId: string;
  gradeLevels: GradeLevelOption[];
  subject?: SubjectListRow;
  defaultGradeLevelId?: string;
  onClose: () => void;
}

export function SubjectFormDialog({
  mode,
  curriculumId,
  gradeLevels,
  subject,
  defaultGradeLevelId,
  onClose,
}: SubjectFormDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

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
              defaultValue={subject?.gradeLevelId ?? defaultGradeLevelId ?? ""}
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
                defaultValue={subject?.isCore ? "true" : "false"}
                className={inputClass}
              >
                <option value="true">Core Subject</option>
                <option value="false">Elective</option>
              </select>
            </div>
          </div>

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
