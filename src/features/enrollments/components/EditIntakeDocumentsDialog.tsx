"use client";

import { useActionState, useState, useCallback } from "react";
import { Pencil, AlertCircle } from "lucide-react";
import { updateIntakeDocumentsAction } from "../enrollments.actions";
import type { UpdateIntakeDocumentsFormState } from "../enrollments.schema";
import IntakeRequirementsFieldset from "./IntakeRequirementsFieldset";
import type { IntakePreserved } from "@/lib/utils/intake-documents";
import { Modal, ModalHeader, ModalBody } from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";

interface EditIntakeDocumentsDialogProps {
  enrollmentId: string;
  schoolYear: string;
  gradeLevel: string;
  preserved: IntakePreserved;
}

const initialState: UpdateIntakeDocumentsFormState = {};

export default function EditIntakeDocumentsDialog({
  enrollmentId,
  schoolYear,
  gradeLevel,
  preserved,
}: EditIntakeDocumentsDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, action, pending] = useActionState(updateIntakeDocumentsAction, initialState);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  useFormToast(state, {
    successMessage: "Documents updated successfully",
    onSuccess: closeModal,
  });

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={openModal}>
        <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
        Edit Documents
      </Button>

      <Modal
        open={isOpen}
        onClose={closeModal}
        size="lg"
        aria-labelledby="edit-intake-docs-title"
        aria-describedby="edit-intake-docs-description"
      >
        <ModalHeader onClose={closeModal} kicker="Enrollments · Documents">
          <h2 id="edit-intake-docs-title" className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" aria-hidden="true" />
            Edit Intake Documents
          </h2>
        </ModalHeader>

        <ModalBody>
          <p id="edit-intake-docs-description" className="text-sm text-muted-foreground mb-4">
            Update document statuses for{" "}
            <span className="font-semibold text-foreground">
              {schoolYear} · {gradeLevel}
            </span>
          </p>

          <form action={action} className="space-y-4">
            <input type="hidden" name="enrollmentId" value={enrollmentId} />

            {state.message && !state.success && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{state.message}</span>
              </div>
            )}

            <IntakeRequirementsFieldset
              legend="Document Status"
              description="Update each document's status as needed."
              preserved={preserved}
              errors={state.errors}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </ModalBody>
      </Modal>
    </>
  );
}
