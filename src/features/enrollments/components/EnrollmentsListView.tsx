"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Download } from "lucide-react";
import {
  EnrollmentCard,
  type EnrollmentCardRow,
  type EnrollmentStatus,
  type SectionOption,
} from "@/features/enrollments";
import { cn } from "@/lib/utils/cn";
import { useDebounce } from "@/hooks/useDebounce";

const STAGGER_CLASSES = [
  "stagger-delay-1",
  "stagger-delay-2",
  "stagger-delay-3",
  "stagger-delay-4",
  "stagger-delay-5",
] as const;

const STATUS_TABS: Array<{
  key: "all" | EnrollmentStatus;
  label: string;
  hintColour: string;
}> = [
  { key: "all", label: "All", hintColour: "bg-foreground" },
  { key: "pending", label: "Pending", hintColour: "bg-warning" },
  { key: "assessed", label: "Assessed", hintColour: "bg-info" },
  { key: "enrolled", label: "Enrolled", hintColour: "bg-success" },
  { key: "cancelled", label: "Cancelled", hintColour: "bg-border" },
];

interface EnrollmentsListViewProps {
  enrollments: EnrollmentCardRow[];
  sections: SectionOption[];
  countMap: Partial<Record<EnrollmentStatus, number>>;
  filterStatus: "all" | EnrollmentStatus;
  /** Active school year label, shown in subtitle. */
  schoolYearLabel: string | null;
  page: number;
  pageSize: number;
  totalFilteredCount: number;
  hasMore: boolean;
  canCreate: boolean;
  canManage: boolean;
  canCancel: boolean;
  canCancelWithBalance: boolean;
  canOverrideEnrolled: boolean;
}

/**
 * Editorial card-grid layout for the enrollment queue.
 * Status filtering remains server-driven via `?status=` (matches existing pages).
 */
export default function EnrollmentsListView({
  enrollments,
  sections,
  countMap,
  filterStatus,
  schoolYearLabel,
  page,
  pageSize,
  totalFilteredCount,
  hasMore,
  canCreate,
  canManage,
  canCancel,
  canCancelWithBalance,
  canOverrideEnrolled,
}: EnrollmentsListViewProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 300);

  const totalAll = useMemo(
    () =>
      (countMap.pending ?? 0) +
      (countMap.assessed ?? 0) +
      (countMap.enrolled ?? 0) +
      (countMap.cancelled ?? 0),
    [countMap]
  );
  const totalActive = (countMap.pending ?? 0) + (countMap.assessed ?? 0);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return enrollments;
    return enrollments.filter((en) => {
      return (
        en.studentName.toLowerCase().includes(q) ||
        en.referenceNumber.toLowerCase().includes(q) ||
        en.gradeLevel.toLowerCase().includes(q)
      );
    });
  }, [enrollments, debouncedSearch]);

  const subtitle = (
    <span className="font-mono text-sm text-muted-foreground">
      {totalAll.toLocaleString()} record{totalAll === 1 ? "" : "s"}
      {schoolYearLabel ? ` · SY ${schoolYearLabel}` : ""}
      {totalActive > 0 ? ` · ${totalActive} active` : ""}
    </span>
  );

  const newEnrollmentHref = "/staff/enrollments/new";
  const createPageHref = (nextPage: number, nextStatus: "all" | EnrollmentStatus = filterStatus) => {
    const params = new URLSearchParams();
    if (nextStatus !== "all") params.set("status", nextStatus);
    if (nextPage > 1) params.set("page", String(nextPage));
    const query = params.toString();
    return query ? `/staff/enrollments?${query}` : "/staff/enrollments";
  };
  const showingFrom = totalFilteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = totalFilteredCount === 0 ? 0 : (page - 1) * pageSize + enrollments.length;

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Enrollments
        </h1>
        <p className="text-sm text-muted-foreground">
          {schoolYearLabel ? `SY ${schoolYearLabel}` : "Current Academic Session"} • {totalAll.toLocaleString()} Total Record{totalAll !== 1 ? "s" : ""}
          {totalActive > 0 ? ` • ${totalActive} Active` : ""}
        </p>
      </div>

      {/* Enrollment Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header - ALL controls here */}
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Count Badge */}
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Enrollment Queue
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {totalFilteredCount} Record{totalFilteredCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Right: All Controls - Inline Row */}
          <div className="flex items-center gap-2">
            {/* Search Input - Desktop */}
            <div className="hidden md:flex items-stretch rounded-md border border-border bg-muted/50 w-44">
              <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
                <Search className="h-4 w-4 shrink-0" aria-hidden />
              </span>
              <input
                type="search"
                className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                placeholder="Quick search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              aria-label="Filter by status"
              onChange={(e) => {
                const status = e.target.value as "all" | EnrollmentStatus;
                window.location.href = createPageHref(1, status);
              }}
              className="form-control min-h-10 w-28 bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
            >
              {STATUS_TABS.map((tab) => {
                const count = tab.key === "all" ? totalAll : countMap[tab.key as EnrollmentStatus] ?? 0;
                return (
                  <option key={tab.key} value={tab.key}>
                    {tab.label} ({count})
                  </option>
                );
              })}
            </select>

            {/* Export CSV Button */}
            <button
              type="button"
              disabled
              title="Export CSV is not available yet."
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-3 min-h-10 text-xs font-semibold text-muted-foreground cursor-not-allowed opacity-70 whitespace-nowrap"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              Export CSV
            </button>

            {/* Enroll Student Button */}
            {canCreate && (
              <Link
                href={newEnrollmentHref}
                id="new-enrollment-btn"
                className="btn-primary min-h-10 px-4 whitespace-nowrap"
              >
                <Plus className="h-4 w-4 mr-1" />
                Enroll Student
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search Row */}
        <div className="flex md:hidden border-b border-border px-4 py-2">
          <div className="flex items-stretch rounded-md border border-border bg-muted/50 w-full">
            <span className="flex items-center pl-3 pr-2 text-muted-foreground pointer-events-none">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
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

          {/* Card Content */}
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-lg font-semibold text-foreground">
              No enrollments match this view.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {debouncedSearch
                ? `Nothing in this status matches "${debouncedSearch}".`
                : filterStatus === "all"
                ? "Create the first enrollment of the school year to get started."
                : `No enrollments are currently ${filterStatus}.`}
            </p>
            {canCreate && filterStatus === "all" && !debouncedSearch && (
              <Link
                href={newEnrollmentHref}
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-destructive"
              >
                <Plus className="h-4 w-4" />
                Enroll Student
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-4">
            {filtered.map((en, i) => {
              const stagger = STAGGER_CLASSES[Math.min(i, STAGGER_CLASSES.length - 1)];
              return (
                <div
                  key={en.id}
                  className={cn("opacity-0 animate-reveal-stagger", stagger)}
                >
                  <EnrollmentCard
                    enrollment={en}
                    sections={sections}
                    canManage={canManage}
                    canCancel={canCancel}
                    canCancelWithBalance={canCancelWithBalance}
                    canOverrideEnrolled={canOverrideEnrolled}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Card Footer - Pagination */}
        {totalFilteredCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {showingFrom.toLocaleString()}-{showingTo.toLocaleString()} of{" "}
              {totalFilteredCount.toLocaleString()}
              {debouncedSearch && ` (${filtered.length} matching search)`}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={createPageHref(page - 1)}
                  className="rounded-md border border-border px-2.5 py-1 hover:bg-muted transition-colors"
                >
                  Previous
                </Link>
              )}
              {hasMore && (
                <Link
                  href={createPageHref(page + 1)}
                  className="rounded-md border border-border px-2.5 py-1 hover:bg-muted transition-colors"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Confidential institutional data. Authorized access only.
      </p>
    </div>
  );
}
