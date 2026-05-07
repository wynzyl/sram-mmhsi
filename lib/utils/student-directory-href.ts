export type StudentDirectoryBasePath = "/admin/students" | "/staff/students";

export function studentDirectoryListHref(
  basePath: StudentDirectoryBasePath,
  opts: {
    q?: string;
    schoolYearId?: string;
    gradeLevelId?: string;
    page?: number;
  }
): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.schoolYearId) p.set("schoolYearId", opts.schoolYearId);
  if (opts.gradeLevelId) p.set("gradeLevelId", opts.gradeLevelId);
  if (opts.page != null && opts.page > 1) p.set("page", String(opts.page));
  const s = p.toString();
  return s ? `${basePath}?${s}` : basePath;
}

/** Page indices for numbered pagination (1-based); inserts ellipsis markers between gaps. */
export function studentDirectoryPaginationPages(current: number, total: number): (number | "ellipsis")[] {
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
