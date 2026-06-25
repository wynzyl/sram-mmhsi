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
import { batchArchiveGraduatesAction } from "../archive.actions";
import type { BatchArchiveGraduatesFormState } from "../archive.schema";

interface BatchArchiveDialogProps {
  schoolYearOptions: Array<{ id: string; label: string }>;
  gradeLevelOptions?: Array<{ id: string; name: string }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function BatchArchiveDialog({
  schoolYearOptions,
  gradeLevelOptions = [],
  trigger,
  onSuccess,
}: BatchArchiveDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [gradeLevelId, setGradeLevelId] = useState<string>("");
  const [remarks, setRemarks] = useState("");

  const [state, action, isPending] = useActionState<
    BatchArchiveGraduatesFormState,
    FormData
  >(batchArchiveGraduatesAction, {});

  useFormToast(state, {
    successMessage: state.archivedCount
      ? `Successfully archived ${state.archivedCount} students as graduated.`
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
      setGradeLevelId("");
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
    if (gradeLevelId) {
      formData.set("gradeLevelId", gradeLevelId);
    }
    if (remarks) {
      formData.set("remarks", remarks);
    }
    startTransition(() => {
      action(formData);
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="secondary">Batch Archive Graduates</Button>
          )}
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Batch Archive Graduates</DialogTitle>
            <DialogDescription>
              Archive all enrolled students in the selected grade level as
              &quot;Graduated&quot;. This is typically done at the end of the
              school year for graduating students.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* School Year */}
            <div className="space-y-2">
              <Label htmlFor="batch-school-year">
                School Year <span className="text-destructive">*</span>
              </Label>
              <Select
                value={schoolYearId}
                onValueChange={setSchoolYearId}
                required
              >
                <SelectTrigger id="batch-school-year">
                  <SelectValue placeholder="Select school year..." />
                </SelectTrigger>
                <SelectContent>
                  {schoolYearOptions.map((sy) => (
                    <SelectItem key={sy.id} value={sy.id}>
                      {sy.label}
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

            {/* Grade Level (optional) */}
            {gradeLevelOptions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="batch-grade-level">
                  Grade Level (defaults to Grade 12/SHS)
                </Label>
                <Select value={gradeLevelId} onValueChange={setGradeLevelId}>
                  <SelectTrigger id="batch-grade-level">
                    <SelectValue placeholder="All graduating levels" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeLevelOptions.map((gl) => (
                      <SelectItem key={gl.id} value={gl.id}>
                        {gl.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Remarks */}
            <div className="space-y-2">
              <Label htmlFor="batch-remarks">Remarks (optional)</Label>
              <Textarea
                id="batch-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter any additional notes..."
                rows={2}
              />
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
              <Button type="submit" disabled={isPending || !schoolYearId}>
                Preview & Confirm
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Archive</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive all enrolled students in the selected grade
              level as &quot;Graduated&quot;. This action can be reversed
              individually but not in batch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isPending}>
              {isPending ? "Processing..." : "Confirm Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
