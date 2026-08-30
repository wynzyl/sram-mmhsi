"use client";

import { useState, useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useFormToast } from "@/hooks/useFormToast";
import type { DeleteAllSubjectOfferingsFormState } from "../subject-offerings.schema";
import { deleteAllSubjectOfferingsAction } from "../subject-offerings.actions";

interface DeleteAllOfferingsButtonProps {
  sectionId: string;
  schoolYearId: string;
  offeringsCount: number;
}

export function DeleteAllOfferingsButton({
  sectionId,
  schoolYearId,
  offeringsCount,
}: DeleteAllOfferingsButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [state, action, isPending] = useActionState<
    DeleteAllSubjectOfferingsFormState,
    FormData
  >(deleteAllSubjectOfferingsAction, {});

  useFormToast(state, {
    successMessage: state.deletedCount
      ? `Deleted ${state.deletedCount} subject offering(s)`
      : "Subject offerings deleted",
    onSuccess: () => {
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  if (offeringsCount === 0) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="danger-outline" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete All
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete All Subject Offerings?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete all <strong>{offeringsCount}</strong> subject offering(s) for this section.
            This action cannot be undone.
            <br /><br />
            <span className="text-warning">
              Note: This will fail if any students are enrolled in these subjects.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <form action={action}>
            <input type="hidden" name="sectionId" value={sectionId} />
            <input type="hidden" name="schoolYearId" value={schoolYearId} />
            <AlertDialogAction
              type="submit"
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
