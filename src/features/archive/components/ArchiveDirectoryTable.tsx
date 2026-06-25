"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CurrencyDisplay } from "@/components/shared/CurrencyDisplay";
import { formatDate } from "@/lib/utils/date";
import { getInitials } from "@/lib/utils/name";
import type { ArchivedStudentRow } from "../archive.queries";

const headClass =
  "font-semibold tracking-wide text-gray-600 dark:text-gray-400";

function formatStudentName(row: ArchivedStudentRow): string {
  const parts = [row.lastName, row.firstName];
  if (row.middleName) {
    parts.push(row.middleName.charAt(0) + ".");
  }
  if (row.suffix) {
    parts.push(row.suffix);
  }
  return parts.join(", ");
}

export function ArchiveDirectoryTable({
  rows,
  emptyMessage = "No archived students found.",
}: {
  rows: ArchivedStudentRow[];
  emptyMessage?: string;
}) {
  const colSpan = 7;

  return (
    <div className="overflow-x-auto">
      <table
        className="data-table w-full text-left text-sm"
        id="archive-directory-table"
      >
        <thead>
          <tr className="border-b border-border bg-muted">
            <th className={`${headClass} pl-4`}>Student</th>
            <th className={headClass}>Reference</th>
            <th className={headClass}>Status</th>
            <th className={headClass}>Last Grade</th>
            <th className={headClass}>Archived</th>
            <th className={headClass}>Balance</th>
            <th className={`${headClass} pr-4`}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-muted/50"
              >
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {getInitials(`${row.firstName} ${row.lastName}`)}
                    </div>
                    <div>
                      <Link
                        href={`/staff/archive/${row.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {formatStudentName(row)}
                      </Link>
                      {row.lastEnrollmentSchoolYear && (
                        <p className="text-xs text-muted-foreground">
                          {row.lastEnrollmentSchoolYear}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <span className="font-mono text-xs">{row.referenceNumber}</span>
                </td>
                <td className="py-3">
                  <StatusBadge status={row.status} type="studentArchive" />
                </td>
                <td className="py-3">
                  <span className="text-sm">
                    {row.lastEnrollmentGradeLevel ?? "—"}
                  </span>
                </td>
                <td className="py-3">
                  {row.archivedAt ? (
                    <div>
                      <span className="text-sm">
                        {formatDate(row.archivedAt)}
                      </span>
                      {row.archivedSchoolYearLabel && (
                        <p className="text-xs text-muted-foreground">
                          SY: {row.archivedSchoolYearLabel}
                        </p>
                      )}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3">
                  {parseFloat(row.outstandingBalance) > 0 ? (
                    <span className="font-medium text-destructive">
                      <CurrencyDisplay amount={parseFloat(row.outstandingBalance)} />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <Link
                    href={`/staff/archive/${row.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
