"use client";

import { useActionState, useState, startTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFormToast } from "@/hooks/useFormToast";
import { batchCancelNoShowAction } from "../archive.actions";
import type { BatchCancelNoShowFormState } from "../archive.schema";

interface BatchNoShowDialogProps {
  schoolYearOptions: Array<{ id: string; label: string; isActive: boolean }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function BatchNoShowDialog({
  schoolYearOptions,
  trigger,
  onSuccess,
}: BatchNoShowDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  const [state, action, isPending] = useActionState<
    BatchCancelNoShowFormState,
    FormData
  >(batchCancelNoShowAction, {});

  useFormToast(state, {
    successMessage: state.cancelledCount
      ? `Successfully cancelled ${state.cancelledCount} no-show enrollments.`
      : undefined,
    onSuccess: () => {
      setOpen(false);
      setConfirmOpen(false);
      onSuccess?.();
    },
  });

  // Handle dialog open/close - reset form when opening
  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setSchoolYearId("");
      setRemarks("");
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    const formData = new FormData();
    formData.set("schoolYearId", schoolYearId);
    if (remarks) {
      formData.set("remarks", remarks);
    }
    // Close the confirmation modal before dispatching so a failure state
    // (inline errors / message in the main dialog) isn't hidden behind it.
    setConfirmOpen(false);
    startTransition(() => {
      action(formData);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="secondary">Batch Cancel No-Shows</Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Batch Cancel No-Show Enrollments</DialogTitle>
            <DialogDescription>
              Cancel all &quot;assessed&quot; enrollments that never received
              any payment. This is typically done at the end of the school year
              to clean up students who were assessed but never showed up.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* School Year */}
            <div className="space-y-2">
              <Label htmlFor="noshow-school-year">
                School Year <span className="text-destructive">*</span>
              </Label>
              <Select
                value={schoolYearId}
                onValueChange={setSchoolYearId}
                required
              >
                <SelectTrigger id="noshow-school-year">
                  <SelectValue placeholder="Select school year..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYearOptions.map((sy) => (
                    <SelectItem key={sy.id} value={sy.id}>
                      {sy.label}
                      {sy.isActive && <span className="text-emerald-500 ml-1">(Active)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.errors?.schoolYearId && (
                <p className="text-sm text-destructive">
                  {state.errors.schoolYearId[0]}
                </p>
              )}
            </div>

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="noshow-remarks">Remarks (optional)</Label>
              <Textarea
                id="noshow-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any additional notes..."
                rows={2}
              />
            </div>

            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Warning:</p>
              <p className="mt-1 text-muted-foreground">
                This will cancel all enrollments with &quot;assessed&quot;
                status and zero payments. Students will be archived as
                &quot;cancelled&quot; with reason &quot;no_show&quot;.
              </p>
            </div>

            {/* Error message */}
            {state.message && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={isPending || !schoolYearId}
              >
                Preview & Confirm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Cancellation</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel all assessed enrollments with no payments and
              archive the students. This action cannot be undone in batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Processing..." : "Confirm Cancellation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
