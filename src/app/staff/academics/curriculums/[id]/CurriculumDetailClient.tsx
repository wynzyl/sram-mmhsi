"use client";

import { useState } from "react";
import { SubjectsByGradeLevel } from "@/features/academics/curriculums/components/SubjectsByGradeLevel";
import { SubjectFormDialog } from "@/features/academics/curriculums/components/SubjectFormDialog";
import { PublishCurriculumDialog } from "@/features/academics/curriculums/components/PublishCurriculumDialog";
import { ArchiveCurriculumDialog } from "@/features/academics/curriculums/components/ArchiveCurriculumDialog";
import type { CurriculumDetail, SubjectListRow, SubjectStrandAssociation } from "@/features/academics/curriculums/curriculums.types";
import type { PreflightResult } from "@/features/academics/curriculums/curriculum-preflight";
import { getSubjectStrandsAction } from "@/features/academics/curriculums/subjects.actions";

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

interface StrandOption {
  id: string;
  code: string;
  shortCode: string;
  name: string;
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
  /** Available strands for SHS elective subjects */
  availableStrands?: StrandOption[];
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
  availableStrands = [],
}: CurriculumDetailClientProps) {
  const [dialogState, setDialogState] = useState<{
    mode: "add" | "edit";
    gradeLevelId?: string;
    subject?: SubjectListRow;
  } | null>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // Track strand associations for the subject being edited
  const [editStrandAssociations, setEditStrandAssociations] = useState<SubjectStrandAssociation[]>([]);
  const [loadingStrands, setLoadingStrands] = useState(false);

  const handleAddSubject = (gradeLevelId: string) => {
    setEditStrandAssociations([]);
    setDialogState({ mode: "add", gradeLevelId: gradeLevelId || undefined });
  };

  // Strand associations are fetched here (event handler) rather than in an effect:
  // opening the edit dialog is a user event, so the fetch belongs with the event.
  const handleEditSubject = (subject: SubjectListRow) => {
    setEditStrandAssociations([]);
    setDialogState({ mode: "edit", subject });

    // Core subjects have no strand associations to load.
    if (subject.isCore) return;

    setLoadingStrands(true);
    getSubjectStrandsAction(subject.id)
      .then((associations) => {
        setEditStrandAssociations(associations);
      })
      .catch(() => {
        setEditStrandAssociations([]);
      })
      .finally(() => {
        setLoadingStrands(false);
      });
  };

  const handleCloseDialog = () => {
    setDialogState(null);
    setEditStrandAssociations([]);
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

      {dialogState && !loadingStrands && (
        <SubjectFormDialog
          mode={dialogState.mode}
          curriculumId={curriculum.id}
          gradeLevels={gradeLevels}
          subject={dialogState.subject}
          defaultGradeLevelId={dialogState.gradeLevelId}
          onClose={handleCloseDialog}
          availableStrands={availableStrands}
          existingStrandAssociations={editStrandAssociations}
        />
      )}

      {/* Loading state while fetching strand associations */}
      {dialogState && loadingStrands && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading subject data...</p>
          </div>
        </div>
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
            className="px-4 py-2 text-sm font-medium text-success-foreground bg-success rounded-md shadow-lg hover:bg-success flex items-center gap-2"
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
