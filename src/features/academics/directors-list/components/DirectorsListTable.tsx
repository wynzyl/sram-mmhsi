"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { DirectorsListBadge, DirectorsListIndicator } from "./DirectorsListBadge";
import type { DirectorsListEntry } from "../directors-list.schema";

interface DirectorsListTableProps {
  entries: DirectorsListEntry[];
  className?: string;
}

/**
 * Table component for displaying Director's List entries.
 * Shows rank, student info, section, GWA, and honor badge.
 */
export function DirectorsListTable({
  entries,
  className,
}: DirectorsListTableProps) {
  const columns = useMemo<ColumnDef<DirectorsListEntry>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "Rank",
        size: 80,
        cell: ({ row }) => (
          <DirectorsListIndicator
            rank={row.original.rank}
            gwa={row.original.gwa}
          />
        ),
      },
      {
        accessorKey: "studentRef",
        header: "Student ID",
        size: 120,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.studentRef}</span>
        ),
      },
      {
        accessorKey: "studentName",
        header: "Student Name",
        size: 200,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{row.original.studentName}</span>
            <DirectorsListBadge
              gwa={row.original.gwa}
              gradeGroup={row.original.gradeGroup}
              size="sm"
            />
          </div>
        ),
      },
      {
        accessorKey: "gradeLevelName",
        header: "Grade Level",
        size: 130,
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        size: 100,
      },
      {
        accessorKey: "gwa",
        header: "GWA",
        size: 80,
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-primary">
            {row.original.gwa.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: "subjectCount",
        header: "Subjects",
        size: 80,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.subjectCount}
          </span>
        ),
      },
      {
        accessorKey: "threshold",
        header: "Threshold",
        size: 90,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.threshold}+
          </span>
        ),
      },
    ],
    []
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-foreground">
          No qualifying students
        </h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          No students have met the Director&apos;s List GWA threshold for the selected
          filters. This may be because grades haven&apos;t been published yet.
        </p>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={entries}
      searchable
      searchPlaceholder="Search by name or student ID..."
      pageSize={25}
      className={className}
    />
  );
}

/**
 * Compact version of the table for dashboard widgets.
 */
export function DirectorsListCompactTable({
  entries,
  className,
}: DirectorsListTableProps) {
  const columns = useMemo<ColumnDef<DirectorsListEntry>[]>(
    () => [
      {
        accessorKey: "rank",
        header: "#",
        size: 40,
        cell: ({ row }) => (
          <span className="font-semibold text-primary">
            #{row.original.rank}
          </span>
        ),
      },
      {
        accessorKey: "studentName",
        header: "Student",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-sm">{row.original.studentName}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.gradeLevelName} - {row.original.sectionName}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "gwa",
        header: "GWA",
        size: 60,
        cell: ({ row }) => (
          <span className="font-bold tabular-nums text-primary">
            {row.original.gwa.toFixed(2)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      data={entries}
      enablePagination={false}
      className={className}
    />
  );
}
