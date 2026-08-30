"use client";

import { useActionState, useEffect, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormToast } from "@/hooks/useFormToast";
import { archiveCurriculumAction } from "../curriculums.actions";
import type { ArchiveCurriculumFormState } from "../curriculums.schema";

interface ArchiveCurriculumDialogProps {
  curriculumId: string;
  curriculumName: string;
  onClose: () => void;
}

export function ArchiveCurriculumDialog({
  curriculumId,
  curriculumName,
  onClose,
}: ArchiveCurriculumDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmName, setConfirmName] = useState("");

  const [state, action, isPending] = useActionState<
    ArchiveCurriculumFormState,
    FormData
  >(archiveCurriculumAction, {});

  useFormToast(state, {
    successMessage: "Curriculum archived successfully",
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

  const nameMatches =
    confirmName.trim().toLowerCase() === curriculumName.toLowerCase();

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-transparent p-0 m-auto backdrop:bg-black/50"
      onClose={onClose}
    >
      <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Archive Curriculum</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
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
            You are about to archive <strong>{curriculumName}</strong>. Archived
            curriculums can no longer be adopted for new school years. Historical
            adoptions are preserved for grade history.
          </p>

          <form action={action} className="space-y-4">
            <input type="hidden" name="curriculumId" value={curriculumId} />

            <div className="space-y-1">
              <label
                htmlFor="archive-confirm-name"
                className="text-sm font-medium"
              >
                Type <strong>{curriculumName}</strong> to confirm
              </label>
              <input
                id="archive-confirm-name"
                name="confirmName"
                type="text"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {state.errors?.confirmName && (
                <p className="text-xs text-destructive">
                  {state.errors.confirmName[0]}
                </p>
              )}
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
                disabled={isPending || !nameMatches}
                className="px-4 py-2 text-sm font-medium text-destructive-foreground bg-destructive rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Archiving..." : "Archive Curriculum"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </dialog>
  );
}
