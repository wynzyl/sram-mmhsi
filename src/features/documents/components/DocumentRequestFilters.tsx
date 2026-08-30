"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_REQUEST_TYPES,
  DOCUMENT_REQUEST_STATUSES,
  DOCUMENT_REQUEST_TYPE_LABELS,
  DOCUMENT_REQUEST_STATUS_LABELS,
  type DocumentRequestStatus,
  type DocumentRequestType,
} from "@/lib/constants/document-requests";

type SchoolYearOption = { id: string; label: string; isActive: boolean };

interface DocumentRequestFiltersProps {
  schoolYearOptions: SchoolYearOption[];
  /** Render in inline mode for card headers (no labels, compact) */
  inline?: boolean;
  /** Default school year ID to use when no filter is selected */
  defaultSchoolYearId?: string;
}

export function DocumentRequestFilters({
  schoolYearOptions,
  inline = false,
  defaultSchoolYearId,
}: DocumentRequestFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") ?? "";
  const currentType = searchParams.get("type") ?? "";
  // Use defaultSchoolYearId when URL has no filter
  const currentSchoolYear = searchParams.get("sy") ?? defaultSchoolYearId ?? "";
  const currentSearch = searchParams.get("q") ?? "";

  function updateParams(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset to page 1 when filters change
    params.delete("page");

    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const search = formData.get("search") as string;
    updateParams("q", search);
  }

  function clearFilters() {
    startTransition(() => {
      router.push("?");
    });
  }

  const hasActiveFilters =
    currentStatus || currentType || currentSchoolYear || currentSearch;

  // Inline mode: compact layout for card headers (single row, no wrapping)
  if (inline) {
    return (
      <div className="filter-controls-inline">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
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
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Search..."
              className="filter-search-input"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center justify-center min-h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            Go
          </button>
        </form>

        {/* Status Filter */}
        <select
          value={currentStatus}
          onChange={(e) => updateParams("status", e.target.value)}
          disabled={isPending}
          aria-label="Filter by status"
          className="filter-select w-24"
        >
          <option value="">All Status</option>
          {DOCUMENT_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {DOCUMENT_REQUEST_STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        {/* Document Type Filter */}
        <select
          value={currentType}
          onChange={(e) => updateParams("type", e.target.value)}
          disabled={isPending}
          aria-label="Filter by document type"
          className="filter-select w-24"
        >
          <option value="">All Types</option>
          {DOCUMENT_REQUEST_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_REQUEST_TYPE_LABELS[type]}
            </option>
          ))}
        </select>

        {/* School Year Filter */}
        <Select
          value={currentSchoolYear || "all"}
          onValueChange={(value) => updateParams("sy", value === "all" ? "" : value)}
          disabled={isPending}
        >
          <SelectTrigger className="w-44 h-10" aria-label="Filter by school year">
            <SelectValue placeholder="All Years" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {schoolYearOptions.map((sy) => (
              <SelectItem key={sy.id} value={sy.id}>
                {sy.label}
                {sy.isActive && <span className="text-success ml-1">(Active)</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Search
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Student name, ref number, or doc number..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </form>

        {/* Status Filter */}
        <div className="min-w-[150px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Status
          </label>
          <select
            value={currentStatus}
            onChange={(e) => updateParams("status", e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Statuses</option>
            {DOCUMENT_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {DOCUMENT_REQUEST_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        {/* Document Type Filter */}
        <div className="min-w-[200px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            Document Type
          </label>
          <select
            value={currentType}
            onChange={(e) => updateParams("type", e.target.value)}
            disabled={isPending}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            {DOCUMENT_REQUEST_TYPES.map((type) => (
              <option key={type} value={type}>
                {DOCUMENT_REQUEST_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        {/* School Year Filter */}
        <div className="min-w-[180px]">
          <label className="block text-sm font-medium text-muted-foreground mb-1">
            School Year
          </label>
          <Select
            value={currentSchoolYear || "all"}
            onValueChange={(value) => updateParams("sy", value === "all" ? "" : value)}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All School Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All School Years</SelectItem>
              {schoolYearOptions.map((sy) => (
                <SelectItem key={sy.id} value={sy.id}>
                  {sy.label}
                  {sy.isActive && <span className="text-success ml-1">(Active)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Active Filters & Clear */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Active filters:</span>
          {currentStatus && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {DOCUMENT_REQUEST_STATUS_LABELS[currentStatus as DocumentRequestStatus]}
            </span>
          )}
          {currentType && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {DOCUMENT_REQUEST_TYPE_LABELS[currentType as DocumentRequestType]}
            </span>
          )}
          {currentSchoolYear && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              {schoolYearOptions.find((sy) => sy.id === currentSchoolYear)?.label}
            </span>
          )}
          {currentSearch && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
              &quot;{currentSearch}&quot;
            </span>
          )}
          <button
            onClick={clearFilters}
            disabled={isPending}
            className="text-destructive hover:underline disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      )}

      {isPending && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
    </div>
  );
}
