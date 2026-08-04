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
import { AlertTriangle, Users } from "lucide-react";
import { useFormToast } from "@/hooks/useFormToast";
import { SHS_STRAND_LABELS, type ShsStrandCode } from "@/lib/constants/strands";
import type { BulkAssignStrandFormState } from "../student-subject-enrollments.schema";
import type { StrandOption } from "@/features/academics/strands";
import { bulkAssignStrandAction } from "../student-subject-enrollments.actions";

interface BulkStrandAssignDialogProps {
  enrollmentIds: string[];
  studentCount: number;
  availableStrands: StrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkStrandAssignDialog({
  enrollmentIds,
  studentCount,
  availableStrands,
  open,
  onOpenChange,
}: BulkStrandAssignDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    BulkAssignStrandFormState,
    FormData
  >(bulkAssignStrandAction, {});

  useFormToast(state, {
    successMessage: state.updatedCount
      ? `Successfully assigned strand to ${state.updatedCount} student${state.updatedCount !== 1 ? "s" : ""}${state.skippedCount ? ` (${state.skippedCount} skipped)` : ""}`
      : "Strand assignment complete",
    onSuccess: () => {
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Assign Strand
          </DialogTitle>
          <DialogDescription>
            Assign a strand to <strong>{studentCount}</strong> selected student{studentCount !== 1 ? "s" : ""} without a current strand assignment.
          </DialogDescription>
        </DialogHeader>

        {/* Warning about elective subjects */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will enroll the selected students in strand-specific elective subjects
            based on the chosen strand.
          </AlertDescription>
        </Alert>

        <form action={action} className="space-y-4">
          <input
            type="hidden"
            name="enrollmentIds"
            value={JSON.stringify(enrollmentIds)}
          />

          <div className="space-y-2">
            <Label htmlFor="strandId">Assign Strand *</Label>
            <Select name="strandId" required>
              <SelectTrigger id="strandId">
                <SelectValue placeholder="Select strand to assign" />
              </SelectTrigger>
              <SelectContent>
                {availableStrands.map((strand) => (
                  <SelectItem key={strand.id} value={strand.id}>
                    {strand.code} - {SHS_STRAND_LABELS[strand.code as ShsStrandCode] || strand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.strandId && (
              <p className="text-sm text-destructive">
                {state.errors.strandId[0]}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <p className="font-medium">This will:</p>
            <ul className="mt-1 ml-4 list-disc text-muted-foreground">
              <li>Set the strand for all {studentCount} selected student{studentCount !== 1 ? "s" : ""}</li>
              <li>Enroll them in strand-specific elective subjects</li>
            </ul>
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
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isPending
                ? "Assigning..."
                : `Assign to ${studentCount} Student${studentCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
