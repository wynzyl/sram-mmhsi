import Link from "next/link";
import type { StudentDirectoryRow } from "../students.queries";
import { StudentDirectoryRowActions } from "@/features/students/components/StudentDirectoryRowActions";
import { getInitials } from "@/lib/utils/name";
import type { StudentSortBy, StudentSortDir } from "@/lib/utils/student-directory-href";

export type StudentDirectoryActiveSort = { by: StudentSortBy; dir: StudentSortDir } | null;

function subtitle(row: StudentDirectoryRow): string {
  const parts: string[] = [];
  if (row.sectionName) parts.push(row.sectionName);
  if (row.schoolYearLabel) parts.push(row.schoolYearLabel);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

const headClass = "font-semibold tracking-wide text-gray-600 dark:text-gray-400";

function SortChevron({ state }: { state: "asc" | "desc" | "none" }) {
  // Active direction uses primary; inactive uses a muted double-arrow.
  if (state === "none") {
    return (
      <span className="text-muted-foreground/50" aria-hidden>
        ↕
      </span>
    );
  }
  return (
    <span className="text-primary" aria-hidden>
      {state === "asc" ? "▲" : "▼"}
    </span>
  );
}

function SortableHeader({
  column,
  label,
  activeSort,
  sortHref,
  className,
}: {
  column: StudentSortBy;
  label: string;
  activeSort: StudentDirectoryActiveSort;
  sortHref: (by: StudentSortBy) => string;
  className?: string;
}) {
  const isActive = activeSort?.by === column;
  const state: "asc" | "desc" | "none" = isActive ? activeSort!.dir : "none";
  return (
    <th className={`${headClass} ${className ?? ""}`}>
      <Link
        href={sortHref(column)}
        prefetch={false}
        className="group inline-flex items-center gap-1.5 rounded transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        aria-label={`Sort by ${label}`}
        aria-sort={isActive ? (state === "asc" ? "ascending" : "descending") : "none"}
      >
        {label}
        <SortChevron state={state} />
      </Link>
    </th>
  );
}

export function StudentDirectoryTable({
  rows,
  emptyMessage,
  activeSort,
  sortHref,
}: {
  rows: StudentDirectoryRow[];
  emptyMessage: string;
  activeSort: StudentDirectoryActiveSort;
  sortHref: (by: StudentSortBy) => string;
}) {
  const colSpan = 7;

  return (
    <div className="overflow-x-auto">
      <table className="data-table w-full text-left text-sm" id="students-directory-table">
        <thead>
          <tr className="border-b border-border bg-muted">
            <SortableHeader
              column="name"
              label="Student"
              activeSort={activeSort}
              sortHref={sortHref}
              className="pl-4"
            />
            <th className={headClass}>Student ID</th>
            <th className={headClass}>Grade</th>
            <th className={headClass}>Address</th>
            <SortableHeader
              column="tel"
              label="Tel Number"
              activeSort={activeSort}
              sortHref={sortHref}
            />
            <SortableHeader
              column="status"
              label="Status"
              activeSort={activeSort}
              sortHref={sortHref}
            />
            <th className="w-px text-right font-semibold tracking-wide text-gray-600 dark:text-gray-400" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((s) => {
              const displayName = `${s.firstName} ${s.lastName}`;
              return (
                <tr
                  key={s.enrollmentId}
                  className="border-b border-border last:border-b-0 transition-colors hover:bg-muted/80"
                >
                  <td className="align-middle py-3 pl-4 pr-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar circle with gradient */}
                      <div
                        className="avatar-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold"
                        aria-hidden
                      >
                        {getInitials(s.firstName, s.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{subtitle(s)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle py-3">
                    {/* Student ID with purple pill style */}
                    <span className="reference-pill">{s.referenceNumber}</span>
                  </td>
                  <td className="align-middle py-3 text-foreground">
                    {s.gradeLevelName ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="align-middle py-3 text-foreground max-w-[14rem]">
                    <span className="line-clamp-1">{s.address ?? <span className="text-muted-foreground">—</span>}</span>
                  </td>
                  <td className="align-middle py-3 text-foreground">
                    {s.telNumber ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="align-middle py-3">
                    {/* Status badge with glow effect for active */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        s.isActive
                          ? "bg-success/15 text-success badge-glow-success"
                          : "bg-gray-200 dark:bg-gray-800 text-muted-foreground"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="align-middle py-3 text-right pr-2">
                    <StudentDirectoryRowActions studentId={s.id} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
