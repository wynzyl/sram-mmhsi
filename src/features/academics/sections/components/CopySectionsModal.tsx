"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { copySectionsFromSchoolYearAction } from "../sections.actions";
import type { CopySectionsFormState } from "../sections.schema";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { useFormToast } from "@/hooks/useFormToast";
import { Button } from "@/components/ui/button";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
  sectionCount: number;
}

interface CopySectionsModalProps {
  schoolYears: SchoolYearOption[];
  activeSchoolYearId: string;
  onClose: () => void;
}

export default function CopySectionsModal({
  schoolYears,
  activeSchoolYearId,
  onClose,
}: CopySectionsModalProps) {
  const router = useRouter();

  // Filter to only show previous years (not the active year)
  const sourceYears = schoolYears.filter((sy) => sy.id !== activeSchoolYearId);

  // Default to the most recent previous year with sections
  const defaultSourceYear = sourceYears.find((sy) => sy.sectionCount > 0)?.id ?? "";
  const [sourceSchoolYearId, setSourceSchoolYearId] = useState(defaultSourceYear);

  // Get section count for selected source year
  const selectedYear = sourceYears.find((sy) => sy.id === sourceSchoolYearId);
  const sectionCount = selectedYear?.sectionCount ?? 0;

  const initialState: CopySectionsFormState = {};

  const [state, action, pending] = useActionState(
    copySectionsFromSchoolYearAction,
    initialState
  );

  useFormToast(state, {
    successMessage: state.message,
    onSuccess: () => {
      router.refresh();
      onClose();
    },
  });

  // No previous years available
  if (sourceYears.length === 0) {
    return (
      <Modal open={true} onClose={onClose} aria-labelledby="copy-sections-modal-title">
        <ModalHeader onClose={onClose} kicker="Academics">
          <h2 id="copy-sections-modal-title">Copy Sections</h2>
        </ModalHeader>
        <ModalBody>
          <div className="text-center py-4">
            <p className="text-muted-foreground">
              No previous school years available to copy sections from.
            </p>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </ModalBody>
      </Modal>
    );
  }

  return (
    <Modal open={true} onClose={onClose} aria-labelledby="copy-sections-modal-title">
      <ModalHeader onClose={onClose} kicker="Academics">
        <h2 id="copy-sections-modal-title">Copy Sections from Previous Year</h2>
      </ModalHeader>

      <ModalBody>
        <form action={action} className="space-y-4">
          {/* Hidden target school year (always the active year) */}
          <input type="hidden" name="targetSchoolYearId" value={activeSchoolYearId} />

          {/* Source School Year */}
          <div className="space-y-2">
            <label
              htmlFor="sourceSchoolYearId"
              className="text-sm font-medium text-foreground"
            >
              Copy from School Year
            </label>
            <select
              id="sourceSchoolYearId"
              name="sourceSchoolYearId"
              value={sourceSchoolYearId}
              onChange={(e) => setSourceSchoolYearId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-foreground text-sm"
            >
              <option value="">Select School Year</option>
              {sourceYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.label} ({sy.sectionCount} section{sy.sectionCount !== 1 ? "s" : ""})
                </option>
              ))}
            </select>
            {state.errors?.sourceSchoolYearId && (
              <p className="text-sm text-destructive">
                {state.errors.sourceSchoolYearId[0]}
              </p>
            )}
          </div>

          {/* Preview */}
          {sourceSchoolYearId && sectionCount > 0 && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                <span className="font-medium">{sectionCount}</span> section
                {sectionCount !== 1 ? "s" : ""} will be copied to the active school year.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Sections that already exist (same name and grade level) will be skipped.
              </p>
            </div>
          )}

          {sourceSchoolYearId && sectionCount === 0 && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                No sections found in {selectedYear?.label}.
              </p>
            </div>
          )}

          {/* Form-level error */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          {/* Result summary (shown after successful copy but before toast closes modal) */}
          {state.success && state.copied !== undefined && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-md">
              <p className="text-sm text-success-foreground">
                Copied {state.copied} section{state.copied !== 1 ? "s" : ""}.
                {(state.skipped ?? 0) > 0 && (
                  <> {state.skipped} skipped (already exist).</>
                )}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={pending}
              disabled={!sourceSchoolYearId || sectionCount === 0}
            >
              Copy Sections
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
