"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { removeTeacherAssignmentAction } from "../teacher-assignments.actions";
import type { TeacherAssignmentListItem } from "@/features/academics/grades/grades.queries";
import type { TeacherOption } from "@/features/academics/advisers/advisers.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import AssignTeacherForm from "@/features/academics/components/AssignTeacherForm";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
  gradeLevelId: string;
  gradeLevelName: string;
}

interface SectionOption {
  id: string;
  name: string;
  gradeLevelId: string;
  gradeLevelName: string;
}

interface TeacherAssignmentsTableProps {
  assignments: TeacherAssignmentListItem[];
  teachers: TeacherOption[];
  subjects: SubjectOption[];
  sections: SectionOption[];
  schoolYears: SchoolYearOption[];
}

export function TeacherAssignmentsTable({
  assignments,
  teachers,
  subjects,
  sections,
  schoolYears,
}: TeacherAssignmentsTableProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Transform data for AssignTeacherForm
  const teacherOptions = teachers.map((t) => ({
    id: t.id,
    username: t.name,
    email: t.email,
  }));

  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    gradeLevelId: s.gradeLevelId,
  }));

  const sectionOptions = sections.map((s) => ({
    id: s.id,
    name: `${s.gradeLevelName} - ${s.name}`,
    gradeLevelId: s.gradeLevelId,
  }));

  const columns = useMemo<ColumnDef<TeacherAssignmentListItem>[]>(
    () => [
      {
        header: "Teacher",
        accessorKey: "teacherName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.teacherName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.teacherEmail}
            </div>
          </div>
        ),
      },
      {
        header: "Subject",
        accessorKey: "subjectName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.subjectName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.subjectCode}
            </div>
          </div>
        ),
      },
      {
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.gradeLevelName}</span>
        ),
      },
      {
        header: "Section",
        accessorKey: "sectionName",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.sectionName}</span>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm">{row.original.schoolYearLabel}</span>
            {row.original.isActiveYear && (
              <Badge variant="success" className="text-xs">
                Active
              </Badge>
            )}
          </div>
        ),
      },
      {
        header: "Assigned",
        accessorKey: "createdAt",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const assignment = row.original;

          return (
            <InlineConfirmButton
              action={removeTeacherAssignmentAction}
              confirmMessage={`Remove ${assignment.teacherName} from ${assignment.subjectName} (${assignment.sectionName})?`}
              hiddenFields={{ id: assignment.id }}
              label="Remove"
              loadingLabel="Removing..."
              variant="danger"
              onSuccess={() => router.refresh()}
              dialogTitle="Remove Assignment"
            />
          );
        },
      },
    ],
    [router]
  );

  return (
    <div>
      {/* Header with Create button */}
      <div className="flex justify-between items-center mb-4 px-4 pt-4">
        <div>
          <h2 className="text-lg font-semibold">Teacher Subject Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign teachers to subjects and sections for grade encoding
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Assign Teacher
        </Button>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No teacher assignments found
          </div>
          <p className="text-sm text-muted-foreground">
            Assign teachers to subjects and sections so they can encode grades.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={assignments} searchable />
      )}

      {/* Create Modal - extracted to Dialog component */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Teacher to Subject</DialogTitle>
          </DialogHeader>
          <AssignTeacherForm
            teachers={teacherOptions}
            subjects={subjectOptions}
            sections={sectionOptions}
            schoolYears={schoolYears}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
