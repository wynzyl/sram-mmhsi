"use client";

import { useState, useMemo, startTransition } from "react";
import { useRouter } from "next/navigation";
import { removeAdviserAction } from "../advisers.actions";
import type { AdviserView, SectionOption, TeacherOption } from "../advisers.schema";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineConfirmButton } from "@/components/shared/ConfirmActionButton";
import type { ColumnDef } from "@tanstack/react-table";
import { formatDate } from "@/lib/utils/date";
import { useDebounce } from "@/hooks/useDebounce";
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
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Filter advisers based on search
  const filteredAdvisers = useMemo(() => {
    if (!debouncedSearch.trim()) return advisers;
    const term = debouncedSearch.toLowerCase();
    return advisers.filter(
      (adviser) =>
        adviser.userName.toLowerCase().includes(term) ||
        adviser.sectionName.toLowerCase().includes(term) ||
        adviser.gradeLevelName.toLowerCase().includes(term)
    );
  }, [advisers, debouncedSearch]);

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
              onSuccess={() => startTransition(() => { router.refresh(); })}
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
      {/* Card Header with gradient effect */}
      <div className="card-header-gradient flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Title + Badge */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Adviser Assignments
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {advisers.length} Assignment{advisers.length !== 1 ? "s" : ""}
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

          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            + Assign Adviser
          </Button>
        </div>
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
        <DataTable columns={columns} data={filteredAdvisers} />
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
