"use client";

import { useState, useActionState, startTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useFormToast } from "@/hooks/useFormToast";
import { assignStudentsToSectionAction } from "../section-assignments.actions";
import type {
  StudentForSectionAssignment,
  SectionWithCount,
  AssignStudentsToSectionFormState,
} from "../section-assignments.schema";

interface AssignSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedStudents: StudentForSectionAssignment[];
  sections: SectionWithCount[];
  onSuccess?: () => void;
}

export function AssignSectionModal({
  open,
  onOpenChange,
  selectedStudents,
  sections,
  onSuccess,
}: AssignSectionModalProps) {
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

  const [state, formAction, isPending] = useActionState<
    AssignStudentsToSectionFormState,
    FormData
  >(assignStudentsToSectionAction, {});

  // Handle success toast and callback
  useFormToast(state, {
    successMessage: state.assignedCount
      ? `Successfully assigned ${state.assignedCount} student${state.assignedCount > 1 ? "s" : ""} to section.`
      : undefined,
    onSuccess: () => {
      setSelectedSectionId("");
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set(
      "enrollmentIds",
      JSON.stringify(selectedStudents.map((s) => s.enrollmentId))
    );
    formData.set("sectionId", selectedSectionId);

    startTransition(() => {
      formAction(formData);
    });
  };

  // Get grade level name from first selected student
  const gradeLevelName = selectedStudents[0]?.gradeLevelName ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Students to Section</DialogTitle>
          <DialogDescription>
            Assign {selectedStudents.length} selected student
            {selectedStudents.length > 1 ? "s" : ""} from {gradeLevelName} to a
            section.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Section selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Section</label>
            <Select
              value={selectedSectionId}
              onValueChange={setSelectedSectionId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a section..." />
              </SelectTrigger>
              <SelectContent>
                {sections.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No sections available for {gradeLevelName}
                  </div>
                ) : (
                  sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}{" "}
                      <span className="text-muted-foreground">
                        ({section.studentCount} student
                        {section.studentCount !== 1 ? "s" : ""})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {state.errors?.sectionId && (
              <p className="text-sm text-destructive">
                {state.errors.sectionId[0]}
              </p>
            )}
          </div>

          {/* Selected students preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Students to assign:
            </label>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-muted/50 p-2">
              <ul className="space-y-1 text-sm">
                {selectedStudents.slice(0, 10).map((student) => (
                  <li key={student.enrollmentId}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">
                      {student.studentRef}
                    </span>
                    {student.lastName}, {student.firstName}
                    {student.sectionName && (
                      <span className="text-muted-foreground ml-2">
                        (currently: {student.sectionName})
                      </span>
                    )}
                  </li>
                ))}
                {selectedStudents.length > 10 && (
                  <li className="text-muted-foreground italic">
                    ... and {selectedStudents.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Form-level error */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <DialogFooter>
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
              disabled={isPending || !selectedSectionId || sections.length === 0}
            >
              {isPending ? "Assigning..." : "Assign to Section"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
