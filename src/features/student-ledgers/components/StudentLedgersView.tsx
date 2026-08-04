"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import AssessmentsTable from "@/features/finance/components/AssessmentsTable";
import { useDebounce } from "@/hooks/useDebounce";
import { SearchInput } from "@/components/shared/SearchInput";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssessmentListItem } from "@/features/assessments/assessments.queries";
import type { PaginatedResult } from "@/lib/types/pagination";

type SchoolYear = {
  id: string;
  label: string;
  isActive: boolean;
};

type StudentLedgersViewProps = {
  assessments: PaginatedResult<AssessmentListItem>;
  schoolYears: SchoolYear[];
  initialSearch: string;
  initialSchoolYearId: string;
  activeSchoolYearId: string | null;
};

export function StudentLedgersView({
  assessments,
  schoolYears,
  initialSearch,
  initialSchoolYearId,
  activeSchoolYearId,
}: StudentLedgersViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchInput, setSearchInput] = useState(initialSearch);
  const debouncedSearch = useDebounce(searchInput, 300);

  const { data, pagination } = assessments;
  const { page, pageSize, totalRecords, totalPages } = pagination;

  // Build URL with updated filters
  const buildUrl = useCallback(
    (updates: { q?: string; schoolYearId?: string; page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.q !== undefined) {
        if (updates.q.trim()) {
          params.set("q", updates.q.trim());
        } else {
          params.delete("q");
        }
        // Reset to page 1 when search changes
        params.delete("page");
      }

      if (updates.schoolYearId !== undefined) {
        if (updates.schoolYearId && updates.schoolYearId !== activeSchoolYearId) {
          params.set("schoolYearId", updates.schoolYearId);
        } else {
          params.delete("schoolYearId");
        }
        // Reset to page 1 when school year changes
        params.delete("page");
      }

      if (updates.page !== undefined && updates.page > 1) {
        params.set("page", updates.page.toString());
      } else if (updates.page === 1) {
        params.delete("page");
      }

      const queryString = params.toString();
      return queryString ? `${pathname}?${queryString}` : pathname;
    },
    [searchParams, pathname, activeSchoolYearId]
  );

  // Update URL when debounced search changes
  useEffect(() => {
    const currentSearch = searchParams.get("q") ?? "";
    if (debouncedSearch !== currentSearch) {
      router.push(buildUrl({ q: debouncedSearch }));
    }
  }, [debouncedSearch, searchParams, router, buildUrl]);

  // Handle school year change (immediate)
  const handleSchoolYearChange = (value: string) => {
    router.push(buildUrl({ schoolYearId: value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput("");
    router.push(pathname);
  };

  // Check if any filters are active
  const hasActiveFilters = initialSearch || (initialSchoolYearId && initialSchoolYearId !== activeSchoolYearId);

  // Build base URL for pagination (preserving current filters)
  const paginationBaseUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (initialSearch) params.set("q", initialSearch);
    if (initialSchoolYearId && initialSchoolYearId !== activeSchoolYearId) {
      params.set("schoolYearId", initialSchoolYearId);
    }
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, initialSearch, initialSchoolYearId, activeSchoolYearId]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search student name..."
            showClear
            className="w-full sm:w-64"
          />

          {/* School Year Filter */}
          <Select
            value={initialSchoolYearId || activeSchoolYearId || ""}
            onValueChange={handleSchoolYearChange}
          >
            <SelectTrigger className="w-44 h-9" aria-label="School year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((sy) => (
                <SelectItem key={sy.id} value={sy.id}>
                  {sy.label}
                  {sy.isActive && <span className="text-emerald-500 ml-1">(Active)</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          {totalRecords === 0 ? (
            "No results"
          ) : (
            <>
              <span className="font-medium text-foreground">{totalRecords.toLocaleString()}</span>{" "}
              {totalRecords === 1 ? "ledger" : "ledgers"} found
            </>
          )}
        </p>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {initialSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              Search: &quot;{initialSearch}&quot;
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {initialSchoolYearId && initialSchoolYearId !== activeSchoolYearId && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              Year: {schoolYears.find((sy) => sy.id === initialSchoolYearId)?.label}
              <button
                type="button"
                onClick={() => router.push(buildUrl({ schoolYearId: "" }))}
                className="ml-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Remove school year filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <AssessmentsTable assessments={data} assessmentsBasePath="/staff/assessments" />

      {/* Pagination */}
      <TablePagination
        currentPage={page}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        baseUrl={paginationBaseUrl}
        itemLabel="ledgers"
      />
    </div>
  );
}
