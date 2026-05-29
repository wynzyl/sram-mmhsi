import Link from "next/link";
import {
  paginationPages,
  PAGINATION_BUTTON_STYLES,
} from "@/lib/utils/pagination";

const { base: btnBase, active: btnActive, disabled: btnDisabled } =
  PAGINATION_BUTTON_STYLES;

export type ServerPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  itemLabel: string;
  itemLabelPlural?: string;
  buildHref: (page: number) => string;
};

export function ServerPagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  itemLabel,
  itemLabelPlural,
  buildHref,
}: ServerPaginationProps) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);
  const plural = itemLabelPlural ?? `${itemLabel}s`;
  const label = totalCount !== 1 ? plural : itemLabel;

  const pages = paginationPages(currentPage, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`${itemLabel} pagination`}
    >
      <p className="text-sm text-muted-foreground">
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{" "}
        {label}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {currentPage <= 1 ? (
          <span className={`${btnBase} ${btnDisabled}`} aria-disabled>
            ← Previous
          </span>
        ) : (
          <Link href={buildHref(currentPage - 1)} className={btnBase}>
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
                href={buildHref(item)}
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
          <Link href={buildHref(currentPage + 1)} className={btnBase}>
            Next →
          </Link>
        )}
      </div>
    </nav>
  );
}
