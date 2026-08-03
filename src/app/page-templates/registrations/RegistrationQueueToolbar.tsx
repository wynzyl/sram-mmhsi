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
    <form method="GET" className="flex items-center gap-2">
      {/* School Year Filter */}
      <select
        id="registrations-school-year"
        name="schoolYearId"
        defaultValue={schoolYearId ?? ""}
        aria-label="Filter by school year"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="form-control min-h-10 w-36 bg-muted text-foreground [&>option]:bg-card [&>option]:text-foreground"
      >
        <option value="">All years</option>
        {schoolYearOptions.map((y) => (
          <option key={y.id} value={y.id}>
            {y.label}
          </option>
        ))}
      </select>

      {/* Clear Filters */}
      {hasFilters && (
        <Link
          href={clearHref}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Clear
        </Link>
      )}

      {/* Action Buttons */}
      {canCreate && (
        <>
          <Link
            href={newStudentHref}
            className="btn-primary min-h-10 px-4 whitespace-nowrap"
            id="new-registration-btn"
          >
            + New Student
          </Link>
          <Link
            href={newTransfereeHref}
            className="btn-secondary min-h-10 px-4 whitespace-nowrap"
            id="new-registration-transferee-btn"
          >
            + Transferee
          </Link>
        </>
      )}
    </form>
  );
}
