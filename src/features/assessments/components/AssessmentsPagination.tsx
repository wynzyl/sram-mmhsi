import Link from "next/link";

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]";
const btnActive =
  "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)] font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

/** Generate page numbers with ellipsis markers for pagination. */
function paginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const set = new Set<number>();
  set.add(1);
  set.add(total);
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }

  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("ellipsis");
    out.push(n);
    prev = n;
  }
  return out;
}

function assessmentsListHref(
  basePath: string,
  opts: { page?: number }
): string {
  const p = new URLSearchParams();
  p.set("view", "ledgers");
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  return `${basePath}?${p.toString()}`;
}

export function AssessmentsPagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  const hrefForPage = (page: number) =>
    assessmentsListHref(basePath, {
      page: page > 1 ? page : undefined,
    });

  const pages = paginationPages(currentPage, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Assessment ledgers pagination"
    >
      <p className="text-sm text-[var(--color-text-muted)]">
        Showing{" "}
        <span className="font-medium text-[var(--color-text)]">{start}</span> to{" "}
        <span className="font-medium text-[var(--color-text)]">{end}</span> of{" "}
        <span className="font-medium text-[var(--color-text)]">{totalCount.toLocaleString()}</span>{" "}
        assessment{totalCount !== 1 ? "s" : ""}
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
