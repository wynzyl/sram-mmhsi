"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { StudentInSection } from "../sections.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";

interface SectionStudentsTableProps {
  students: StudentInSection[];
}

/**
 * Table showing enrolled students in a section.
 * Used in section detail page and grade entry screens.
 */
export default function SectionStudentsTable({
  students,
}: SectionStudentsTableProps) {
  const columns = useMemo<ColumnDef<StudentInSection>[]>(
    () => [
      {
        header: "Ref. No.",
        accessorKey: "studentRef",
        cell: ({ row }) => (
          <Link
            href={`/staff/students/${row.original.studentId}`}
            className="font-mono text-sm text-primary hover:underline"
          >
            {row.original.studentRef}
          </Link>
        ),
      },
      {
        header: "Last Name",
        accessorKey: "lastName",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.lastName}</span>
        ),
      },
      {
        header: "First Name",
        accessorKey: "firstName",
        cell: ({ row }) => <span>{row.original.firstName}</span>,
      },
      {
        header: "Middle Name",
        accessorKey: "middleName",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.middleName || "—"}
          </span>
        ),
      },
      {
        header: "Suffix",
        accessorKey: "suffix",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.suffix || "—"}
          </span>
        ),
      },
      {
        header: "Status",
        accessorKey: "enrollmentStatus",
        cell: ({ row }) => (
          <Badge variant="success">{row.original.enrollmentStatus}</Badge>
        ),
      },
    ],
    []
  );

  return (
    <div>
      {students.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No enrolled students in this section
          </div>
          <p className="text-sm text-muted-foreground">
            Students will appear here once they are enrolled in this section.
          </p>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={students}
          searchable
          searchPlaceholder="Search students..."
        />
      )}
    </div>
  );
}
