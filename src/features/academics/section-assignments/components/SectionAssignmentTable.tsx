"use client";

import { useState, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type {
  StudentForSectionAssignment,
  SectionWithCount,
} from "../section-assignments.schema";
import { AssignSectionModal } from "./AssignSectionModal";
import { RemoveFromSectionButton } from "./RemoveFromSectionButton";

interface SectionAssignmentTableProps {
  students: StudentForSectionAssignment[];
  sections: SectionWithCount[];
  schoolYears: { id: string; label: string; isActive: boolean }[];
  gradeLevels: { id: string; name: string; order: number }[];
  initialSchoolYearId: string;
  initialGradeLevelId?: string;
  initialSectionStatus?: string;
}

export function SectionAssignmentTable({
  students,
  sections,
  schoolYears,
  gradeLevels,
  initialSchoolYearId,
  initialGradeLevelId,
  initialSectionStatus = "all",
}: SectionAssignmentTableProps) {
  const router = useRouter();

  // Filters state
  const [schoolYearId, setSchoolYearId] = useState(initialSchoolYearId);
  const [gradeLevelId, setGradeLevelId] = useState(initialGradeLevelId ?? "all");
  const [sectionStatus, setSectionStatus] = useState(initialSectionStatus);
  const [filterInput, setFilterInput] = useState("");
  const debouncedFilter = useDebounce(filterInput, 300);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Build URL for filter changes
  const buildFilterUrl = useCallback(
    (params: {
      schoolYearId?: string;
      gradeLevelId?: string;
      sectionStatus?: string;
    }) => {
      const searchParams = new URLSearchParams();
      const sy = params.schoolYearId ?? schoolYearId;
      const gl = params.gradeLevelId ?? gradeLevelId;
      const ss = params.sectionStatus ?? sectionStatus;

      searchParams.set("schoolYearId", sy);
      if (gl !== "all") searchParams.set("gradeLevelId", gl);
      if (ss !== "all") searchParams.set("sectionStatus", ss);

      return `/staff/academics/section-assignments?${searchParams.toString()}`;
    },
    [schoolYearId, gradeLevelId, sectionStatus]
  );

  // Handle filter changes
  const handleSchoolYearChange = (value: string) => {
    setSchoolYearId(value);
    setRowSelection({});
    router.push(buildFilterUrl({ schoolYearId: value }));
  };

  const handleGradeLevelChange = (value: string) => {
    setGradeLevelId(value);
    setRowSelection({});
    router.push(buildFilterUrl({ gradeLevelId: value }));
  };

  const handleSectionStatusChange = (value: string) => {
    setSectionStatus(value);
    setRowSelection({});
    router.push(buildFilterUrl({ sectionStatus: value }));
  };

  // Get sections for current grade level (for filter dropdown)
  const sectionsForGradeLevel = useMemo(() => {
    if (gradeLevelId === "all") return sections;
    return sections.filter((s) => s.gradeLevelId === gradeLevelId);
  }, [sections, gradeLevelId]);

  // Get selected students
  const selectedStudents = useMemo(() => {
    const selectedIndices = Object.keys(rowSelection).filter(
      (key) => rowSelection[key]
    );
    return selectedIndices
      .map((index) => students[parseInt(index, 10)])
      .filter((s): s is StudentForSectionAssignment => s !== undefined);
  }, [rowSelection, students]);

  // Check if all selected students have the same grade level
  const selectedGradeLevelId = useMemo(() => {
    if (selectedStudents.length === 0) return null;
    const gradeLevelIds = new Set(selectedStudents.map((s) => s.gradeLevelId));
    if (gradeLevelIds.size === 1) {
      return selectedStudents[0].gradeLevelId;
    }
    return null;
  }, [selectedStudents]);

  // Get available sections for selected students' grade level
  const availableSectionsForAssignment = useMemo(() => {
    if (!selectedGradeLevelId) return [];
    return sections.filter((s) => s.gradeLevelId === selectedGradeLevelId);
  }, [sections, selectedGradeLevelId]);

  // Column definitions
  const columns = useMemo<ColumnDef<StudentForSectionAssignment>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        size: 40,
      },
      {
        accessorKey: "studentRef",
        header: "Ref No.",
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.studentRef}</span>
        ),
        size: 100,
      },
      {
        id: "name",
        header: "Student Name",
        accessorFn: (row) =>
          `${row.lastName}, ${row.firstName}${row.middleName ? ` ${row.middleName.charAt(0)}.` : ""}${row.suffix ? ` ${row.suffix}` : ""}`,
        cell: ({ row }) => {
          const { firstName, lastName, middleName, suffix } = row.original;
          return (
            <span>
              {lastName}, {firstName}
              {middleName ? ` ${middleName.charAt(0)}.` : ""}
              {suffix ? ` ${suffix}` : ""}
            </span>
          );
        },
      },
      {
        accessorKey: "gradeLevelName",
        header: "Grade Level",
        cell: ({ row }) => row.original.gradeLevelName,
        size: 120,
      },
      {
        accessorKey: "sectionName",
        header: "Section",
        cell: ({ row }) =>
          row.original.sectionName ? (
            <Badge variant="secondary">{row.original.sectionName}</Badge>
          ) : (
            <span className="text-muted-foreground italic">Unassigned</span>
          ),
        size: 120,
      },
      {
        accessorKey: "enrollmentStatus",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.enrollmentStatus;
          return (
            <Badge
              variant={status === "enrolled" ? "success" : "secondary"}
              className="capitalize"
            >
              {status}
            </Badge>
          );
        },
        size: 100,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.sectionId ? (
            <RemoveFromSectionButton
              enrollmentId={row.original.enrollmentId}
              studentName={`${row.original.firstName} ${row.original.lastName}`}
            />
          ) : null,
        size: 80,
      },
    ],
    []
  );

  // Table instance
  const table = useReactTable({
    data: students,
    columns,
    state: {
      sorting,
      globalFilter: debouncedFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  const { rows } = table.getRowModel();

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* School Year */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">
            School Year:
          </label>
          <Select value={schoolYearId} onValueChange={handleSchoolYearChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((sy) => (
                <SelectItem key={sy.id} value={sy.id}>
                  {sy.label} {sy.isActive && "(Active)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Grade Level */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">
            Grade Level:
          </label>
          <Select value={gradeLevelId} onValueChange={handleGradeLevelChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {gradeLevels.map((gl) => (
                <SelectItem key={gl.id} value={gl.id}>
                  {gl.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Section Status */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">
            Section:
          </label>
          <Select value={sectionStatus} onValueChange={handleSectionStatusChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unassigned">Unassigned Only</SelectItem>
              {sectionsForGradeLevel.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name} ({section.studentCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <Input
            type="search"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder="Search students..."
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Selection actions */}
      {selectedStudents.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedStudents.length} student{selectedStudents.length > 1 ? "s" : ""}{" "}
            selected
          </span>

          {selectedGradeLevelId ? (
            <Button
              size="sm"
              onClick={() => setIsAssignModalOpen(true)}
              disabled={availableSectionsForAssignment.length === 0}
            >
              Assign to Section
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              Select students from the same grade level to assign
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRowSelection({})}
            className="ml-auto"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={cn(
                        "px-5 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted",
                        header.column.getCanSort() &&
                          "cursor-pointer select-none hover:bg-muted/80 transition-colors"
                      )}
                      style={{ width: header.getSize() }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {header.isPlaceholder ? null : (
                        <div className="flex items-center gap-2">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getIsSorted() === "asc" && (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                          {header.column.getIsSorted() === "desc" && (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No students found matching the current filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 hover:bg-muted transition-colors",
                      row.getIsSelected() && "bg-primary/5"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-5 py-4 text-sm text-foreground"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * 25 + 1} -{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 25,
              students.length
            )}{" "}
            of {students.length} students
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      <AssignSectionModal
        open={isAssignModalOpen}
        onOpenChange={setIsAssignModalOpen}
        selectedStudents={selectedStudents}
        sections={availableSectionsForAssignment}
        onSuccess={() => {
          setRowSelection({});
          router.refresh();
        }}
      />
    </div>
  );
}
