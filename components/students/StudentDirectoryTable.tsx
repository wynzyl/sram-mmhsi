import type { StudentDirectoryRow } from "@/lib/queries/students-directory";
import type { StudentDirectoryBasePath } from "@/lib/utils/student-directory-href";
import { StudentDirectoryRowActions } from "@/components/students/StudentDirectoryRowActions";

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "?";
}

function subtitle(row: StudentDirectoryRow): string {
  const parts: string[] = [];
  if (row.sectionName) parts.push(row.sectionName);
  if (row.schoolYearLabel) parts.push(row.schoolYearLabel);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function StudentDirectoryTable({
  rows,
  emptyMessage,
  studentBasePath = "/staff/students",
}: {
  rows: StudentDirectoryRow[];
  emptyMessage: string;
  studentBasePath?: StudentDirectoryBasePath;
}) {
  const colSpan = 8;

  return (
    <div className="table-wrapper rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="students-directory-table">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Student</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">ID number</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Grade</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Address</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Tel Number</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Email</th>
            <th className="font-semibold tracking-wide text-[var(--color-text-2)]">Status</th>
            <th className="w-px text-right font-semibold tracking-wide text-[var(--color-text-2)]" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="table-empty px-6 py-12 text-center text-[var(--color-text-muted)]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((s) => {
              const displayName = `${s.firstName} ${s.lastName}`;
              return (
                <tr
                  key={s.enrollmentId}
                  className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]/80"
                >
                  <td className="align-middle py-3 pr-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-primary)_14%,var(--color-surface))] font-display text-sm font-bold text-[var(--color-primary)]"
                        aria-hidden
                      >
                        {initials(s.firstName, s.lastName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[var(--color-text)]">{displayName}</p>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">{subtitle(s)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="align-middle py-3">
                    <code className="reference-code text-[0.8rem]">#{s.referenceNumber}</code>
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)]">
                    {s.gradeLevelName ?? <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)] max-w-[14rem]">
                    <span className="line-clamp-1">{s.address ?? <span className="text-[var(--color-text-muted)]">—</span>}</span>
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)]">
                    {s.telNumber ?? <span className="text-[var(--color-text-muted)]">—</span>}
                  </td>
                  <td className="align-middle py-3 text-[var(--color-text)] max-w-[12rem]">
                    <span className="line-clamp-1">{s.email ?? <span className="text-[var(--color-text-muted)]">—</span>}</span>
                  </td>
                  <td className="align-middle py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        s.isActive
                          ? "bg-[color-mix(in_srgb,var(--color-info)_18%,transparent)] text-[var(--color-info)]"
                          : "bg-[var(--color-surface-3)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="align-middle py-3 text-right">
                    <StudentDirectoryRowActions studentId={s.id} studentBasePath={studentBasePath} />
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
