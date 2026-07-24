"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";
import type {
  SubjectOfferingView,
  DeleteSubjectOfferingFormState,
} from "../subject-offerings.schema";
import { deleteSubjectOfferingAction } from "../subject-offerings.actions";

interface DeleteOfferingDialogProps {
  offering: SubjectOfferingView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteOfferingDialog({
  offering,
  open,
  onOpenChange,
}: DeleteOfferingDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    DeleteSubjectOfferingFormState,
    FormData
  >(deleteSubjectOfferingAction, {});

  useFormToast(state, {
    successMessage: "Subject offering deleted successfully",
    onSuccess: () => {
      onOpenChange(false);
      // Use startTransition to make refresh non-blocking
      startTransition(() => {
        router.refresh();
      });
    },
  });

  const hasStudents = (offering.studentCount ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Subject Offering</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to delete{" "}
                <strong>{offering.subjectName}</strong> ({offering.subjectCode})
                from section <strong>{offering.sectionName}</strong>?
              </p>
              {hasStudents && (
                <p className="text-destructive">
                  This offering has {offering.studentCount} student(s) enrolled.
                  Remove student enrollments before deleting.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <form action={action}>
            <input type="hidden" name="id" value={offering.id} />
            <Button
              type="submit"
              variant="danger"
              disabled={isPending || hasStudents}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
