"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { SpedBadge } from "@/components/shared/SpedBadge";
import { formatDate } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/name";
import type { ArchivedStudentRow } from "../archive.queries";

function formatStudentName(row: ArchivedStudentRow): string {
  const parts = [row.lastName, row.firstName];
  if (row.middleName) {
    parts.push(row.middleName.charAt(0) + ".");
  }
  if (row.suffix) {
    parts.push(row.suffix);
  }
  return parts.join(", ");
}

export function ArchiveDirectoryTable({
  rows,
}: {
  rows: ArchivedStudentRow[];
}) {
  const columns = useMemo<ColumnDef<ArchivedStudentRow>[]>(
    () => [
      {
        header: "Student",
        id: "student",
        accessorFn: (row) => `${row.lastName}, ${row.firstName}`,
        cell: ({ row }) => {
          const data = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {getInitials(`${data.firstName} ${data.lastName}`)}
              </div>
              <div>
                <span className="flex items-center">
                  <Link
                    href={`/staff/archive/${data.id}`}
                    prefetch={false}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {formatStudentName(data)}
                  </Link>
                  <SpedBadge isSped={data.isSpecialEducation} />
                </span>
                {data.lastEnrollmentSchoolYear && (
                  <p className="text-xs text-muted-foreground">
                    {data.lastEnrollmentSchoolYear}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: "Student ID",
        id: "referenceNumber",
        accessorKey: "referenceNumber",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.referenceNumber}</span>
        ),
      },
      {
        header: "Status",
        id: "status",
        accessorKey: "status",
        cell: ({ row }) => (
          <StatusBadge status={row.original.status} type="studentArchive" />
        ),
      },
      {
        header: "Last Grade",
        id: "lastGrade",
        accessorKey: "lastEnrollmentGradeLevel",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.lastEnrollmentGradeLevel ?? "—"}
          </span>
        ),
      },
      {
        header: "Archived",
        id: "archivedAt",
        accessorKey: "archivedAt",
        cell: ({ row }) => {
          const data = row.original;
          if (!data.archivedAt) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div>
              <span className="text-sm">{formatDate(data.archivedAt)}</span>
              {data.archivedSchoolYearLabel && (
                <p className="text-xs text-muted-foreground">
                  SY: {data.archivedSchoolYearLabel}
                </p>
              )}
            </div>
          );
        },
      },
      {
        header: "Balance",
        id: "balance",
        accessorFn: (row) => parseFloat(row.outstandingBalance),
        cell: ({ row }) => {
          const balance = parseFloat(row.original.outstandingBalance);
          if (balance > 0) {
            return (
              <span className="font-medium text-destructive">
                <CurrencyDisplay amount={balance} />
              </span>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
      {
        header: "Actions",
        id: "actions",
        cell: ({ row }) => (
          <Link
            href={`/staff/archive/${row.original.id}`}
            prefetch={false}
            className="text-sm text-primary hover:underline"
          >
            View
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable={false}
      enablePagination={false}
    />
  );
}
