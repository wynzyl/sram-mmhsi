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
import { showSuccess, showError } from "@/lib/toast/index";
import { SHS_STRAND_SHORT_LABELS } from "@/lib/constants/strands";
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
  const hasHandledRef = useRef(false);

  const [state, action, isPending] = useActionState<
    DeleteStrandFormState,
    FormData
  >(deleteStrandAction, {});

  // Handle success/error state changes
  useEffect(() => {
    // Skip if already handled or no state yet
    if (hasHandledRef.current) return;
    if (!state.success && !state.message) return;

    if (state.success) {
      hasHandledRef.current = true;
      showSuccess("Strand deleted successfully");
      onOpenChange(false);
      // Force cleanup of body pointer-events after Radix processes close
      setTimeout(() => {
        document.body.style.pointerEvents = "";
        router.refresh();
      }, 100);
    } else if (state.message) {
      showError(state.message);
    }
  }, [state.success, state.message, onOpenChange, router]);

  const hasAssociations =
    (strand.subjectCount ?? 0) > 0 || (strand.enrollmentCount ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
    </AlertDialog>
  );
}
