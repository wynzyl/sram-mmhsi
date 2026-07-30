"use client";

import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudents } from "@/features/students/hooks/use-students";
import { useActiveSchoolYearId } from "@/components/providers/ActiveSchoolYearProvider";
import {
  studentDirectoryListHref,
  isStudentSortBy,
  type StudentDirectoryBasePath,
  type StudentSortBy,
  type StudentSortDir,
} from "@/lib/utils/student-directory-href";
import {
  StudentDirectoryTable,
  type StudentDirectoryActiveSort,
} from "@/features/students/components/StudentDirectoryTable";
import { StudentDirectoryPagination } from "@/features/students/components/StudentDirectoryPagination";

export function StudentDirectoryView({
  basePath,
  registerHref,
  title,
}: {
  basePath: StudentDirectoryBasePath;
  registerHref: string;
  title: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSchoolYearId = useActiveSchoolYearId();

  // ─── Filters from URL (URL is the source of truth) ──────────────────
  const q = searchParams.get("q") ?? "";
  const gradeLevelId = searchParams.get("gradeLevelId") || undefined;
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  // ─── Debounced search state ─────────────────────────────────────────
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Sync local state when URL changes externally (back/forward navigation)
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setSearchInput(q);
  }

  // ─── Sort from URL ──────────────────────────────────────────────────
  const rawSortBy = searchParams.get("sortBy");
  const sortBy: StudentSortBy | undefined = isStudentSortBy(rawSortBy) ? rawSortBy : undefined;
  const sortDir: StudentSortDir = sortBy
    ? searchParams.get("sortDir") === "desc"
      ? "desc"
      : "asc"
    : "asc";
  const activeSort: StudentDirectoryActiveSort = sortBy ? { by: sortBy, dir: sortDir } : null;

  // Always filter by active school year (no "all years" option)
  const effectiveSchoolYearId = activeSchoolYearId ?? undefined;

  const query = useStudents({
    q,
    page: currentPage,
    schoolYearId: effectiveSchoolYearId,
    gradeLevelId,
    sortBy,
    sortDir,
  });

  const data = query.data;
  const rows = data?.rows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 0;
  const gradeLevelOptions = data?.gradeLevelOptions ?? [];
  const canCreate = data?.canCreate ?? false;

  // ─── Derived display values ─────────────────────────────────────────
  const qTrim = q.trim();
  const qParam = qTrim || undefined;
  const hasFilters = qTrim !== "" || gradeLevelId != null;

  // Push to URL when debounced search changes (skip if already synced)
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === q) return;
    router.push(
      studentDirectoryListHref(basePath, {
        q: trimmed || undefined,
        gradeLevelId,
        sortBy,
        sortDir: sortBy ? sortDir : undefined,
        // Reset to page 1 on new search
      })
    );
  }, [debouncedSearch, q, basePath, gradeLevelId, sortBy, sortDir, router]);

  // If the requested page is out of range, snap back to the last page.
  useEffect(() => {
    if (totalCount > 0 && currentPage > totalPages) {
      router.replace(
        studentDirectoryListHref(basePath, {
          q: qParam,
          gradeLevelId,
          sortBy,
          sortDir: sortBy ? sortDir : undefined,
          page: totalPages,
        })
      );
    }
  }, [totalCount, totalPages, currentPage, basePath, qParam, gradeLevelId, sortBy, sortDir, router]);

  const selectedGradeLabel =
    gradeLevelId != null ? gradeLevelOptions.find((g) => g.id === gradeLevelId)?.name : null;

  // Display active school year in subtitle
  const subtitleFilter = selectedGradeLabel
    ? `Current School Year · ${selectedGradeLabel}`
    : "Current School Year";

  // ─── Sort header link builder (toggles direction, resets to page 1) ──
  function sortHref(by: StudentSortBy): string {
    const nextDir: StudentSortDir =
      activeSort?.by === by && activeSort.dir === "asc" ? "desc" : "asc";
    return studentDirectoryListHref(basePath, {
      q: qParam,
      gradeLevelId,
      sortBy: by,
      sortDir: nextDir,
    });
  }

  // ─── Handle grade level change → push to URL (page resets to 1) ──────
  function handleGradeLevelChange(nextGrade: string | undefined) {
    router.push(
      studentDirectoryListHref(basePath, {
        q: qParam,
        gradeLevelId: nextGrade,
        sortBy,
        sortDir: sortBy ? sortDir : undefined,
      })
    );
  }

  const isInitialLoading = query.isLoading;
  const emptyMessage = data?.emptyMessage ?? "No students found.";

  return (
    <div className="page-container space-y-6">
      {/* Header: title + subtitle (left), filters + register toolbar (right, same row) */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            <span className="text-gray-600 dark:text-gray-400">{subtitleFilter}</span>
            {" · "}
            {totalCount.toLocaleString()} enrollment{totalCount !== 1 ? "s" : ""}{" "}
            {hasFilters ? "matching the current filters." : "on file."}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
          <div
            role="search"
            className="flex flex-col gap-2 sm:flex-row sm:items-center focus-within:[&_input]:outline-none"
          >
            <div className="flex w-full items-stretch rounded-md border border-border bg-muted/50 sm:w-60">
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
                id="student-search"
                type="search"
                className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Search student records…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="w-full sm:w-40 sm:flex-none">
              <select
                value={gradeLevelId ?? ""}
                aria-label="Filter by grade level"
                onChange={(e) => handleGradeLevelChange(e.target.value || undefined)}
                className="form-control min-h-10 w-full bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
              >
                <option value="">All grades</option>
                {gradeLevelOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <Link
                href={basePath}
                onClick={() => setSearchInput("")}
                className="inline-flex min-h-10 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </Link>
            )}

            {canCreate && (
              <Link
                href={registerHref}
                className="btn-primary min-h-10 px-4 shrink-0"
                id="register-student-btn"
              >
                + Register Student
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Roster: single bordered card (header bar · table · footer pagination) */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="roster-heading"
      >
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="roster-heading"
            className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
          >
            Active student roster
          </h2>
          <div className="flex items-center gap-2">
            {query.isFetching && !isInitialLoading && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Refreshing…
              </span>
            )}
            <button
              type="button"
              disabled
              title="Export CSV is not available yet."
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground cursor-not-allowed opacity-70"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Export CSV
            </button>
          </div>
        </div>

        {query.isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            Failed to load students. Please try again.
            <div className="mt-3">
              <button type="button" onClick={() => query.refetch()} className="btn-primary min-h-9 px-4">
                Retry
              </button>
            </div>
          </div>
        ) : (
          <StudentDirectoryTable
            rows={rows}
            emptyMessage={isInitialLoading ? "Loading students…" : emptyMessage}
            activeSort={activeSort}
            sortHref={sortHref}
          />
        )}

        {totalCount > 0 && (
          <div className="border-t border-border px-4 py-3">
            <StudentDirectoryPagination
              basePath={basePath}
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              q={qParam}
              gradeLevelId={gradeLevelId}
              sortBy={sortBy}
              sortDir={sortBy ? sortDir : undefined}
            />
          </div>
        )}
      </section>

      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Confidential institutional data. Authorized access only.
      </p>
    </div>
  );
}
