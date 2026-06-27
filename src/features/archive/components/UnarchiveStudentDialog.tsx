"use client";

import { useActionState, useState } from "react";
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
import { useFormToast } from "@/hooks/useFormToast";
import { unarchiveStudentAction } from "../archive.actions";
import type { UnarchiveStudentFormState } from "../archive.schema";

interface UnarchiveStudentDialogProps {
  studentId: string;
  studentName: string;
  currentStatus: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function UnarchiveStudentDialog({
  studentId,
  studentName,
  currentStatus,
  trigger,
  onSuccess,
}: UnarchiveStudentDialogProps) {
  const [open, setOpen] = useState(false);

  const [state, action, isPending] = useActionState<
    UnarchiveStudentFormState,
    FormData
  >(unarchiveStudentAction, {});

  useFormToast(state, {
    successMessage: `${studentName} has been restored to active status.`,
    onSuccess: () => {
      setOpen(false);
      onSuccess?.();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="secondary">Restore Student</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Restore Student</DialogTitle>
          <DialogDescription>
            Restoring <strong>{studentName}</strong> (currently{" "}
            <em>{currentStatus}</em>) will move them back to the active student
            directory.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="unarchive-remarks">Remarks (optional)</Label>
            <Textarea
              id="unarchive-remarks"
              name="remarks"
              placeholder="Enter any notes about restoring this student..."
              rows={3}
            />
            {state.errors?.remarks && (
              <p className="text-sm text-destructive">
                {state.errors.remarks[0]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Restoring..." : "Restore Student"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
