"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import AssessmentsTable from "@/features/finance/components/AssessmentsTable";
import PendingAssessmentsQueue from "@/features/assessments/components/PendingAssessmentsQueue";
import { useAssessments, type AssessmentView } from "@/features/assessments/hooks/use-assessments";

const PAGE_SIZE = 20;

type AssessmentsBasePath = "/staff/assessments";

const TABS: {
  view: AssessmentView;
  label: string;
  countKey?: "unpaid" | "outstanding" | "paid" | "cancelled" | "forwarded";
}[] = [
  { view: "pending", label: "Fee Assessment Queue" },
  { view: "unpaid", label: "Assessed", countKey: "unpaid" },
  { view: "outstanding", label: "Outstanding", countKey: "outstanding" },
  { view: "paid", label: "Fully Paid", countKey: "paid" },
  { view: "cancelled", label: "Cancelled", countKey: "cancelled" },
  { view: "forwarded", label: "Forwarded Balance", countKey: "forwarded" },
];

const SUBTITLES: Record<AssessmentView, React.ReactNode> = {
  pending: (
    <>
      <strong>Step 1:</strong> pick a student below, then complete the one-time fee assessment.
      <span className="mt-1 block text-sm text-muted-foreground">
        <strong>Step 2:</strong> on the fee form, confirm catalog lines and save—the enrollment becomes{" "}
        <strong>Assessed</strong>. Use other tabs to track payments and balances.
      </span>
    </>
  ),
  unpaid: "Students assessed but awaiting first payment.",
  outstanding: "Students with partial payments and remaining balance.",
  paid: "Students who have completed all payments.",
  cancelled: "Cancelled assessments.",
  forwarded: "Balances forwarded to the next school year.",
};

const VALID_VIEWS: AssessmentView[] = [
  "pending",
  "unpaid",
  "outstanding",
  "paid",
  "cancelled",
  "forwarded",
];

function parseView(value: string | null): AssessmentView {
  return value && VALID_VIEWS.includes(value as AssessmentView)
    ? (value as AssessmentView)
    : "pending";
}

/** Page indices for numbered pagination (1-based); inserts ellipsis markers between gaps. */
function paginationPages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

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

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive = "border-primary bg-primary/10 text-primary font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

function AssessmentsPagination({
  basePath,
  view,
  currentPage,
  totalPages,
  totalCount,
  label,
}: {
  basePath: string;
  view: AssessmentView;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  label: string;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, totalCount);

  const hrefForPage = (page: number) => {
    const p = new URLSearchParams();
    p.set("view", view);
    if (page > 1) p.set("page", String(page));
    return `${basePath}?${p.toString()}`;
  };

  const pages = paginationPages(currentPage, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label={`${label} pagination`}
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> {label.toLowerCase()}
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
              <span key={`e-${i}`} className="inline-flex min-w-9 items-center justify-center text-muted-foreground" aria-hidden>
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

export function AssessmentsDirectoryView({ basePath }: { basePath: AssessmentsBasePath }) {
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const currentPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const query = useAssessments({ view, page: currentPage });
  const data = query.data;

  const tabCounts = data?.tabCounts ?? { unpaid: 0, outstanding: 0, paid: 0, cancelled: 0, forwarded: 0 };
  const pendingCount = data?.pendingCount ?? 0;
  const rows = data?.rows ?? [];
  const pendingRows = data?.pendingRows ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const canCreate = data?.canCreate ?? false;
  const canCancel = data?.canCancel ?? false;

  const isInitialLoading = query.isLoading;

  return (
    <div className="page-container space-y-6">
      <SectionHeader size="md" accent title="Assessments" subtitle={SUBTITLES[view]} />

      <nav className="tab-nav mb-6 flex flex-wrap gap-1" aria-label="Assessment views">
        {TABS.map((tab) => {
          const count = tab.view === "pending" ? pendingCount : tab.countKey ? tabCounts[tab.countKey] : 0;
          return (
            <Link
              key={tab.view}
              href={`${basePath}?view=${tab.view}`}
              className={`tab-link ${view === tab.view ? "tab-link-active" : ""}`}
            >
              {tab.label}
              {count > 0 ? ` (${count})` : ""}
            </Link>
          );
        })}
      </nav>

      {query.isFetching && !isInitialLoading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Refreshing…
        </p>
      )}

      {query.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Failed to load assessments. Please try again.
          <div className="mt-3">
            <button type="button" onClick={() => query.refetch()} className="btn-primary min-h-9 px-4">
              Retry
            </button>
          </div>
        </div>
      ) : view === "pending" ? (
        <>
          <PendingAssessmentsQueue
            rows={isInitialLoading ? [] : pendingRows}
            canCreate={canCreate}
            canCancel={canCancel}
            assessmentsBasePath={basePath}
          />
          <AssessmentsPagination
            basePath={basePath}
            view="pending"
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            label="enrollments"
          />
        </>
      ) : (
        <>
          <AssessmentsTable assessments={isInitialLoading ? [] : rows} assessmentsBasePath={basePath} />
          <AssessmentsPagination
            basePath={basePath}
            view={view}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            label="assessments"
          />
        </>
      )}
    </div>
  );
}
