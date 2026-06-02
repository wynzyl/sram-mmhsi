"use client";

import Link from "next/link";

interface SchoolYearOption {
  id: string;
  label: string;
}

interface RegistrationQueueToolbarProps {
  schoolYearOptions: SchoolYearOption[];
  schoolYearId: string | undefined;
  hasFilters: boolean;
  clearHref: string;
  newStudentHref: string;
  newTransfereeHref: string;
  canCreate: boolean;
}

export function RegistrationQueueToolbar({
  schoolYearOptions,
  schoolYearId,
  hasFilters,
  clearHref,
  newStudentHref,
  newTransfereeHref,
  canCreate,
}: RegistrationQueueToolbarProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
      <form
        method="GET"
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
      >
        <div className="w-full sm:w-48 sm:flex-none">
          <select
            id="registrations-school-year"
            name="schoolYearId"
            defaultValue={schoolYearId ?? ""}
            aria-label="Filter by school year"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="form-control min-h-10 w-full bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
          >
            <option value="">All school years</option>
            {schoolYearOptions.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <Link
            href={clearHref}
            className="inline-flex min-h-10 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </Link>
        )}

        {canCreate && (
          <>
            <Link
              href={newStudentHref}
              className="btn-primary min-h-10 px-4 shrink-0"
              id="new-registration-btn"
            >
              + New student
            </Link>
            <Link
              href={newTransfereeHref}
              className="btn-secondary min-h-10 px-4 shrink-0"
              id="new-registration-transferee-btn"
            >
              + Transferee
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
