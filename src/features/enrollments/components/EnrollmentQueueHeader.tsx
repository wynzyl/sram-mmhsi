"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type GradeLevel = {
  id: string;
  name: string;
};

type EnrollmentQueueHeaderProps = {
  basePath: string;
  gradeLevels: GradeLevel[];
  schoolYearLabel: string;
  totalCount: number;
  canCreate: boolean;
};

/**
 * Unified header for Enrollment Queue page matching Student Directory style.
 * Combines title + subtitle (left) with filters + action button (right).
 * Uses uncontrolled inputs with form submission (matching StudentDirectoryView pattern).
 */
export default function EnrollmentQueueHeader({
  basePath,
  gradeLevels,
  schoolYearLabel,
  totalCount,
  canCreate,
}: EnrollmentQueueHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read filter values from URL
  const currentSearch = searchParams.get("search") ?? "";
  const currentGradeLevel = searchParams.get("gradeLevel") ?? "";
  const currentTab = searchParams.get("tab") ?? "ready-to-enroll";

  // Determine if any filters are active
  const hasFilters = currentSearch !== "" || currentGradeLevel !== "";

  // Get selected grade label for subtitle
  const selectedGradeLabel = currentGradeLevel
    ? gradeLevels.find((g) => g.id === currentGradeLevel)?.name
    : null;

  // Build dynamic subtitle
  let subtitleFilter = schoolYearLabel;
  if (selectedGradeLabel) {
    subtitleFilter += ` · ${selectedGradeLabel}`;
  }

  /**
   * Handle form submit - pushes filters to URL
   */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const nextSearch = (form.get("search") as string | null)?.trim() || undefined;
    const nextGrade = (form.get("gradeLevel") as string | null) || undefined;

    const params = new URLSearchParams();
    if (currentTab) params.set("tab", currentTab);
    if (nextSearch) params.set("search", nextSearch);
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
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      {/* Left: Title + Subtitle */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          Enrollment Queue
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          <span className="text-gray-600 dark:text-gray-400">{subtitleFilter}</span>
          {" · "}
          {totalCount.toLocaleString()} enrollment{totalCount !== 1 ? "s" : ""}{" "}
          {hasFilters ? "matching the current filters." : "in this tab."}
        </p>
      </div>

      {/* Right: Filters + Action Button */}
      <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
        <form
          key={searchParams.toString()}
          onSubmit={handleSubmit}
          role="search"
          className="flex flex-col gap-2 sm:flex-row sm:items-center focus-within:[&_input]:outline-none"
        >
          {/* Search Input */}
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
              id="enrollment-search"
              type="search"
              name="search"
              className="min-h-10 flex-1 bg-transparent py-2 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="Search by name or ID..."
              defaultValue={currentSearch}
              autoComplete="off"
            />
          </div>

          {/* Grade Level Dropdown */}
          <div className="w-full sm:w-40 sm:flex-none">
            <select
              name="gradeLevel"
              defaultValue={currentGradeLevel}
              aria-label="Filter by grade level"
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="form-control min-h-10 w-full bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="">All grades</option>
              {gradeLevels.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Link */}
          {hasFilters && (
            <Link
              href={getClearHref()}
              className="inline-flex min-h-10 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </Link>
          )}

          {/* Manual Entry Button */}
          {canCreate && (
            <Link
              href={`${basePath}/new`}
              className="btn-primary min-h-10 px-4 shrink-0"
              id="manual-entry-btn"
            >
              + Manual Entry
            </Link>
          )}
        </form>
      </div>
    </div>
  );
}
