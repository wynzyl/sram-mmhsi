"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { deleteSectionAction } from "../sections.actions";
import type { SectionView } from "../sections.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import SectionFormModal from "./SectionFormModal";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface SectionsTableProps {
  sections: SectionView[];
  gradeLevels: GradeLevelOption[];
  schoolYears: SchoolYearOption[];
}

export default function SectionsTable({
  sections,
  gradeLevels,
  schoolYears,
}: SectionsTableProps) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<SectionView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (section: SectionView) => {
    setDeleting(true);
    try {
      const result = await deleteSectionAction(section.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  const canDelete = (section: SectionView) => {
    return section.enrollmentCount === 0 && section.assignmentCount === 0;
  };

  const columns = useMemo<ColumnDef<SectionView>[]>(
    () => [
      {
        header: "Section Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.gradeLevelName}</span>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="text-sm">{row.original.schoolYearLabel}</span>
            {row.original.isActiveYear && (
              <Badge variant="success" className="text-xs">Active</Badge>
            )}
          </div>
        ),
      },
      {
        header: "Enrollments",
        accessorKey: "enrollmentCount",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.enrollmentCount}
          </Badge>
        ),
      },
      {
        header: "Assignments",
        accessorKey: "assignmentCount",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.assignmentCount}
          </Badge>
        ),
      },
      {
        header: "Created",
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
          const section = row.original;

          if (deletingId === section.id) {
            return (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground">Delete?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(section)}
                  loading={deleting}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingId(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSection(section)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeletingId(section.id)}
                disabled={!canDelete(section)}
                title={
                  !canDelete(section)
                    ? "Cannot delete section with enrollments or assignments"
                    : undefined
                }
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, deleting]
  );

  return (
    <div>
      {/* Header with Create button */}
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h2 className="text-lg font-semibold">Sections</h2>
          <p className="text-sm text-muted-foreground">
            Manage classroom sections for each grade level and school year
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Add Section
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No sections configured
          </div>
          <p className="text-sm text-muted-foreground">
            Create sections to organize students within each grade level.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={sections} searchable />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <SectionFormModal
          gradeLevels={gradeLevels}
          schoolYears={schoolYears}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingSection && (
        <SectionFormModal
          section={editingSection}
          gradeLevels={gradeLevels}
          schoolYears={schoolYears}
          onClose={() => setEditingSection(null)}
        />
      )}
    </div>
  );
}
