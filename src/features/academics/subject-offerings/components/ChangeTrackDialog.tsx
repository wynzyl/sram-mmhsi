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
import { Badge } from "@/components/ui/badge";
import { useFormToast } from "@/hooks/useFormToast";
import type {
  SubjectOfferingView,
  UpdateOfferingTrackFormState,
} from "../subject-offerings.schema";
import type { StrandOption } from "@/features/academics/strands/strands.schema";
import { updateOfferingTrackAction } from "../subject-offerings.actions";

interface ChangeTrackDialogProps {
  offering: SubjectOfferingView;
  availableStrands: StrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Dialog for changing the track (strand) assignment of a subject offering.
 * Allows assigning a subject to a specific track or "All Tracks" (null strandId).
 */
export function ChangeTrackDialog({
  offering,
  availableStrands,
  open,
  onOpenChange,
}: ChangeTrackDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    UpdateOfferingTrackFormState,
    FormData
  >(updateOfferingTrackAction, {});

  useFormToast(state, {
    successMessage: "Track assignment updated successfully",
    onSuccess: () => {
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  // Current track display
  const currentTrackLabel = offering.strandCode
    ? `${offering.strandCode} only`
    : "All Tracks";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Change Track Assignment</DialogTitle>
          <DialogDescription>
            Change which track can take <strong>{offering.subjectName}</strong> in section{" "}
            <strong>{offering.sectionName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={offering.id} />

          {/* Current assignment info */}
          <div className="rounded-md bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subject:</span>
              <Badge variant="secondary">{offering.subjectCode}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Type:</span>
              <Badge variant={offering.isCore ? "info" : "secondary"}>
                {offering.isCore ? "Core" : "Elective"}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Track:</span>
              <span className="font-medium">{currentTrackLabel}</span>
            </div>
          </div>

          {/* Track selection */}
          <div className="space-y-2">
            <Label htmlFor="strandId">Assign to Track</Label>
            <Select name="strandId" defaultValue={offering.strandId ?? ""}>
              <SelectTrigger id="strandId">
                <SelectValue placeholder="Select a track" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">
                  <span className="font-medium">All Tracks</span>
                  <span className="text-muted-foreground ml-2">
                    (All students take this subject)
                  </span>
                </SelectItem>
                {availableStrands.map((strand) => (
                  <SelectItem key={strand.id} value={strand.id}>
                    <span className="font-medium">{strand.shortCode}</span>
                    <span className="text-muted-foreground ml-2">
                      ({strand.name})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select "All Tracks" to make this subject available to all students,
              or select a specific track to restrict it.
            </p>
            {state.errors?.strandId && (
              <p className="text-sm text-destructive">
                {state.errors.strandId[0]}
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
