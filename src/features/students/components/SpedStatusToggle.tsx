"use client";

import { useActionState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { updateSpecialEducationStatusAction } from "../students.actions";
import { useFormToast } from "@/hooks/useFormToast";

interface SpedStatusToggleProps {
  studentId: string;
  isSpecialEducation: boolean;
  canEdit: boolean;
}

export function SpedStatusToggle({
  studentId,
  isSpecialEducation,
  canEdit,
}: SpedStatusToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateSpecialEducationStatusAction, {});

  useFormToast(state, {
    successMessage: isSpecialEducation
      ? "SPED status removed"
      : "SPED status enabled",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  // Read-only badge when user can't edit
  if (!canEdit) {
    if (!isSpecialEducation) return null;
    return (
      <div className="student-record-meta-tile">
        <span className="student-record-meta-label">Program</span>
        <span className="student-record-meta-value">
          <Badge variant="info">SPED</Badge>
        </span>
      </div>
    );
  }

  // Editable toggle
  return (
    <div className="student-record-meta-tile">
      <span className="student-record-meta-label">SPED Program</span>
      <span className="student-record-meta-value">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer hover:opacity-80 ${
                isSpecialEducation
                  ? "border border-info/30 bg-info/10 text-info"
                  : "border border-muted-foreground/30 bg-muted/50 text-muted-foreground"
              }`}
            >
              {isSpecialEducation ? "SPED" : "Not SPED"}
              <span className="text-[10px] opacity-70">(click to change)</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isSpecialEducation ? "Remove SPED Status" : "Enable SPED Status"}
              </DialogTitle>
              <DialogDescription>
                {isSpecialEducation
                  ? "This will remove the Special Education (SPED) status from this student. Future assessments will not include the SPED fee automatically."
                  : "This will mark this student as requiring Special Education (SPED) services. Future assessments will automatically include the SPED fee."}
              </DialogDescription>
            </DialogHeader>

            <form
              action={(formData) => {
                formData.set("studentId", studentId);
                formData.set("isSpecialEducation", isSpecialEducation ? "false" : "true");
                startTransition(() => action(formData));
              }}
            >
              {state.message && (
                <p className="py-4 text-sm text-red-600">{state.message}</p>
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={isSpecialEducation ? "danger" : "primary"}
                  disabled={pending}
                >
                  {pending
                    ? "Updating..."
                    : isSpecialEducation
                      ? "Remove SPED Status"
                      : "Enable SPED Status"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </span>
    </div>
  );
}
