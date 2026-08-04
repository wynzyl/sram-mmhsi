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
import { useFormToast } from "@/hooks/useFormToast";
import type {
  SubjectOfferingView,
  TeacherOption,
  AssignTeacherFormState,
} from "../subject-offerings.schema";
import { assignTeacherAction } from "../subject-offerings.actions";

interface AssignTeacherDialogProps {
  offering: SubjectOfferingView;
  teachers: TeacherOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignTeacherDialog({
  offering,
  teachers,
  open,
  onOpenChange,
}: AssignTeacherDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    AssignTeacherFormState,
    FormData
  >(assignTeacherAction, {});

  useFormToast(state, {
    successMessage: "Teacher assigned successfully",
    onSuccess: () => {
      onOpenChange(false);
      // Use startTransition to make refresh non-blocking
      // This allows the dialog to close smoothly before the page refreshes
      startTransition(() => {
        router.refresh();
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Assign Teacher</DialogTitle>
          <DialogDescription>
            Assign a teacher to <strong>{offering.subjectName}</strong> for section{" "}
            <strong>{offering.sectionName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input
            type="hidden"
            name="subjectOfferingId"
            value={offering.id}
          />

          <div className="space-y-2">
            <Label htmlFor="teacherId">Teacher</Label>
            <Select name="teacherId" defaultValue={offering.teacherId ?? ""}>
              <SelectTrigger id="teacherId">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="text-muted-foreground">No teacher (unassign)</span>
                </SelectItem>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                    <span className="text-muted-foreground ml-2">
                      ({teacher.email})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.teacherId && (
              <p className="text-sm text-destructive">
                {state.errors.teacherId[0]}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
