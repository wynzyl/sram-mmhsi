"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
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

  return (
    <div className="page-container--full space-y-6">
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
        {/* Student Ledger is a per-student view of the same assessment data; surfaced
            here as a tab so it no longer needs its own sidebar item. */}
        <Link href="/staff/student-ledgers" className="tab-link">
          Student Ledger
        </Link>
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
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalCount}
            pageSize={PAGE_SIZE}
            baseUrl={buildAssessmentsPaginationBaseUrl(basePath, "pending")}
            itemLabel="enrollments"
          />
        </>
      ) : (
        <>
          <AssessmentsTable assessments={isInitialLoading ? [] : rows} assessmentsBasePath={basePath} />
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalRecords={totalCount}
            pageSize={PAGE_SIZE}
            baseUrl={buildAssessmentsPaginationBaseUrl(basePath, view)}
            itemLabel="assessments"
          />
        </>
      )}
    </div>
  );
}
