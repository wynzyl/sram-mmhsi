"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DataTable } from "@/components/shared/DataTable";
import { ReferenceCode } from "@/components/shared/ReferenceCode";
import { TablePagination } from "@/components/ui/TablePagination";
import { useDebounce } from "@/hooks/useDebounce";
import type { ColumnDef } from "@tanstack/react-table";
import type { StudentListRow } from "../student-list-report.queries";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface GradeLevelOption {
  id: string;
  label: string;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

interface StudentListViewProps {
  data: StudentListRow[];
  schoolYears: SchoolYearOption[];
  gradeLevels: GradeLevelOption[];
  defaults: {
    schoolYearId: string;
    gradeLevelId?: string;
  };
  pagination: PaginationProps;
}

export function StudentListView({
  data,
  schoolYears,
  gradeLevels,
  defaults,
  pagination,
}: StudentListViewProps) {
  const router = useRouter();
  const [schoolYearId, setSchoolYearId] = useState(defaults.schoolYearId);
  const [gradeLevelId, setGradeLevelId] = useState(defaults.gradeLevelId ?? "");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Filter data client-side based on search
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return data;
    const term = debouncedSearch.toLowerCase();
    return data.filter(
      (row) =>
        row.studentName.toLowerCase().includes(term) ||
        row.studentRef.toLowerCase().includes(term) ||
        (row.guardianName?.toLowerCase().includes(term) ?? false) ||
        (row.guardianEmail?.toLowerCase().includes(term) ?? false)
    );
  }, [data, debouncedSearch]);

  const handleApply = () => {
    const params = new URLSearchParams();
    if (schoolYearId) params.set("schoolYearId", schoolYearId);
    if (gradeLevelId) params.set("gradeLevelId", gradeLevelId);
    const queryString = params.toString();
    router.push(queryString ? `?${queryString}` : "/staff/reports/student-list");
  };

  const handleReset = () => {
    setSchoolYearId(defaults.schoolYearId);
    setGradeLevelId("");
    setSearch("");
    router.push(`/staff/reports/student-list?schoolYearId=${defaults.schoolYearId}`);
  };

  const hasFilters = gradeLevelId !== "" || search !== "";

  // Build export URL with current filters
  const exportBaseUrl = "/staff/reports/student-list/export";
  const exportParams = new URLSearchParams();
  if (defaults.schoolYearId) exportParams.set("schoolYearId", defaults.schoolYearId);
  if (defaults.gradeLevelId) exportParams.set("gradeLevelId", defaults.gradeLevelId);

  // Build pagination base URL
  const paginationParams = new URLSearchParams();
  if (defaults.schoolYearId) paginationParams.set("schoolYearId", defaults.schoolYearId);
  if (defaults.gradeLevelId) paginationParams.set("gradeLevelId", defaults.gradeLevelId);
  const paginationBaseUrl = `/staff/reports/student-list?${paginationParams.toString()}`;

  const columns = useMemo<ColumnDef<StudentListRow>[]>(
    () => [
      {
        header: "Student Name",
        accessorKey: "studentName",
        cell: ({ row }) => (
          <Link
            href={`/staff/students/${row.original.studentId}`}
            className="text-primary hover:underline font-medium"
          >
            {row.original.studentName}
          </Link>
        ),
      },
      {
        header: "Student ID",
        accessorKey: "studentRef",
        cell: ({ row }) => <ReferenceCode code={row.original.studentRef} />,
      },
      {
        header: "Grade",
        accessorKey: "gradeLevel",
        cell: ({ row }) => (
          <span className="text-sm whitespace-nowrap">{row.original.gradeLevel}</span>
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
    []
  );

  return (
    <div className="flex flex-col">
      {/* Card Header with Filters */}
      <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Title + Badge */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Enrolled Students
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {pagination.totalCount} Student{pagination.totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Right: Search + Filters + Export */}
        <div className="filter-controls-inline">
          {/* Search */}
          <div className="filter-search w-48">
            <span className="filter-search-icon">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="filter-search-input"
              autoComplete="off"
            />
          </div>

          {/* School Year */}
          <select
            value={schoolYearId}
            onChange={(e) => setSchoolYearId(e.target.value)}
            className="filter-select w-28"
            aria-label="School year"
          >
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label}
              </option>
            ))}
          </select>

          {/* Grade Level */}
          <select
            value={gradeLevelId}
            onChange={(e) => setGradeLevelId(e.target.value)}
            className="filter-select w-28"
            aria-label="Grade level"
          >
            <option value="">All Grades</option>
            {gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>

          {/* Apply Button */}
          <button
            type="button"
            onClick={handleApply}
            className="inline-flex items-center justify-center min-h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Apply
          </button>

          {/* Clear */}
          {hasFilters && (
            <button type="button" onClick={handleReset} className="filter-clear">
              Clear
            </button>
          )}

          {/* Separator */}
          <div className="filter-separator" />

          {/* Export Buttons */}
          <Link
            href={`${exportBaseUrl}?format=pdf&${exportParams.toString()}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            PDF
          </Link>
          <Link
            href={`${exportBaseUrl}?format=xlsx&${exportParams.toString()}`}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-foreground hover:bg-muted/80 whitespace-nowrap"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            Excel
          </Link>
        </div>
      </div>

      {/* Data Table or Empty State */}
      {data.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            No enrolled students found for the selected filters.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={filteredData} enablePagination={false} />
      )}

      {/* Pagination */}
      {pagination.totalCount > 0 && pagination.totalPages > 1 && (
        <div className="border-t border-border px-4 py-3 no-print">
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalRecords={pagination.totalCount}
            pageSize={pagination.pageSize}
            baseUrl={paginationBaseUrl}
            itemLabel="students"
          />
        </div>
      )}
    </div>
  );
}
