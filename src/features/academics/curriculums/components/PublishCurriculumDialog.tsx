"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import { publishCurriculumAction } from "../curriculums.actions";
import type { PublishCurriculumFormState } from "../curriculums.schema";
import type { PreflightResult } from "../curriculum-preflight";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SchoolYear {
  id: string;
  label: string;
}

interface PublishCurriculumDialogProps {
  curriculumId: string;
  curriculumName: string;
  preflight: PreflightResult;
  gradeLevels: GradeLevelOption[];
  activeSchoolYear: SchoolYear | null;
  onClose: () => void;
}

export function PublishCurriculumDialog({
  curriculumId,
  curriculumName,
  preflight,
  gradeLevels,
  activeSchoolYear,
  onClose,
}: PublishCurriculumDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([]);

  const [state, action, isPending] = useActionState<
    PublishCurriculumFormState,
    FormData
  >(publishCurriculumAction, {});

  useFormToast(state, {
    successMessage: "Curriculum published successfully",
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

  const handleGradeLevelToggle = (gradeLevelId: string) => {
    setSelectedGradeLevels((prev) =>
      prev.includes(gradeLevelId)
        ? prev.filter((id) => id !== gradeLevelId)
        : [...prev, gradeLevelId]
    );
  };

  const totalSubjects = preflight.subjectsByGrade.reduce(
    (sum, g) => sum + g.subjectCount,
    0
  );

  // Grade levels that have subjects defined in this curriculum
  const gradeLevelsWithSubjects = new Set(
    preflight.subjectsByGrade.map((g) => g.gradeLevelId)
  );

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent p-0 m-auto backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Publish Curriculum</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You are about to publish <strong>{curriculumName}</strong>. Once
            published, subjects cannot be edited.
          </p>

          {/* Preflight Checks */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Preflight Checks</h3>
            <div className="bg-muted/50 border border-border rounded-md p-3 space-y-2">
              {preflight.canPublish ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>
                      {totalSubjects} subjects defined across{" "}
                      {preflight.subjectsByGrade.length} grade levels
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>No duplicate subject codes</span>
                  </div>
                </>
              ) : (
                preflight.errors.map((error, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 text-sm text-destructive"
                  >
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span>{error}</span>
                  </div>
                ))
              )}
              {preflight.warnings.map((warning, idx) => (
                <div
                  key={`warn-${idx}`}
                  className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Adoptions */}
          {preflight.canPublish && activeSchoolYear && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">
                Optional: Adopt for School Year
              </h3>
              <p className="text-xs text-muted-foreground">
                Select grade levels to immediately adopt this curriculum for{" "}
                <strong>{activeSchoolYear.label}</strong>.
              </p>
              <div className="bg-muted/50 border border-border rounded-md p-3 max-h-48 overflow-y-auto">
                <div className="space-y-2">
                  {gradeLevels.map((gl) => {
                    const hasSubjects = gradeLevelsWithSubjects.has(gl.id);
                    return (
                      <label
                        key={gl.id}
                        className={`flex items-center gap-2 text-sm ${
                          !hasSubjects
                            ? "text-muted-foreground cursor-not-allowed"
                            : "cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedGradeLevels.includes(gl.id)}
                          onChange={() => handleGradeLevelToggle(gl.id)}
                          disabled={!hasSubjects}
                          className="rounded border-border text-primary focus:ring-primary/20"
                        />
                        <span>{gl.name}</span>
                        {!hasSubjects && (
                          <span className="text-xs text-muted-foreground">
                            (no subjects)
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <form action={action}>
            <input type="hidden" name="curriculumId" value={curriculumId} />
            {selectedGradeLevels.map((glId) => (
              <input
                key={glId}
                type="hidden"
                name="adoptForGradeLevels"
                value={glId}
              />
            ))}
            {selectedGradeLevels.length > 0 && activeSchoolYear && (
              <input
                type="hidden"
                name="schoolYearId"
                value={activeSchoolYear.id}
              />
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
                disabled={isPending || !preflight.canPublish}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Publishing..." : "Publish Curriculum"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}
