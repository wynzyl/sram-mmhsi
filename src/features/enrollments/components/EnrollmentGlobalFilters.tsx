"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Filter, Search } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

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

  // Sync URL when debounced value changes
  useEffect(() => {
    if (debouncedSearch !== currentSearch) {
      updateFilters({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // Keep local state in sync if URL changes externally (e.g., clear filters)
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateFilters = (updates: { search?: string; gradeLevel?: string }) => {
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
  };

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
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or student ID..."
            className="max-w-md pl-9"
          />
        </div>

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
            <span className="rounded bg-gray-200 px-2 py-1 font-medium dark:bg-gray-800">
              Search: "{currentSearch}"
            </span>
          )}
          {currentGradeLevel && currentGradeLevel !== "all" && (
            <span className="rounded bg-gray-200 px-2 py-1 font-medium dark:bg-gray-800">
              Grade: {gradeLevels.find((g) => g.id === currentGradeLevel)?.name}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
