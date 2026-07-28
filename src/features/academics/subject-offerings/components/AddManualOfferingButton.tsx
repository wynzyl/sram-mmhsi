"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AddManualOfferingDialog } from "./AddManualOfferingDialog";
import type { CurriculumForSubjectPicker } from "../subject-offerings.schema";
import type { GradingSystemType } from "@/lib/constants/grading-systems";

interface StrandOption {
  id: string;
  code: string;
}

interface AddManualOfferingButtonProps {
  sectionId: string;
  sectionName: string;
  gradeLevelId: string;
  gradeLevelName: string;
  schoolYearId: string;
  curriculums: CurriculumForSubjectPicker[];
  availableStrands?: StrandOption[];
  /** Grading system type for term selection (SHS only) */
  gradingSystemType?: GradingSystemType;
}

export function AddManualOfferingButton({
  sectionId,
  sectionName,
  gradeLevelId,
  gradeLevelName,
  schoolYearId,
  curriculums,
  availableStrands = [],
  gradingSystemType = "quarterly",
}: AddManualOfferingButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Don't render if no curriculums available
  if (curriculums.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsDialogOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Elective
      </Button>

      <AddManualOfferingDialog
        sectionId={sectionId}
        sectionName={sectionName}
        gradeLevelId={gradeLevelId}
        gradeLevelName={gradeLevelName}
        schoolYearId={schoolYearId}
        curriculums={curriculums}
        availableStrands={availableStrands}
        gradingSystemType={gradingSystemType}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
