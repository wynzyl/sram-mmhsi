"use client";

import { useActionState, startTransition } from "react";
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
import type { StrandView, DeleteStrandFormState } from "../strands.schema";
import { deleteStrandAction } from "../strands.actions";

interface DeleteStrandDialogProps {
  strand: StrandView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteStrandDialog({
  strand,
  open,
  onOpenChange,
}: DeleteStrandDialogProps) {
  const router = useRouter();

  const [state, action, isPending] = useActionState<
    DeleteStrandFormState,
    FormData
  >(deleteStrandAction, {});

  // Handle success/error state changes
  useFormToast(state, {
    successMessage: "Track deleted successfully",
    onSuccess: () => {
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  const hasAssociations =
    (strand.subjectCount ?? 0) > 0 ||
    (strand.sectionCount ?? 0) > 0 ||
    (strand.enrollmentCount ?? 0) > 0;

  // Build association message
  const getAssociationMessage = () => {
    const parts: string[] = [];
    if ((strand.subjectCount ?? 0) > 0) {
      parts.push(`${strand.subjectCount} subject(s)`);
    }
    if ((strand.sectionCount ?? 0) > 0) {
      parts.push(`${strand.sectionCount} section(s)`);
    }
    if ((strand.enrollmentCount ?? 0) > 0) {
      parts.push(`${strand.enrollmentCount} enrollment(s)`);
    }
    return parts.join(", ");
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Track</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete the track{" "}
                  <strong>
                    {strand.shortCode} - {strand.name}
                  </strong>
                  ?
                </p>
                {hasAssociations && (
                  <p className="text-destructive">
                    This track has {getAssociationMessage()}.
                    Remove these associations before deleting.
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
              <input type="hidden" name="id" value={strand.id} />
              <Button
                type="submit"
                variant="danger"
                disabled={isPending || hasAssociations}
              >
                {isPending ? "Deleting..." : "Delete"}
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
