"use client";

import { useState, useMemo, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { removeTeacherAssignmentAction } from "../teacher-assignments.actions";
import type { TeacherAssignmentListItem } from "@/features/academics/grades/grades.queries";
import type { TeacherOption } from "@/features/academics/advisers/advisers.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
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
  gradeLevelName: string;
}

interface SectionOption {
  id: string;
  name: string;
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
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRemove = useCallback(
    (assignment: TeacherAssignmentListItem) => {
      startTransition(async () => {
        const formData = new FormData();
        formData.append("id", assignment.id);
        const result = await removeTeacherAssignmentAction({}, formData);
        if (result.success) {
          toast.success(result.message);
          router.refresh();
        } else {
          toast.error(result.message || "Failed to remove assignment");
        }
        setRemovingId(null);
      });
    },
    [router]
  );

  // Transform data for AssignTeacherForm
  const teacherOptions = teachers.map((t) => ({
    id: t.id,
    username: t.name,
    email: t.email,
  }));

  const subjectOptions = subjects.map((s) => ({
    id: s.id,
    name: `${s.name} (${s.gradeLevelName})`,
    code: s.code,
  }));

  const sectionOptions = sections.map((s) => ({
    id: s.id,
    name: `${s.name} - ${s.gradeLevelName}`,
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
        header: "Section",
        accessorKey: "sectionName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.sectionName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.gradeLevelName}
            </div>
          </div>
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

          if (removingId === assignment.id) {
            return (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Remove?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemove(assignment)}
                  loading={isPending}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRemovingId(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setRemovingId(assignment.id)}
            >
              Remove
            </Button>
          );
        },
      },
    ],
    [removingId, isPending, handleRemove]
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="relative z-10 w-full max-w-2xl mx-4">
            <div className="bg-white rounded-xl shadow-lg">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">Assign Teacher to Subject</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4">
                <AssignTeacherForm
                  teachers={teacherOptions}
                  subjects={subjectOptions}
                  sections={sectionOptions}
                  schoolYears={schoolYears}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
