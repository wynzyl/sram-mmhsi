"use client";

import { useActionState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useFormToast } from "@/hooks/useFormToast";
import type {
  StudentSubjectEnrollmentView,
  WithdrawFromSubjectFormState,
} from "../student-subject-enrollments.schema";
import { withdrawFromSubjectAction } from "../student-subject-enrollments.actions";

interface WithdrawSubjectDialogProps {
  enrollment: StudentSubjectEnrollmentView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WithdrawSubjectDialog({
  enrollment,
  open,
  onOpenChange,
}: WithdrawSubjectDialogProps) {
  const router = useRouter();

  const [state, action, isPending] = useActionState<
    WithdrawFromSubjectFormState,
    FormData
  >(withdrawFromSubjectAction, {});

  useFormToast(state, {
    successMessage: "Student withdrawn from subject",
    onSuccess: () => {
      onOpenChange(false);
      router.refresh();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Withdraw from Subject</DialogTitle>
          <DialogDescription>
            Withdraw <strong>{enrollment.studentName}</strong> from{" "}
            <strong>{enrollment.subjectName}</strong> ({enrollment.subjectCode}).
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input
            type="hidden"
            name="studentSubjectEnrollmentId"
            value={enrollment.id}
          />

          <div className="space-y-2">
            <Label htmlFor="reason">Withdrawal Reason *</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Enter the reason for withdrawal..."
              rows={3}
              required
            />
            {state.errors?.reason && (
              <p className="text-sm text-destructive">
                {state.errors.reason[0]}
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
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? "Withdrawing..." : "Withdraw"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
