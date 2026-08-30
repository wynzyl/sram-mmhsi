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
import { AlertTriangle, BookOpen } from "lucide-react";
import { useFormToast } from "@/hooks/useFormToast";
import type { ManualEnrollSubjectFormState } from "../student-subject-enrollments.schema";
import { manuallyEnrollStudentInSubjectAction } from "../student-subject-enrollments.actions";

/**
 * Subject option for manual enrollment dropdown.
 */
export interface SubjectOfferingOption {
  id: string;
  subjectCode: string;
  subjectName: string;
  subjectUnits: string;
  isCore: boolean;
  strandId: string | null;
  strandCode: string | null;
  teacherName: string | null;
}

interface ManualSubjectEnrollDialogProps {
  enrollmentId: string;
  studentName: string;
  studentStrandCode: string | null;
  /** Available subject offerings not yet enrolled */
  availableOfferings: SubjectOfferingOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualSubjectEnrollDialog({
  enrollmentId,
  studentName,
  studentStrandCode,
  availableOfferings,
  open,
  onOpenChange,
}: ManualSubjectEnrollDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [state, action, isPending] = useActionState<
    ManualEnrollSubjectFormState,
    FormData
  >(manuallyEnrollStudentInSubjectAction, {});

  useFormToast(state, {
    successMessage: state.warning
      ? `Subject added. ${state.warning}`
      : "Subject added successfully",
    onSuccess: () => {
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  // Filter to show only elective offerings
  const electiveOfferings = availableOfferings.filter((o) => !o.isCore);

  // Group by strand for better organization
  const noStrandOfferings = electiveOfferings.filter((o) => !o.strandId);
  const strandOfferings = electiveOfferings.filter((o) => o.strandId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Add Subject Enrollment
          </DialogTitle>
          <DialogDescription>
            Manually enroll <strong>{studentName}</strong>
            {studentStrandCode && (
              <span> ({studentStrandCode} strand)</span>
            )} in an elective subject.
          </DialogDescription>
        </DialogHeader>

        {electiveOfferings.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No additional elective subjects available for enrollment.
              The student may already be enrolled in all available electives.
            </AlertDescription>
          </Alert>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="enrollmentId" value={enrollmentId} />

            <div className="space-y-2">
              <Label htmlFor="subjectOfferingId">Select Subject *</Label>
              <Select name="subjectOfferingId" required>
                <SelectTrigger id="subjectOfferingId">
                  <SelectValue placeholder="Select a subject to enroll" />
                </SelectTrigger>
                <SelectContent>
                  {/* General electives (no strand requirement) */}
                  {noStrandOfferings.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        General Electives
                      </div>
                      {noStrandOfferings.map((offering) => (
                        <SelectItem key={offering.id} value={offering.id}>
                          <div className="flex flex-col">
                            <span>
                              {offering.subjectCode} - {offering.subjectName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {offering.subjectUnits} units
                              {offering.teacherName && ` · ${offering.teacherName}`}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}

                  {/* Strand-specific electives */}
                  {strandOfferings.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-1">
                        Strand-Specific Electives
                      </div>
                      {strandOfferings.map((offering) => {
                        const isCrossStrand =
                          studentStrandCode &&
                          offering.strandCode &&
                          offering.strandCode !== studentStrandCode;
                        return (
                          <SelectItem key={offering.id} value={offering.id}>
                            <div className="flex flex-col">
                              <span className="flex items-center gap-1">
                                {offering.subjectCode} - {offering.subjectName}
                                {isCrossStrand && (
                                  <AlertTriangle className="h-3 w-3 text-warning" />
                                )}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {offering.strandCode}
                                {isCrossStrand && " (different strand)"}
                                {" · "}{offering.subjectUnits} units
                                {offering.teacherName && ` · ${offering.teacherName}`}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                </SelectContent>
              </Select>
              {state.errors?.subjectOfferingId && (
                <p className="text-sm text-destructive">
                  {state.errors.subjectOfferingId[0]}
                </p>
              )}
            </div>

            {/* Cross-strand warning */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                You can enroll the student in subjects from other strands if needed.
                A warning will be shown but the enrollment will proceed.
              </AlertDescription>
            </Alert>

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
                {isPending ? "Adding..." : "Add Subject"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
