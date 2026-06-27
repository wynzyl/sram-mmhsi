import Link from "next/link";
import {
  studentDirectoryListHref,
  studentDirectoryPaginationPages,
  STUDENT_DIRECTORY_PAGE_SIZE,
  type StudentDirectoryBasePath,
  type StudentSortBy,
  type StudentSortDir,
} from "@/lib/utils/student-directory-href";

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive =
  "border-primary bg-primary/10 text-primary font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

export function StudentDirectoryPagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  q,
  gradeLevelId,
  sortBy,
  sortDir,
}: {
  basePath: StudentDirectoryBasePath;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  q?: string;
  gradeLevelId?: string;
  sortBy?: StudentSortBy;
  sortDir?: StudentSortDir;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * STUDENT_DIRECTORY_PAGE_SIZE + 1;
  const end = Math.min(currentPage * STUDENT_DIRECTORY_PAGE_SIZE, totalCount);

  const hrefForPage = (page: number) =>
    studentDirectoryListHref(basePath, {
      q,
      gradeLevelId,
      sortBy,
      sortDir,
      page: page > 1 ? page : undefined,
    });

  const pages = studentDirectoryPaginationPages(currentPage, totalPages);
  const atStart = currentPage <= 1;
  const atEnd = currentPage >= totalPages;

  return (
    <nav
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Enrollment list pagination"
    >
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{" "}
        entr{totalCount !== 1 ? "ies" : "y"}
      </p>

      <div className="flex flex-wrap items-center gap-1">
        {atStart ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled aria-label="First page">
            «
          </span>
        ) : (
          <Link href={hrefForPage(1)} className={btnBase} aria-label="First page">
            «
          </Link>
        )}
        {atStart ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled aria-label="Previous page">
            ‹
          </span>
        ) : (
          <Link href={hrefForPage(currentPage - 1)} className={btnBase} aria-label="Previous page">
            ‹
          </Link>
        )}

        {pages.map((item, i) =>
          item === "ellipsis" ? (
            <span
              key={`e-${i}`}
              className="inline-flex min-w-9 items-center justify-center text-muted-foreground"
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

        {atEnd ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled aria-label="Next page">
            ›
          </span>
        ) : (
          <Link href={hrefForPage(currentPage + 1)} className={btnBase} aria-label="Next page">
            ›
          </Link>
        )}
        {atEnd ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled aria-label="Last page">
            »
          </span>
        ) : (
          <Link href={hrefForPage(totalPages)} className={btnBase} aria-label="Last page">
            »
          </Link>
        )}
      </div>
    </nav>
  );
}
