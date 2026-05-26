"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, AlertCircle } from "lucide-react";
import { updateIntakeDocumentsAction } from "../enrollments.actions";
import type { UpdateIntakeDocumentsFormState } from "../enrollments.schema";
import IntakeRequirementsFieldset from "./IntakeRequirementsFieldset";
import type { IntakePreserved } from "@/lib/utils/intake-documents";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    if (state.success) {
      setIsOpen(false);
    }
  }, [state.success]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
          Edit Documents
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-foreground">
            <Pencil className="h-5 w-5 text-primary" aria-hidden="true" />
            Edit Intake Documents
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            Update document statuses for{" "}
            <span className="font-semibold text-foreground">
              {schoolYear} · {gradeLevel}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

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
              onClick={() => setIsOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
