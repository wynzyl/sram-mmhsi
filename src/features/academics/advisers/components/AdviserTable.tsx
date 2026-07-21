"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { removeAdviserAction } from "../advisers.actions";
import type { AdviserView, SectionOption, TeacherOption } from "../advisers.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import AdviserAssignmentForm from "./AdviserAssignmentForm";

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
}

interface AdviserTableProps {
  advisers: AdviserView[];
  sections: SectionOption[];
  teachers: TeacherOption[];
  schoolYears: SchoolYearOption[];
}

export default function AdviserTable({
  advisers,
  sections,
  teachers,
  schoolYears,
}: AdviserTableProps) {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const columns = useMemo<ColumnDef<AdviserView>[]>(
    () => [
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
        header: "Adviser",
        accessorKey: "userName",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.userName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.userEmail}
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
          const adviser = row.original;

          return (
            <InlineConfirmButton
              action={removeAdviserAction}
              confirmMessage={`Remove ${adviser.userName} as adviser from ${adviser.sectionName}?`}
              hiddenFields={{ id: adviser.id }}
              label="Remove"
              loadingLabel="Removing..."
              variant="danger"
              onSuccess={() => router.refresh()}
              dialogTitle="Remove Adviser"
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
      <div className="flex justify-between items-center mb-4 px-4">
        <div>
          <h2 className="text-lg font-semibold">Section Advisers</h2>
          <p className="text-sm text-muted-foreground">
            Assign homeroom advisers to sections for each school year
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          Assign Adviser
        </Button>
      </div>

      {advisers.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No adviser assignments found
          </div>
          <p className="text-sm text-muted-foreground">
            Assign teachers as homeroom advisers to manage section grades.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={advisers} searchable />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <AdviserAssignmentForm
          sections={sections}
          teachers={teachers}
          schoolYears={schoolYears}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
