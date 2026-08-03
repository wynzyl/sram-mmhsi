"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  ARCHIVED_STUDENT_STATUSES,
  STUDENT_STATUS_LABELS,
} from "@/lib/constants/student-status";
import type { ArchiveSchoolYearOption } from "../archive.queries";

interface ArchiveFiltersProps {
  schoolYearOptions: ArchiveSchoolYearOption[];
  currentStatus?: string;
  currentSchoolYearId?: string;
  currentSearch?: string;
  /** Render in inline mode for card headers (no labels, compact) */
  inline?: boolean;
}

export function ArchiveFilters({
  schoolYearOptions,
  currentStatus,
  currentSchoolYearId,
  currentSearch,
  inline = false,
}: ArchiveFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Keep the search input in sync with the URL-derived prop. When the URL
  // changes externally (e.g. back/forward navigation), `currentSearch` changes
  // and we adjust local state during render — React's recommended pattern for
  // "adjusting state when a prop changes" without useEffect.
  const [search, setSearch] = useState(currentSearch ?? "");
  const debouncedSearch = useDebounce(search, 300);
  const [syncedSearch, setSyncedSearch] = useState(currentSearch ?? "");
  if ((currentSearch ?? "") !== syncedSearch) {
    setSyncedSearch(currentSearch ?? "");
    setSearch(currentSearch ?? "");
  }

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // Reset to page 1 when filters change
      params.set("page", "1");

      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      startTransition(() => {
        router.push(`/staff/archive?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  // Auto-update URL when debounced search changes
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === (currentSearch ?? "")) return;
    updateFilters({ search: trimmed || undefined });
  }, [debouncedSearch, currentSearch, updateFilters]);

  const handleClearFilters = () => {
    setSearch("");
    startTransition(() => {
      router.push("/staff/archive");
    });
  };

  const hasFilters = currentStatus || currentSchoolYearId || currentSearch;

  // Inline mode: compact layout for card headers (single row, no wrapping)
  if (inline) {
    return (
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
            className="filter-search-input"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Status Filter */}
        <select
          value={currentStatus ?? "all"}
          onChange={(e) =>
            updateFilters({ status: e.target.value === "all" ? undefined : e.target.value })
          }
          aria-label="Filter by status"
          className="filter-select w-28"
        >
          <option value="all">All Archived</option>
          {ARCHIVED_STUDENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STUDENT_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        {/* School Year Filter */}
        <select
          value={currentSchoolYearId ?? "all"}
          onChange={(e) =>
            updateFilters({ schoolYearId: e.target.value === "all" ? undefined : e.target.value })
          }
          aria-label="Filter by school year"
          className="filter-select w-28"
        >
          <option value="all">All Years</option>
          {schoolYearOptions.map((sy) => (
            <option key={sy.id} value={sy.id}>
              {sy.label}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={isPending}
            className="filter-clear"
          >
            Clear
          </button>
        )}
      </div>
    );
  }

  // Default mode: with labels
  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <label
          htmlFor="archive-search"
          className="mb-1.5 block text-sm font-medium"
        >
          Search
        </label>
        <Input
          id="archive-search"
          type="search"
          placeholder="Name or student ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status Filter */}
      <div className="min-w-[160px]">
        <label
          htmlFor="archive-status"
          className="mb-1.5 block text-sm font-medium"
        >
          Status
        </label>
        <Select
          value={currentStatus ?? "all"}
          onValueChange={(value) =>
            updateFilters({ status: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger id="archive-status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Archived</SelectItem>
            {ARCHIVED_STUDENT_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {STUDENT_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* School Year Filter */}
      <div className="min-w-[160px]">
        <label
          htmlFor="archive-school-year"
          className="mb-1.5 block text-sm font-medium"
        >
          Archived In
        </label>
        <Select
          value={currentSchoolYearId ?? "all"}
          onValueChange={(value) =>
            updateFilters({ schoolYearId: value === "all" ? undefined : value })
          }
        >
          <SelectTrigger id="archive-school-year">
            <SelectValue placeholder="All school years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All School Years</SelectItem>
            {schoolYearOptions.map((sy) => (
              <SelectItem key={sy.id} value={sy.id}>
                {sy.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="ghost"
          onClick={handleClearFilters}
          disabled={isPending}
          className="text-muted-foreground"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}
