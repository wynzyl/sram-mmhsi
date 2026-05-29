import type { StudentDirectoryRow } from "../students.queries";
import { StudentDirectoryRowActions } from "@/features/students/components/StudentDirectoryRowActions";
import { getInitials } from "@/lib/utils/name";

function subtitle(row: StudentDirectoryRow): string {
  const parts: string[] = [];
  if (row.sectionName) parts.push(row.sectionName);
  if (row.schoolYearLabel) parts.push(row.schoolYearLabel);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function StudentDirectoryTable({
  rows,
  emptyMessage,
}: {
  rows: StudentDirectoryRow[];
  emptyMessage: string;
}) {
  const colSpan = 8;

  return (
    <div className="table-wrapper rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <table className="data-table w-full text-left text-sm" id="students-directory-table">
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className="pl-4 font-semibold tracking-wide text-gray-600 dark:text-gray-400">Student</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">ID number</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Grade</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Address</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Tel Number</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Email</th>
            <th className="font-semibold tracking-wide text-gray-600 dark:text-gray-400">Status</th>
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
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-sm font-bold text-primary"
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
                    <code className="reference-code text-[0.8rem]">#{s.referenceNumber}</code>
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
                  <td className="align-middle py-3 text-foreground max-w-[12rem]">
                    <span className="line-clamp-1">{s.email ?? <span className="text-muted-foreground">—</span>}</span>
                  </td>
                  <td className="align-middle py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                        s.isActive
                          ? "bg-blue-500/15 text-blue-600"
                          : "bg-gray-200 dark:bg-gray-800 text-muted-foreground"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" aria-hidden />
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="align-middle py-3 text-right">
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
