import Link from "next/link";
import type { StudentDirectoryRow } from "@/lib/queries/students-directory";
import type { StudentDirectoryBasePath } from "@/lib/utils/student-directory-href";
import { StudentDirectoryTable } from "@/components/students/StudentDirectoryTable";
import { StudentDirectoryPagination } from "@/components/students/StudentDirectoryPagination";

export type StudentDirectoryQuickLink = {
  href: string;
  label: string;
  description: string;
  icon: "register" | "assessments" | "calendar";
};

function QuickLinkIcon({ name }: { name: StudentDirectoryQuickLink["icon"] }) {
  const cls = "h-5 w-5 text-[var(--color-primary)] shrink-0";
  if (name === "register") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" y1="8" x2="20" y2="14" />
        <line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    );
  }
  if (name === "assessments") {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function StudentDirectoryView({
  basePath,
  registerHref,
  canCreate,
  title,
  q,
  schoolYearId,
  gradeLevelId,
  schoolYearOptions,
  gradeLevelOptions,
  rows,
  emptyMessage,
  totalCount,
  totalPages,
  currentPage,
  quickLinks,
}: {
  basePath: StudentDirectoryBasePath;
  registerHref: string;
  canCreate: boolean;
  title: string;
  q: string;
  schoolYearId?: string;
  gradeLevelId?: string;
  schoolYearOptions: { id: string; label: string }[];
  gradeLevelOptions: { id: string; name: string }[];
  rows: StudentDirectoryRow[];
  emptyMessage: string;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  quickLinks: StudentDirectoryQuickLink[];
}) {
  const qTrim = q.trim();
  const qParam = qTrim || undefined;
  const hasFilters = qTrim !== "" || schoolYearId != null || gradeLevelId != null;

  const selectedYearLabel =
    schoolYearId != null ? schoolYearOptions.find((y) => y.id === schoolYearId)?.label : null;
  const selectedGradeLabel =
    gradeLevelId != null ? gradeLevelOptions.find((g) => g.id === gradeLevelId)?.name : null;

  let subtitleFilter = "";
  if (selectedYearLabel && selectedGradeLabel) {
    subtitleFilter = `${selectedYearLabel} · ${selectedGradeLabel}`;
  } else if (selectedYearLabel) {
    subtitleFilter = selectedYearLabel;
  } else if (selectedGradeLabel) {
    subtitleFilter = selectedGradeLabel;
  } else {
    subtitleFilter = "All enrolled school years";
  }

  const clearHref = basePath;

  return (
    <div className="page-container max-w-none space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-text)]">{title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-text-muted)]">
            <span className="text-[var(--color-text-2)]">{subtitleFilter}</span>
            {" · "}
            {totalCount.toLocaleString()} enrollment{totalCount !== 1 ? "s" : ""}{" "}
            {hasFilters ? "matching the current filters." : "on file."}
          </p>
        </div>
        {canCreate && (
          <Link href={registerHref} className="btn-primary shrink-0 self-start" id="register-student-btn">
            + Register Student
          </Link>
        )}
      </div>

      <form
        method="GET"
        role="search"
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-sm)] focus-within:ring-2 focus-within:ring-[var(--color-primary)] focus-within:ring-offset-1 sm:flex-row sm:flex-wrap sm:items-stretch"
      >
        <div className="flex min-w-0 flex-1 items-stretch rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 sm:min-w-[14rem]">
          <span className="flex items-center pl-3 pr-2 text-[var(--color-text-muted)] pointer-events-none">
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
            name="q"
            className="min-h-11 flex-1 bg-transparent py-2 pr-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none"
            placeholder="Search student records by name or reference…"
            defaultValue={q}
            autoComplete="off"
          />
        </div>

        <select
          name="schoolYearId"
          defaultValue={schoolYearId ?? ""}
          aria-label="Filter by school year"
          className="input-editorial min-h-11 min-w-0 shrink-0 sm:min-w-[11rem] sm:max-w-[14rem]"
        >
          <option value="">All school years</option>
          {schoolYearOptions.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>

        <select
          name="gradeLevelId"
          defaultValue={gradeLevelId ?? ""}
          aria-label="Filter by grade level"
          className="input-editorial min-h-11 min-w-0 shrink-0 sm:min-w-[10rem] sm:max-w-[12rem]"
        >
          <option value="">All grades</option>
          {gradeLevelOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {hasFilters && (
            <Link
              href={clearHref}
              className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Clear filters
            </Link>
          )}
          <button type="submit" className="btn-primary min-h-11 px-6">
            Search
          </button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
          >
            <QuickLinkIcon name={link.icon} />
            <div className="min-w-0">
              <p className="font-display font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                {link.label}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{link.description}</p>
            </div>
          </Link>
        ))}
      </div>

      <section className="space-y-4" aria-labelledby="roster-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            id="roster-heading"
            className="font-display text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]"
          >
            Active student roster
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Export CSV is not available yet."
              className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-xs font-semibold text-[var(--color-text-muted)] cursor-not-allowed opacity-70"
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

        <StudentDirectoryTable
          rows={rows}
          emptyMessage={emptyMessage}
        />

        <StudentDirectoryPagination
          basePath={basePath}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          q={qParam}
          schoolYearId={schoolYearId}
          gradeLevelId={gradeLevelId}
        />
      </section>

      <p className="text-center text-[0.7rem] text-[var(--color-text-subtle)] pb-2">
        Confidential institutional data. Authorized access only.
      </p>
    </div>
  );
}
