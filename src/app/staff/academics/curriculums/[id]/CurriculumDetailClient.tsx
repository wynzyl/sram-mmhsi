"use client";

import { useState } from "react";
import { SubjectsByGradeLevel } from "@/features/academics/curriculums/components/SubjectsByGradeLevel";
import { SubjectFormDialog } from "@/features/academics/curriculums/components/SubjectFormDialog";
import { PublishCurriculumDialog } from "@/features/academics/curriculums/components/PublishCurriculumDialog";
import { ArchiveCurriculumDialog } from "@/features/academics/curriculums/components/ArchiveCurriculumDialog";
import type { CurriculumDetail, SubjectListRow } from "@/features/academics/curriculums/curriculums.types";
import type { PreflightResult } from "@/features/academics/curriculums/curriculum-preflight";

interface GradeLevelGroup {
  gradeLevelId: string;
  gradeLevelName: string;
  subjects: SubjectListRow[];
}

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SchoolYear {
  id: string;
  label: string;
}

interface CurriculumDetailClientProps {
  curriculum: CurriculumDetail;
  groups: GradeLevelGroup[];
  gradeLevels: GradeLevelOption[];
  canManageSubjects: boolean;
  canPublish?: boolean;
  canArchive?: boolean;
  preflight?: PreflightResult;
  activeSchoolYear?: SchoolYear | null;
}

export function CurriculumDetailClient({
  curriculum,
  groups,
  gradeLevels,
  canManageSubjects,
  canPublish,
  canArchive,
  preflight,
  activeSchoolYear,
}: CurriculumDetailClientProps) {
  const [dialogState, setDialogState] = useState<{
    mode: "add" | "edit";
    gradeLevelId?: string;
    subject?: SubjectListRow;
  } | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

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

      {showPublishDialog && preflight && (
        <PublishCurriculumDialog
          curriculumId={curriculum.id}
          curriculumName={curriculum.name}
          preflight={preflight}
          gradeLevels={gradeLevels}
          activeSchoolYear={activeSchoolYear ?? null}
          onClose={() => setShowPublishDialog(false)}
        />
      )}

      {showArchiveDialog && (
        <ArchiveCurriculumDialog
          curriculumId={curriculum.id}
          curriculumName={curriculum.name}
          onClose={() => setShowArchiveDialog(false)}
        />
      )}

      {/* Publish button - rendered here so it can trigger the dialog */}
      {curriculum.status === "draft" && canPublish && preflight && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            type="button"
            onClick={() => setShowPublishDialog(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md shadow-lg hover:bg-emerald-700 flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Publish Curriculum
          </button>
        </div>
      )}

      {/* Archive button - rendered here so it can trigger the confirmation dialog */}
      {curriculum.status === "published" && canArchive && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowArchiveDialog(true)}
            className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-destructive"
          >
            Archive Curriculum
          </button>
        </div>
      )}
    </>
  );
}
