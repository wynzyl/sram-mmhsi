"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import AssessmentsTable from "@/features/finance/components/AssessmentsTable";
import { useDebounce } from "@/hooks/useDebounce";
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

/** Generate page numbers with ellipsis markers for pagination. */
function paginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive =
  "border-primary bg-primary/10 text-primary font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

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
  const { page, pageSize, totalRecords, totalPages, hasNextPage, hasPreviousPage } = pagination;

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
  const handleSchoolYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(buildUrl({ schoolYearId: e.target.value }));
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchInput("");
    router.push(pathname);
  };

  // Check if any filters are active
  const hasActiveFilters = initialSearch || (initialSchoolYearId && initialSchoolYearId !== activeSchoolYearId);

  // Calculate record range
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalRecords);

  // Pagination URL builder
  const hrefForPage = (newPage: number) => buildUrl({ page: newPage });
  const pages = paginationPages(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search student name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 sm:w-64"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* School Year Filter */}
          <select
            value={initialSchoolYearId || activeSchoolYearId || ""}
            onChange={handleSchoolYearChange}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.label}
                {sy.isActive ? " (Current)" : ""}
              </option>
            ))}
          </select>

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
      {totalRecords > 0 && (
        <nav
          className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
          aria-label="Ledgers pagination"
        >
          <p className="text-sm text-muted-foreground">
            Showing{" "}
            <span className="font-medium text-foreground">{startRecord}</span> to{" "}
            <span className="font-medium text-foreground">{endRecord}</span> of{" "}
            <span className="font-medium text-foreground">{totalRecords.toLocaleString()}</span>{" "}
            ledgers
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {!hasPreviousPage ? (
              <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </span>
            ) : (
              <Link href={hrefForPage(page - 1)} className={btnBase}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Link>
            )}

            <div className="flex flex-wrap items-center gap-1">
              {pages.map((item, i) =>
                item === "ellipsis" ? (
                  <span
                    key={`e-${i}`}
                    className="inline-flex min-w-9 items-center justify-center text-muted-foreground"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={item}
                    href={hrefForPage(item)}
                    className={`${btnBase} min-w-9 px-0 ${item === page ? btnActive : ""}`}
                    aria-current={item === page ? "page" : undefined}
                  >
                    {item}
                  </Link>
                )
              )}
            </div>

            {!hasNextPage ? (
              <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </span>
            ) : (
              <Link href={hrefForPage(page + 1)} className={btnBase}>
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
