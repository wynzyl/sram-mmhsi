import Link from "next/link";
import {
  studentDirectoryListHref,
  studentDirectoryPaginationPages,
  type StudentDirectoryBasePath,
} from "@/lib/utils/student-directory-href";
import { STUDENT_DIRECTORY_PAGE_SIZE } from "@/lib/queries/students-directory";

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]";
const btnActive =
  "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)] font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

export function StudentDirectoryPagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  q,
  schoolYearId,
  gradeLevelId,
}: {
  basePath: StudentDirectoryBasePath;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  q?: string;
  schoolYearId?: string;
  gradeLevelId?: string;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * STUDENT_DIRECTORY_PAGE_SIZE + 1;
  const end = Math.min(currentPage * STUDENT_DIRECTORY_PAGE_SIZE, totalCount);

  const hrefForPage = (page: number) =>
    studentDirectoryListHref(basePath, {
      q,
      schoolYearId,
      gradeLevelId,
      page: page > 1 ? page : undefined,
    });

  const pages = studentDirectoryPaginationPages(currentPage, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Enrollment list pagination"
    >
      <p className="text-sm text-[var(--color-text-muted)]">
        Showing{" "}
        <span className="font-medium text-[var(--color-text)]">{start}</span> to{" "}
        <span className="font-medium text-[var(--color-text)]">{end}</span> of{" "}
        <span className="font-medium text-[var(--color-text)]">{totalCount.toLocaleString()}</span>{" "}
        enrollment{totalCount !== 1 ? "s" : ""}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {currentPage <= 1 ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
            ← Previous
          </span>
        ) : (
          <Link href={hrefForPage(currentPage - 1)} className={btnBase}>
            ← Previous
          </Link>
        )}

        <div className="flex flex-wrap items-center gap-1">
          {pages.map((item, i) =>
            item === "ellipsis" ? (
              <span
                key={`e-${i}`}
                className="inline-flex min-w-9 items-center justify-center text-[var(--color-text-muted)]"
                aria-hidden
              >
                …
              </span>
            ) : (
              <Link
                key={item}
                href={hrefForPage(item)}
                className={`${btnBase} min-w-9 px-0 ${item === currentPage ? btnActive : ""}`}
                aria-current={item === currentPage ? "page" : undefined}
              >
                {item}
              </Link>
            )
          )}
        </div>

        {currentPage >= totalPages ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
            Next →
          </span>
        ) : (
          <Link href={hrefForPage(currentPage + 1)} className={btnBase}>
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
