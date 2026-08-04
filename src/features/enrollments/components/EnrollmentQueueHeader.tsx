"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";

type GradeLevel = {
  id: string;
  name: string;
};

type EnrollmentQueueHeaderProps = {
  basePath: string;
  gradeLevels: GradeLevel[];
  totalCount: number;
  canCreate: boolean;
};

/**
 * Card header row for Enrollment Queue with inline controls.
 * Renders inside the card section - page title is in the parent template.
 */
export default function EnrollmentQueueHeader({
  basePath,
  gradeLevels,
  totalCount,
  canCreate,
}: EnrollmentQueueHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filter values from URL
  const currentSearch = searchParams.get("search") ?? "";
  const currentGradeLevel = searchParams.get("gradeLevel") ?? "";
  const currentTab = searchParams.get("tab") ?? "ready-to-enroll";

  // Debounced search state
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync local state when URL changes externally (back/forward navigation)
  const [syncedSearch, setSyncedSearch] = useState(currentSearch);
  if (currentSearch !== syncedSearch) {
    setSyncedSearch(currentSearch);
    setSearchInput(currentSearch);
  }

  // Auto-update URL when debounced search changes
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === currentSearch) return;

    const params = new URLSearchParams();
    if (currentTab) params.set("tab", currentTab);
    if (trimmed) params.set("search", trimmed);
    if (currentGradeLevel) params.set("gradeLevel", currentGradeLevel);

    router.push(`${basePath}?${params.toString()}`);
  }, [debouncedSearch, currentSearch, currentTab, currentGradeLevel, basePath, router]);

  // Determine if any filters are active
  const hasFilters = currentSearch !== "" || currentGradeLevel !== "";

  /**
   * Handle grade level change - pushes to URL immediately
   */
  function handleGradeLevelChange(nextGrade: string | undefined) {
    const params = new URLSearchParams();
    if (currentTab) params.set("tab", currentTab);
    if (currentSearch) params.set("search", currentSearch);
    if (nextGrade) params.set("gradeLevel", nextGrade);

    router.push(`${basePath}?${params.toString()}`);
  }

  /**
   * Build clear filters URL (preserves tab only)
   */
  function getClearHref(): string {
    const params = new URLSearchParams();
    if (currentTab) params.set("tab", currentTab);
    return `${basePath}?${params.toString()}`;
  }

  return (
    <>
      {/* Card Header - Inline Controls */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Section Label + Count Badge */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
            Queue Management
          </h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            {totalCount} Record{totalCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Right: All Controls - Inline Row */}
        <div role="search" className="flex items-center gap-2">
          {/* Search Input - Desktop */}
          <div className="hidden md:flex items-stretch rounded-md border border-border bg-muted/50 w-44">
            <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            <input
              id="enrollment-search"
              type="search"
              className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Quick search..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Grade Level Dropdown */}
          <select
            value={currentGradeLevel}
            aria-label="Filter by grade level"
            onChange={(e) => handleGradeLevelChange(e.target.value || undefined)}
            className="form-control min-h-10 w-28 bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
          >
            <option value="">All grades</option>
            {gradeLevels.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Clear Filters Link */}
          {hasFilters && (
            <Link
              href={getClearHref()}
              onClick={() => setSearchInput("")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              Clear
            </Link>
          )}

          {/* Manual Entry Button */}
          {canCreate && (
            <Link
              href={`${basePath}/new`}
              className="btn-primary min-h-10 px-4 whitespace-nowrap"
              id="manual-entry-btn"
            >
              + Manual Entry
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Search Row */}
      <div className="flex md:hidden border-b border-border px-4 py-2">
        <div className="flex items-stretch rounded-md border border-border bg-muted/50 w-full">
          <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
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
            className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
            placeholder="Search enrollments..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>
    </>
  );
}
