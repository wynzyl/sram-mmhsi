import Link from "next/link";
import {
  studentDirectoryListHref,
  studentDirectoryPaginationPages,
  STUDENT_DIRECTORY_PAGE_SIZE,
  type StudentDirectoryBasePath,
} from "@/lib/utils/student-directory-href";

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive =
  "border-primary bg-primary/10 text-primary font-semibold";
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
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{" "}
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
