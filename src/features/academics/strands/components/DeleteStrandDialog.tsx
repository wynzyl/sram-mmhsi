"use client";

import { useActionState, useEffect, useRef } from "react";
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
import { SHS_STRAND_SHORT_LABELS } from "@/lib/constants/strands";
import type { StrandView, DeleteStrandFormState } from "../strands.schema";
import { deleteStrandAction } from "../strands.actions";

interface DeleteStrandDialogProps {
  strand: StrandView | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteStrandDialog({
  strand,
  open,
  onOpenChange,
}: DeleteStrandDialogProps) {
  const router = useRouter();
  const isClosingRef = useRef(false);

  const [state, action, isPending] = useActionState<
    DeleteStrandFormState,
    FormData
  >(deleteStrandAction, {});

  // Reset closing flag when dialog opens
  useEffect(() => {
    if (open) {
      isClosingRef.current = false;
    }
  }, [open]);

  useFormToast(state, {
    successMessage: "Strand deleted successfully",
    onSuccess: () => {
      // Prevent double-close
      if (isClosingRef.current) return;
      isClosingRef.current = true;

      // Close dialog first, then refresh after animation completes
      onOpenChange(false);
      setTimeout(() => {
        router.refresh();
      }, 150);
    },
  });

  const hasAssociations = strand
    ? (strand.subjectCount ?? 0) > 0 || (strand.enrollmentCount ?? 0) > 0
    : false;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {strand && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strand</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Are you sure you want to delete the strand{" "}
                  <strong>
                    {SHS_STRAND_SHORT_LABELS[strand.code]} - {strand.name}
                  </strong>
                  ?
                </p>
                {hasAssociations && (
                  <p className="text-destructive">
                    This strand has{" "}
                    {(strand.subjectCount ?? 0) > 0 &&
                      `${strand.subjectCount} subject(s)`}
                    {(strand.subjectCount ?? 0) > 0 &&
                      (strand.enrollmentCount ?? 0) > 0 &&
                      " and "}
                    {(strand.enrollmentCount ?? 0) > 0 &&
                      `${strand.enrollmentCount} enrollment(s)`}
                    . Remove these associations before deleting.
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
      )}
    </AlertDialog>
  );
}
