"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { SpedBadge } from "@/components/shared/SpedBadge";
import type { ColumnDef } from "@tanstack/react-table";
import type { StudentListRow } from "../student-list-report.queries";

interface StudentListTableProps {
  data: StudentListRow[];
}

export function StudentListTable({ data }: StudentListTableProps) {
  const columns = useMemo<ColumnDef<StudentListRow>[]>(
    () => [
      {
        header: "Student Name",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <span className="flex items-center">
            <Link
              href={`/staff/students/${row.original.studentId}`}
              className="text-primary hover:underline font-medium"
            >
              {row.original.studentName}
            </Link>
            <SpedBadge isSped={row.original.isSpecialEducation} />
          </span>
        ),
      },
      {
        header: "Student ID",
        accessorKey: "studentRef",
        cell: ({ row }) => (
          <ReferenceCode code={row.original.studentRef} />
        ),
      },
      {
        header: "Grade",
        accessorKey: "gradeLevel",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {row.original.gradeLevel}
          </span>
        ),
      },
      {
        header: "Address",
        accessorKey: "address",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground block max-w-[220px] truncate">
            {row.original.address || "—"}
          </span>
        ),
      },
      {
        header: "Guardian Name",
        accessorKey: "guardianName",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.guardianName || "—"}</span>
        ),
      },
      {
        header: "Contact No.",
        accessorKey: "guardianContact",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">
            {row.original.guardianContact || "—"}
          </span>
        ),
      },
      {
        header: "Email",
        accessorKey: "guardianEmail",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.guardianEmail || "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchPlaceholder="Search by student, guardian, email..."
      pageSize={20}
    />
  );
}
