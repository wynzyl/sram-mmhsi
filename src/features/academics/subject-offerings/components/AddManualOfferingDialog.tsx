"use client";

import { useState, useActionState, useTransition, useCallback } from "react";
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
import { Loader2 } from "lucide-react";
import type {
  CurriculumForSubjectPicker,
  SubjectForManualOffering,
  AddManualSubjectOfferingFormState,
} from "../subject-offerings.schema";
import { addManualSubjectOfferingAction } from "../subject-offerings.actions";
import { getAvailableSubjectsForManualOffering } from "../subject-offerings.queries";

interface StrandOption {
  id: string;
  code: string;
}

interface AddManualOfferingDialogProps {
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  curriculums: CurriculumForSubjectPicker[];
  availableStrands: StrandOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddManualOfferingDialog({
  sectionId,
  sectionName,
  gradeLevelId,
  gradeLevelName,
  schoolYearId,
  curriculums,
  availableStrands,
  open,
  onOpenChange,
}: AddManualOfferingDialogProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Form state
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedStrandId, setSelectedStrandId] = useState<string>("");
  const [availableSubjects, setAvailableSubjects] = useState<SubjectForManualOffering[]>([]);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);

  // Action state
  const [state, action, isPending] = useActionState<
    AddManualSubjectOfferingFormState,
    FormData
  >(addManualSubjectOfferingAction, {});

  // Check if section is SHS (needs strand selection)
  const isShs = gradeLevelName === "Grade 11" || gradeLevelName === "Grade 12";

  // Get selected subject details
  const selectedSubject = availableSubjects.find((s) => s.id === selectedSubjectId);
  const showStrandSelector = isShs && selectedSubject && !selectedSubject.isCore;

  // Reset all form state
  const resetForm = useCallback(() => {
    setSelectedCurriculumId("");
    setSelectedSubjectId("");
    setSelectedStrandId("");
    setAvailableSubjects([]);
    setIsLoadingSubjects(false);
  }, []);

  useFormToast(state, {
    successMessage: "Subject offering added successfully",
    onSuccess: () => {
      resetForm();
      onOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    },
  });

  // Handle curriculum change - fetch subjects
  const handleCurriculumChange = useCallback(async (curriculumId: string) => {
    setSelectedCurriculumId(curriculumId);
    setSelectedSubjectId("");
    setSelectedStrandId("");

    if (!curriculumId) {
      setAvailableSubjects([]);
      return;
    }

    setIsLoadingSubjects(true);
    try {
      const subjects = await getAvailableSubjectsForManualOffering(
        curriculumId,
        gradeLevelId,
        sectionId,
        schoolYearId
      );
      setAvailableSubjects(subjects);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [gradeLevelId, sectionId, schoolYearId]);

  // Handle subject change - reset strand
  const handleSubjectChange = useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedStrandId("");
  }, []);

  // Handle dialog close - reset form
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  }, [onOpenChange, resetForm]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Elective Subject</DialogTitle>
          <DialogDescription>
            Add an elective subject with strand assignment to{" "}
            <strong>{sectionName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="schoolYearId" value={schoolYearId} />
          <input type="hidden" name="sourceCurriculumId" value={selectedCurriculumId} />
          <input type="hidden" name="subjectId" value={selectedSubjectId} />
          <input type="hidden" name="strandId" value={selectedStrandId || ""} />

          {/* Curriculum Picker */}
          <div className="space-y-2">
            <Label htmlFor="curriculum">Curriculum</Label>
            <Select
              value={selectedCurriculumId}
              onValueChange={handleCurriculumChange}
            >
              <SelectTrigger id="curriculum">
                <SelectValue placeholder="Select a curriculum" />
              </SelectTrigger>
              <SelectContent>
                {curriculums.map((curriculum) => (
                  <SelectItem key={curriculum.id} value={curriculum.id}>
                    {curriculum.name} (v{curriculum.version})
                    <span className="text-muted-foreground ml-2">
                      - {curriculum.subjectCount} elective(s)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {curriculums.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No curriculums with elective subjects available for {gradeLevelName}.
              </p>
            )}
          </div>

          {/* Subject Picker */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            {isLoadingSubjects ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading subjects...
              </div>
            ) : (
              <Select
                value={selectedSubjectId}
                onValueChange={handleSubjectChange}
                disabled={!selectedCurriculumId || availableSubjects.length === 0}
              >
                <SelectTrigger id="subject">
                  <SelectValue
                    placeholder={
                      !selectedCurriculumId
                        ? "Select a curriculum first"
                        : availableSubjects.length === 0
                          ? "No available subjects"
                          : "Select a subject"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      <span className="font-mono text-xs mr-2">
                        {subject.code}
                      </span>
                      {subject.name}
                      {!subject.isCore && (
                        <span className="text-muted-foreground ml-2">(Elective)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedCurriculumId && availableSubjects.length === 0 && !isLoadingSubjects && (
              <p className="text-sm text-muted-foreground">
                All electives from this curriculum already have offerings.
              </p>
            )}
            {state.errors?.subjectId && (
              <p className="text-sm text-destructive">{state.errors.subjectId[0]}</p>
            )}
          </div>

          {/* Strand Selector (SHS electives only) */}
          {showStrandSelector && (
            <div className="space-y-2">
              <Label htmlFor="strand">
                Strand
                {selectedSubject.strandAssociations.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    (Subject available to: {selectedSubject.strandAssociations.map((s) => s.strandCode).join(", ")})
                  </span>
                )}
              </Label>
              <Select
                value={selectedStrandId}
                onValueChange={setSelectedStrandId}
              >
                <SelectTrigger id="strand">
                  <SelectValue placeholder="Select a strand (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">
                    <span className="text-muted-foreground">All strands</span>
                  </SelectItem>
                  {availableStrands.map((strand) => (
                    <SelectItem key={strand.id} value={strand.id}>
                      {strand.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave blank to offer this subject to all strands.
              </p>
            </div>
          )}

          {/* Form-level errors */}
          {state.message && !state.success && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !selectedSubjectId}
            >
              {isPending ? "Adding..." : "Add Subject"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
