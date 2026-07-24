"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useFormToast } from "@/hooks/useFormToast";
import { SHS_STRAND_LABELS, type ShsStrandCode } from "@/lib/constants/strands";
import type {
  CanChangeStrandResult,
  ChangeStudentStrandFormState,
} from "../student-subject-enrollments.schema";
import type { StrandOption } from "@/features/academics/strands";
import { changeStudentStrandAction } from "../student-subject-enrollments.actions";

interface ChangeStrandDialogProps {
  enrollmentId: string;
  studentName: string;
  strandInfo: CanChangeStrandResult;
  availableStrands: StrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeStrandDialog({
  enrollmentId,
  studentName,
  strandInfo,
  availableStrands,
  open,
  onOpenChange,
}: ChangeStrandDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    ChangeStudentStrandFormState,
    FormData
  >(changeStudentStrandAction, {});

  useFormToast(state, {
    successMessage: "Strand changed successfully",
    onSuccess: () => {
      onOpenChange(false);
      // Use startTransition to make refresh non-blocking
      startTransition(() => {
        router.refresh();
      });
    },
  });

  // Filter out current strand from options
  const selectableStrands = availableStrands.filter(
    (s) => s.id !== strandInfo.currentStrandId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Change Strand</DialogTitle>
          <DialogDescription>
            Change the academic strand for <strong>{studentName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {/* Current Strand */}
        <div className="space-y-2">
          <Label>Current Strand</Label>
          <p className="text-sm font-medium">
            {strandInfo.currentStrandCode
              ? `${strandInfo.currentStrandCode} - ${strandInfo.currentStrandName}`
              : "No strand selected"}
          </p>
        </div>

        {/* Warning if cannot change */}
        {!strandInfo.canChange && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{strandInfo.reason}</AlertDescription>
          </Alert>
        )}

        {/* Warning about elective subjects */}
        {strandInfo.canChange && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Changing strand will remove current elective subject enrollments
              and enroll the student in elective subjects for the new strand.
            </AlertDescription>
          </Alert>
        )}

        <form action={action} className="space-y-4">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />

          <div className="space-y-2">
            <Label htmlFor="newStrandId">New Strand *</Label>
            <Select name="newStrandId" required disabled={!strandInfo.canChange}>
              <SelectTrigger id="newStrandId">
                <SelectValue placeholder="Select new strand" />
              </SelectTrigger>
              <SelectContent>
                {selectableStrands.map((strand) => (
                  <SelectItem key={strand.id} value={strand.id}>
                    {strand.code} - {SHS_STRAND_LABELS[strand.code]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.newStrandId && (
              <p className="text-sm text-destructive">
                {state.errors.newStrandId[0]}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !strandInfo.canChange}
            >
              {isPending ? "Changing..." : "Change Strand"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
