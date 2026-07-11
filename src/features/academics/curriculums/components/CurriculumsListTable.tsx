"use client";

import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import type { CurriculumListRow } from "../curriculums.types";
import { CurriculumStatusBadge } from "./CurriculumStatusBadge";

interface CurriculumsListTableProps {
  data: CurriculumListRow[];
  onClone?: (id: string) => void;
}

const columnHelper = createColumnHelper<CurriculumListRow>();

export function CurriculumsListTable({ data, onClone }: CurriculumsListTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: "Name",
        cell: (info) => (
          <Link
            href={`/staff/academics/curriculums/${info.row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: (info) => <CurriculumStatusBadge status={info.getValue()} />,
      }),
      columnHelper.accessor("version", {
        header: "Version",
        cell: (info) => (
          <span className="font-mono text-sm text-muted-foreground">
            v{info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor("subjectCount", {
        header: "Subjects",
        cell: (info) => (
          <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("adoptionCount", {
        header: "Adoptions",
        cell: (info) => (
          <span className="text-sm tabular-nums">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("publishedAt", {
        header: "Published",
        cell: (info) => {
          const date = info.getValue();
          return date ? (
            <span className="text-sm text-muted-foreground">
              {formatDate(date)}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground/50">—</span>
          );
        },
      }),
      columnHelper.accessor("createdAt", {
        header: "Created",
        cell: (info) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(info.getValue())}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          const canClone = row.status === "published" || row.status === "archived";
          return (
            <div className="flex items-center gap-2 justify-end">
              <Link
                href={`/staff/academics/curriculums/${row.id}`}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                View
              </Link>
              {canClone && onClone && (
                <button
                  type="button"
                  onClick={() => onClone(row.id)}
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Clone
                </button>
              )}
            </div>
          );
        },
      }),
    ],
    [onClone]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search curriculums..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full max-w-xs px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                      header.column.getCanSort() && "cursor-pointer select-none"
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() && (
                        <span className="text-primary">
                          {header.column.getIsSorted() === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No curriculums found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
