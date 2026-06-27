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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormToast } from "@/hooks/useFormToast";
import { archiveStudentAction } from "../archive.actions";
import {
  ARCHIVED_STUDENT_STATUSES,
  STUDENT_STATUS_LABELS,
  STUDENT_STATUS_DESCRIPTIONS,
} from "@/lib/constants/student-status";
import type { ArchiveStudentFormState } from "../archive.schema";

interface ArchiveStudentDialogProps {
  studentId: string;
  studentName: string;
  schoolYearOptions?: Array<{ id: string; label: string }>;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ArchiveStudentDialog({
  studentId,
  studentName,
  schoolYearOptions = [],
  trigger,
  onSuccess,
}: ArchiveStudentDialogProps) {
  const [open, setOpen] = useState(false);
  // Incremented on each open so the keyed form below remounts, giving every
  // dialog session a fresh useActionState (no leftover errors/message).
  const [formKey, setFormKey] = useState(0);

  // Handle dialog open/close - remount the form when opening
  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (isOpen) {
      setFormKey((k) => k + 1);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button variant="secondary">Archive Student</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Archive Student</DialogTitle>
          <DialogDescription>
            Archiving <strong>{studentName}</strong> will move them to the
            archive directory. You can still process payments and document
            requests for archived students.
          </DialogDescription>
        </DialogHeader>

        <ArchiveStudentForm
          key={formKey}
          studentId={studentId}
          studentName={studentName}
          schoolYearOptions={schoolYearOptions}
          onArchived={() => {
            setOpen(false);
            onSuccess?.();
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ArchiveStudentFormProps {
  studentId: string;
  studentName: string;
  schoolYearOptions: Array<{ id: string; label: string }>;
  onArchived: () => void;
  onCancel: () => void;
}

function ArchiveStudentForm({
  studentId,
  studentName,
  schoolYearOptions,
  onArchived,
  onCancel,
}: ArchiveStudentFormProps) {
  const [status, setStatus] = useState<string>("");
  const [schoolYearId, setSchoolYearId] = useState<string>("");

  const [state, action, isPending] = useActionState<
    ArchiveStudentFormState,
    FormData
  >(archiveStudentAction, {});

  useFormToast(state, {
    successMessage: `${studentName} has been archived.`,
    onSuccess: onArchived,
  });

  return (
    <form action={action} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <input type="hidden" name="schoolYearId" value={schoolYearId} />

          {/* Archive Status */}
          <div className="space-y-2">
            <Label htmlFor="archive-status">Archive Status</Label>
            <Select
              name="status"
              value={status}
              onValueChange={setStatus}
              required
            >
              <SelectTrigger id="archive-status">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {ARCHIVED_STUDENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <div className="flex flex-col">
                      <span>{STUDENT_STATUS_LABELS[s]}</span>
                      <span className="text-xs text-muted-foreground">
                        {STUDENT_STATUS_DESCRIPTIONS[s]}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state.errors?.status && (
              <p className="text-sm text-destructive">{state.errors.status[0]}</p>
            )}
          </div>

          {/* School Year */}
          {schoolYearOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="archive-school-year">
                School Year (optional)
              </Label>
              <Select value={schoolYearId} onValueChange={setSchoolYearId}>
                <SelectTrigger id="archive-school-year">
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
            </div>
          )}

          {/* Archive Reason */}
          <div className="space-y-2">
            <Label htmlFor="archive-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="archive-reason"
              name="archiveReason"
              placeholder="Enter the reason for archiving this student..."
              required
              minLength={10}
              rows={3}
            />
            {state.errors?.archiveReason && (
              <p className="text-sm text-destructive">
                {state.errors.archiveReason[0]}
              </p>
            )}
          </div>

          {/* Error message */}
          {state.message && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !status}>
              {isPending ? "Archiving..." : "Archive Student"}
            </Button>
          </DialogFooter>
        </form>
  );
}
