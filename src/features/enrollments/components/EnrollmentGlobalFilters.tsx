"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Filter } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchInput } from "@/components/shared/SearchInput";

type GradeLevel = {
  id: string;
  name: string;
};

type EnrollmentGlobalFiltersProps = {
  gradeLevels: GradeLevel[];
  basePath: string;
};

/**
 * Global filters for enrollment queue that persist across tabs.
 * Uses URL search params to maintain state when switching tabs.
 */
export default function EnrollmentGlobalFilters({ gradeLevels, basePath }: EnrollmentGlobalFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get("search") || "";
  const currentGradeLevel = searchParams.get("gradeLevel") || "all";
  const currentTab = searchParams.get("tab") || "ready-to-enroll";

  // Local input state for immediate UI feedback
  const [searchInput, setSearchInput] = useState(currentSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Define updateFilters before effects that use it
  const updateFilters = useCallback((updates: { search?: string; gradeLevel?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    // Update search param
    if (updates.search !== undefined) {
      if (updates.search) {
        params.set("search", updates.search);
      } else {
        params.delete("search");
      }
    }

    // Update gradeLevel param
    if (updates.gradeLevel !== undefined) {
      if (updates.gradeLevel && updates.gradeLevel !== "all") {
        params.set("gradeLevel", updates.gradeLevel);
      } else {
        params.delete("gradeLevel");
      }
    }

    router.push(`${basePath}?${params.toString()}`);
  }, [searchParams, router, basePath]);

  // Sync URL when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, currentSearch, updateFilters]);

  // Keep local state in sync if URL changes externally (e.g., clear filters)
  useEffect(() => {
    setSearchInput(currentSearch); // eslint-disable-line react-hooks/set-state-in-effect -- Sync URL to local
  }, [currentSearch]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
  };

  const handleGradeLevelChange = (value: string) => {
    updateFilters({ gradeLevel: value });
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    params.set("tab", currentTab);
    router.push(`${basePath}?${params.toString()}`);
  };

  const hasActiveFilters = currentSearch || (currentGradeLevel && currentGradeLevel !== "all");

  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <SearchInput
          value={searchInput}
          onChange={handleSearchChange}
          placeholder="Search by name or student ID..."
          type="search"
          className="max-w-md flex-1"
        />

        {/* Grade Level Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={currentGradeLevel}
            onChange={(e) => handleGradeLevelChange(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Grade Levels</option>
            {gradeLevels.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm font-medium text-primary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Active filters:</span>
          {currentSearch && (
            <span className="rounded bg-muted px-2 py-1 font-medium">
              Search: &quot;{currentSearch}&quot;
            </span>
          )}
          {currentGradeLevel && currentGradeLevel !== "all" && (
            <span className="rounded bg-muted px-2 py-1 font-medium">
              Grade: {gradeLevels.find((g) => g.id === currentGradeLevel)?.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
