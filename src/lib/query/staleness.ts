/**
 * School-year-aware freshness policy for TanStack Query.
 *
 * Live operational data (enrollment, assessments, payments, student records)
 * for the ACTIVE school year must always reflect the latest state, so it is
 * treated as perpetually stale (`staleTime: 0`) and refetched aggressively.
 *
 * Historical (non-active) school years rarely change, so they use a long
 * stale window to avoid needless refetches and a bounded gc window so old
 * data doesn't linger in memory.
 */

/** Current year: always considered stale → refetch on mount / focus. */
const CURRENT_YEAR_STALE_TIME = 0;

/** Past years: trust cached data for 30 minutes before refetching. */
const ARCHIVED_STALE_TIME = 30 * 60 * 1000;

/** Past years: drop unused cache entries after 1 hour. */
const ARCHIVED_GC_TIME = 60 * 60 * 1000;

export type SchoolYearFreshness = {
  staleTime: number;
  gcTime?: number;
  refetchOnWindowFocus: boolean;
  refetchOnMount: boolean;
};

/**
 * Returns TanStack Query freshness options based on whether a query targets
 * the active school year.
 *
 * A `null`/`undefined` target means the caller defaulted to the active year
 * (the directory does this when no `schoolYearId` is in the URL), so it is
 * treated as current — fresh. When the active id is not yet known on the
 * client, we also default to fresh: the worst case is one extra refetch.
 */
export function schoolYearFreshness(
  targetSchoolYearId: string | null | undefined,
  activeSchoolYearId: string | null | undefined
): SchoolYearFreshness {
  const isCurrent =
    !targetSchoolYearId ||
    !activeSchoolYearId ||
    targetSchoolYearId === activeSchoolYearId;

  if (isCurrent) {
    return {
      staleTime: CURRENT_YEAR_STALE_TIME,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    };
  }

  return {
    staleTime: ARCHIVED_STALE_TIME,
    gcTime: ARCHIVED_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  };
}

/**
 * Freshness policy for financial data (payments, assessments).
 *
 * Financial reads must always reflect the latest state, so these queries are
 * never served stale: `staleTime: 0` plus refetch on mount and window focus.
 * This is deduping + live invalidation, NOT stale serving. Financial queries
 * are also never cached server-side (`"use cache"`).
 */
export function financialFreshness() {
  return {
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  } as const;
}
