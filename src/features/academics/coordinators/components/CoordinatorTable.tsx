"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { removeCoordinatorAction } from "../coordinators.actions";
import type { CoordinatorView, CoordinatorUserOption } from "../coordinators.schema";
import type { GradeGroup } from "@/lib/constants/grade-groups";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import CoordinatorAssignmentForm from "./CoordinatorAssignmentForm";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface CoordinatorTableProps {
  coordinators: CoordinatorView[];
  availableCoordinators: CoordinatorUserOption[];
  schoolYears: SchoolYearOption[];
}

export default function CoordinatorTable({
  coordinators,
  availableCoordinators,
  schoolYears,
}: CoordinatorTableProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async (coordinator: CoordinatorView) => {
    setRemoving(true);
    try {
      const formData = new FormData();
      formData.append("id", coordinator.id);
      const result = await removeCoordinatorAction({}, formData);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to remove coordinator");
      }
    } finally {
      setRemoving(false);
      setRemovingId(null);
    }
  };

  // Get assigned grade groups for the active school year
  const activeSchoolYear = schoolYears.find((sy) => sy.isActive);
  const assignedGroups = coordinators
    .filter((c) => c.schoolYearId === activeSchoolYear?.id)
    .map((c) => c.gradeGroup as GradeGroup);

  const columns = useMemo<ColumnDef<CoordinatorView>[]>(
    () => [
      {
        header: "Grade Group",
        accessorKey: "gradeGroupLabel",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.gradeGroupLabel}</div>
        ),
      },
      {
        header: "Coordinator",
        accessorKey: "userName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.userName}</div>
            <div className="text-helper">
              {row.original.userEmail}
            </div>
          </div>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        cell: ({ row }) => (
          <div className="flex-row-2">
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
          <span className="text-secondary">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => {
          const coordinator = row.original;

          if (removingId === coordinator.id) {
            return (
              <div className="flex gap-2 items-center">
                <span className="text-helper">Remove?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleRemove(coordinator)}
                  loading={removing}
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
              onClick={() => setRemovingId(coordinator.id)}
            >
              Remove
            </Button>
          );
        },
      },
    ],
    [removingId, removing]
  );

  return (
    <div>
      {/* Header with Create button */}
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h2 className="text-lg font-semibold">Coordinators</h2>
          <p className="text-secondary">
            Assign coordinators to review grade sheet submissions for each grade group
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Assign Coordinator
        </Button>
      </div>

      {coordinators.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No coordinator assignments found
          </div>
          <p className="text-secondary">
            Assign coordinators to review grade submissions for their grade groups.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={coordinators} searchable />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CoordinatorAssignmentForm
          coordinators={availableCoordinators}
          schoolYears={schoolYears}
          assignedGroups={assignedGroups}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
