"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteSectionAction } from "../sections.actions";
import type { SectionView } from "../sections.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/useDebounce";
import SectionFormModal from "./SectionFormModal";
import CopySectionsModal from "./CopySectionsModal";

interface GradeLevelOption {
  id: string;
  name: string;
}

interface SchoolYearOption {
  id: string;
  label: string;
  isActive: boolean;
  sectionCount?: number;
}

interface SectionsTableProps {
  sections: SectionView[];
  gradeLevels: GradeLevelOption[];
  schoolYears: SchoolYearOption[];
}

export default function SectionsTable({
  sections,
  gradeLevels,
  schoolYears,
}: SectionsTableProps) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<SectionView | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Find active school year
  const activeSchoolYear = schoolYears.find((sy) => sy.isActive);

  // Filter sections based on search
  const filteredSections = useMemo(() => {
    if (!debouncedSearch.trim()) return sections;
    const term = debouncedSearch.toLowerCase();
    return sections.filter(
      (section) =>
        section.name.toLowerCase().includes(term) ||
        section.gradeLevelName.toLowerCase().includes(term)
    );
  }, [sections, debouncedSearch]);

  // Compute section counts per school year for the copy modal
  const schoolYearsWithCounts = schoolYears.map((sy) => ({
    ...sy,
    sectionCount: sy.sectionCount ?? sections.filter((s) => s.schoolYearId === sy.id).length,
  }));

  const handleDelete = async (section: SectionView) => {
    setDeleting(true);
    try {
      const result = await deleteSectionAction(section.id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } finally {
      setDeleting(false);
      setDeletingId(null);
    }
  };

  const canDelete = (section: SectionView) => {
    return section.enrollmentCount === 0 && section.assignmentCount === 0;
  };

  const columns = useMemo<ColumnDef<SectionView>[]>(
    () => [
      {
        header: "Section Name",
        accessorKey: "name",
        cell: ({ row }) => (
          <Link
            href={`/staff/academics/sections/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        header: "Grade Level",
        accessorKey: "gradeLevelName",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.gradeLevelName}</span>
        ),
      },
      {
        header: "School Year",
        accessorKey: "schoolYearLabel",
        cell: ({ row }) => (
          <div className="flex-row-2">
            <span className="text-sm">{row.original.schoolYearLabel}</span>
            {row.original.isActiveYear && (
              <Badge variant="success" className="text-xs">Active</Badge>
            )}
          </div>
        ),
      },
      {
        header: "Enrollments",
        accessorKey: "enrollmentCount",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.enrollmentCount}
          </Badge>
        ),
      },
      {
        header: "Assignments",
        accessorKey: "assignmentCount",
        cell: ({ row }) => (
          <Badge variant="secondary">
            {row.original.assignmentCount}
          </Badge>
        ),
      },
      {
        header: "Created",
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
          const section = row.original;

          if (deletingId === section.id) {
            return (
              <div className="flex gap-2 items-center">
                <span className="text-helper">Delete?</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(section)}
                  loading={deleting}
                >
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingId(null)}
                >
                  Cancel
                </Button>
              </div>
            );
          }

          return (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSection(section)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeletingId(section.id)}
                disabled={!canDelete(section)}
                title={
                  !canDelete(section)
                    ? "Cannot delete section with enrollments or assignments"
                    : undefined
                }
              >
                Delete
              </Button>
            </div>
          );
        },
      },
    ],
    [deletingId, deleting]
  );

  return (
    <div>
      {/* Card Header with gradient effect */}
      <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Title + Badge */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Section List
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {sections.length} Section{sections.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Right: Search + Actions (single row, no wrapping) */}
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

          {activeSchoolYear && (
            <Button variant="secondary" size="sm" onClick={() => setShowCopyModal(true)}>
              Copy from Previous Year
            </Button>
          )}
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-gradient-primary inline-flex items-center justify-center min-h-10 px-4 rounded-md whitespace-nowrap"
          >
            + Add Section
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-muted-foreground mb-2">
            No sections configured
          </div>
          <p className="text-secondary">
            Create sections to organize students within each grade level.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} data={filteredSections} />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <SectionFormModal
          gradeLevels={gradeLevels}
          schoolYears={schoolYears}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Edit Modal */}
      {editingSection && (
        <SectionFormModal
          section={editingSection}
          gradeLevels={gradeLevels}
          schoolYears={schoolYears}
          onClose={() => setEditingSection(null)}
        />
      )}

      {/* Copy Sections Modal */}
      {showCopyModal && activeSchoolYear && (
        <CopySectionsModal
          schoolYears={schoolYearsWithCounts}
          activeSchoolYearId={activeSchoolYear.id}
          onClose={() => setShowCopyModal(false)}
        />
      )}
    </div>
  );
}
