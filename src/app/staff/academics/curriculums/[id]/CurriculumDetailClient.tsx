"use client";

import { useState } from "react";
import { SubjectsByGradeLevel } from "@/features/academics/curriculums/components/SubjectsByGradeLevel";
import { SubjectFormDialog } from "@/features/academics/curriculums/components/SubjectFormDialog";
import type { CurriculumDetail, SubjectListRow } from "@/features/academics/curriculums/curriculums.types";

interface GradeLevelGroup {
  gradeLevelId: string;
  gradeLevelName: string;
  subjects: SubjectListRow[];
}

interface GradeLevelOption {
  id: string;
  name: string;
}

interface CurriculumDetailClientProps {
  curriculum: CurriculumDetail;
  groups: GradeLevelGroup[];
  gradeLevels: GradeLevelOption[];
  canManageSubjects: boolean;
}

export function CurriculumDetailClient({
  curriculum,
  groups,
  gradeLevels,
  canManageSubjects,
}: CurriculumDetailClientProps) {
  const [dialogState, setDialogState] = useState<{
    mode: "add" | "edit";
    gradeLevelId?: string;
    subject?: SubjectListRow;
  } | null>(null);

  const handleAddSubject = (gradeLevelId: string) => {
    setDialogState({ mode: "add", gradeLevelId: gradeLevelId || undefined });
  };

  const handleEditSubject = (subject: SubjectListRow) => {
    setDialogState({ mode: "edit", subject });
  };

  const handleCloseDialog = () => {
    setDialogState(null);
  };

  return (
    <>
      <SubjectsByGradeLevel
        groups={groups}
        curriculumStatus={curriculum.status}
        curriculumId={curriculum.id}
        availableGradeLevels={canManageSubjects ? gradeLevels : undefined}
        onAddSubject={canManageSubjects ? handleAddSubject : undefined}
        onEditSubject={canManageSubjects ? handleEditSubject : undefined}
      />

      {dialogState && (
        <SubjectFormDialog
          mode={dialogState.mode}
          curriculumId={curriculum.id}
          gradeLevels={gradeLevels}
          subject={dialogState.subject}
          defaultGradeLevelId={dialogState.gradeLevelId}
          onClose={handleCloseDialog}
        />
      )}
    </>
  );
}
