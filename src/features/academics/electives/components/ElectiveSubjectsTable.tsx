"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import type { ElectiveSubjectView } from "../electives.schema";
import { SHS_STRAND_SHORT_LABELS, type ShsStrandCode } from "@/lib/constants/strands";

interface ElectiveSubjectsTableProps {
  subjects: ElectiveSubjectView[];
}

export function ElectiveSubjectsTable({ subjects }: ElectiveSubjectsTableProps) {
  const columns = useMemo<ColumnDef<ElectiveSubjectView>[]>(
    () => [
      {
        header: "Code",
        accessorKey: "code",
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.code}</span>
        ),
      },
      {
        header: "Subject Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.gradeLevelName || "—"}
          </span>
        ),
      },
      {
        header: "Units",
        accessorKey: "units",
        cell: ({ row }) => (
          <span className="text-center">{row.original.units}</span>
        ),
      },
      {
        header: "Strands",
        accessorKey: "strands",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.strands.length === 0 ? (
              <span className="text-muted-foreground text-sm italic">All strands</span>
            ) : (
              row.original.strands.map((strand) => (
                <Badge
                  key={strand.strandId}
                  variant={strand.isStrandCore ? "info" : "secondary"}
                  className="text-xs"
                >
                  {SHS_STRAND_SHORT_LABELS[strand.strandCode as ShsStrandCode] || strand.strandCode}
                  {strand.isStrandCore && (
                    <span className="ml-1 opacity-70">*</span>
                  )}
                </Badge>
              ))
            )}
          </div>
        ),
        enableSorting: false,
      },
      {
        header: "Sections",
        accessorKey: "sectionOfferingCount",
        cell: ({ row }) => (
          <span className="text-center">{row.original.sectionOfferingCount}</span>
        ),
      },
      {
        header: "Students",
        accessorKey: "studentEnrollmentCount",
        cell: ({ row }) => (
          <span className="text-center">{row.original.studentEnrollmentCount}</span>
        ),
      },
    ],
    []
  );

  return (
    <div>
      {subjects.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">No elective subjects found.</p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={subjects}
          searchable
          searchPlaceholder="Search subjects..."
        />
      )}
      <div className="mt-2 text-xs text-muted-foreground">
        * = Required for strand (strand core subject)
      </div>
    </div>
  );
}
