"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { DataCard } from "@/components/ui/editorial/DataCard";
import {
  EnrollmentCard,
  type EnrollmentCardRow,
  type EnrollmentStatus,
  type SectionOption,
} from "@/features/enrollments";
import { editorialFieldClass } from "@/lib/utils/editorial-styles";
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
  { key: "all", label: "All", hintColour: "bg-charcoal" },
  { key: "pending", label: "Pending", hintColour: "bg-[var(--color-accent-amber)]" },
  { key: "assessed", label: "Assessed", hintColour: "bg-[var(--color-accent-slate)]" },
  { key: "enrolled", label: "Enrolled", hintColour: "bg-[var(--color-accent-emerald)]" },
  { key: "cancelled", label: "Cancelled", hintColour: "bg-gray-300" },
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
    <span className="font-mono text-sm text-ops-muted">
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
    <div className="space-y-6">
      <SectionHeader
        title="ENROLLMENTS"
        subtitle={subtitle}
        accent
        actions={
          canCreate ? (
            <Link
              href={newEnrollmentHref}
              id="new-enrollment-btn"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            >
              <Plus className="h-4 w-4" />
              Enroll Student
            </Link>
          ) : null
        }
      />

      {/* Status pill-tabs */}
      <nav
        aria-label="Filter enrollments by status"
        className="flex flex-wrap gap-1.5 border-b border-gray-200 pb-px"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = filterStatus === tab.key;
          const count =
            tab.key === "all" ? totalAll : countMap[tab.key as EnrollmentStatus] ?? 0;
          const href = createPageHref(1, tab.key);

          return (
            <Link
              key={tab.key}
              href={href}
              id={`filter-${tab.key}`}
              className={cn(
                "group inline-flex items-center gap-2 rounded-t-md px-3.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-b-2 border-[var(--color-primary)] -mb-px bg-white text-ops-ink"
                  : "border-b-2 border-transparent -mb-px text-ops-muted hover:bg-light-gray hover:text-ops-ink"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  tab.hintColour
                )}
              />
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
                  isActive
                    ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                    : "bg-light-gray text-ops-muted group-hover:bg-white"
                )}
              >
                {count.toLocaleString()}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ops-muted">
        <span>
          Showing {showingFrom.toLocaleString()}-{showingTo.toLocaleString()} of{" "}
          {totalFilteredCount.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link
              href={createPageHref(page - 1)}
              className="rounded-md border border-gray-200 px-2.5 py-1 hover:bg-light-gray"
            >
              Previous
            </Link>
          ) : null}
          {hasMore ? (
            <Link
              href={createPageHref(page + 1)}
              className="rounded-md border border-gray-200 px-2.5 py-1 hover:bg-light-gray"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ops-muted"
        />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name, reference (STU-…), or grade level"
          className={editorialFieldClass({ className: "pl-10 font-mono text-sm" })}
        />
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <DataCard className="px-6 py-16 text-center">
          <p className="font-display text-lg font-semibold text-ops-ink">
            No enrollments match this view.
          </p>
          <p className="mt-2 text-sm text-ops-muted">
            {debouncedSearch
              ? `Nothing in this status matches "${debouncedSearch}".`
              : filterStatus === "all"
              ? "Create the first enrollment of the school year to get started."
              : `No enrollments are currently ${filterStatus}.`}
          </p>
          {canCreate && filterStatus === "all" && !debouncedSearch && (
            <Link
              href={newEnrollmentHref}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              Enroll Student
            </Link>
          )}
        </DataCard>
      ) : (
        <div className="grid gap-4">
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

      {debouncedSearch && (
        <p className="text-center font-mono text-xs text-ops-muted">
          Showing {filtered.length.toLocaleString()} of {enrollments.length.toLocaleString()} on this
          page after search
        </p>
      )}
    </div>
  );
}
