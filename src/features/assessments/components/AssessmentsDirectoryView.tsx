"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TablePagination } from "@/components/ui/TablePagination";
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

/** Build base URL for pagination (includes view param). */
function buildAssessmentsPaginationBaseUrl(basePath: string, view: AssessmentView): string {
  return `${basePath}?view=${view}`;
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

  // Build the subtitle based on view
  const subtitle = typeof SUBTITLES[view] === "string" ? SUBTITLES[view] : null;

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Assessments
        </h1>
        {view === "pending" ? (
          <div className="text-sm text-muted-foreground">
            <strong>Step 1:</strong> pick a student below, then complete the one-time fee assessment.
            <span className="mt-1 block">
              <strong>Step 2:</strong> on the fee form, confirm catalog lines and save—the enrollment becomes{" "}
              <strong>Assessed</strong>. Use other tabs to track payments and balances.
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="assessments-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Badge */}
          <div className="flex items-center gap-3">
            <h2
              id="assessments-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              {view === "pending" ? "Assessment Queue" : `${TABS.find(t => t.view === view)?.label ?? view} Assessments`}
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {totalCount} {view === "pending" ? "Pending" : "Record"}{totalCount !== 1 ? "s" : ""}
            </span>
            {query.isFetching && !isInitialLoading && (
              <span className="text-xs text-muted-foreground" aria-live="polite">
                Refreshing…
              </span>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-border px-4 py-2 bg-muted/30">
          <nav className="flex flex-wrap gap-1" aria-label="Assessment views">
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
            {/* Student Ledger is a per-student view of the same assessment data; surfaced
                here as a tab so it no longer needs its own sidebar item. */}
            <Link href="/staff/student-ledgers" className="tab-link">
              Student Ledger
            </Link>
          </nav>
        </div>

        {/* Content */}
        {query.isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            Failed to load assessments. Please try again.
            <div className="mt-3">
              <button type="button" onClick={() => query.refetch()} className="btn-primary min-h-9 px-4">
                Retry
              </button>
            </div>
          </div>
        ) : view === "pending" ? (
          <PendingAssessmentsQueue
            rows={isInitialLoading ? [] : pendingRows}
            canCreate={canCreate}
            canCancel={canCancel}
            assessmentsBasePath={basePath}
          />
        ) : (
          <AssessmentsTable assessments={isInitialLoading ? [] : rows} assessmentsBasePath={basePath} />
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="border-t border-border px-4 py-3">
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalCount}
              pageSize={PAGE_SIZE}
              baseUrl={buildAssessmentsPaginationBaseUrl(basePath, view)}
              itemLabel={view === "pending" ? "enrollments" : "assessments"}
            />
          </div>
        )}
      </section>
    </div>
  );
}
