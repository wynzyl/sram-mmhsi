import Link from "next/link";
import { db } from "@/lib/db";
import { enrollments, gradeLevels, schoolYears, students } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentsTable from "@/features/finance/components/AssessmentsTable";
import PendingAssessmentsQueue from "@/features/assessments/components/PendingAssessmentsQueue";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import {
  getAssessmentsList,
  getAssessmentTabCounts,
  type AssessmentBillingFilter,
} from "@/features/assessments";

const PAGE_SIZE = 20;

/**
 * Valid view parameter values for assessments page.
 */
type AssessmentView =
  | "pending"
  | "unpaid"
  | "outstanding"
  | "paid"
  | "cancelled"
  | "forwarded";

/**
 * Tab configuration for assessments page navigation.
 */
const TABS: {
  view: AssessmentView;
  label: string;
  countKey?: keyof Awaited<ReturnType<typeof getAssessmentTabCounts>>;
}[] = [
  { view: "pending", label: "Fee Assessment Queue" },
  { view: "unpaid", label: "Assessed", countKey: "unpaid" },
  { view: "outstanding", label: "Outstanding", countKey: "outstanding" },
  { view: "paid", label: "Fully Paid", countKey: "paid" },
  { view: "cancelled", label: "Cancelled", countKey: "cancelled" },
  { view: "forwarded", label: "Forwarded Balance", countKey: "forwarded" },
];

/**
 * Subtitles for each tab view.
 */
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

const dateQueued = (d: Date) =>
  d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

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

const btnBase =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted";
const btnActive =
  "border-primary bg-primary/10 text-primary font-semibold";
const btnDisabled = "pointer-events-none opacity-40";

function AssessmentsPagination({
  basePath,
  view,
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  label,
}: {
  basePath: string;
  view: AssessmentView;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  label: string;
}) {
  if (totalCount <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

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
        Showing{" "}
        <span className="font-medium text-foreground">{start}</span> to{" "}
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{" "}
        {label.toLowerCase()}
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

/**
 * Parse and validate view parameter.
 */
function parseViewParam(view?: string): AssessmentView {
  const validViews: AssessmentView[] = [
    "pending",
    "unpaid",
    "outstanding",
    "paid",
    "cancelled",
    "forwarded",
  ];
  if (view && validViews.includes(view as AssessmentView)) {
    return view as AssessmentView;
  }
  return "pending"; // Default to pending (Fee Assessment Queue)
}

/**
 * Map view to billing filter for assessments query.
 */
function viewToBillingFilter(view: AssessmentView): AssessmentBillingFilter | undefined {
  switch (view) {
    case "unpaid":
      return "unpaid";
    case "outstanding":
      return "outstanding";
    case "paid":
      return "paid";
    case "cancelled":
      return "cancelled";
    case "forwarded":
      return "forwarded";
    default:
      return undefined;
  }
}

export async function AssessmentsIndexPage(props: {
  searchParams: Promise<{ view?: string; page?: string }>;
  assessmentsBasePath: "/staff/assessments";
  deniedRedirect: string;
}) {
  const { searchParams, assessmentsBasePath, deniedRedirect } = props;
  const session = await requireSession();

  if (!hasPermission(session.role, "assessments:read")) {
    redirect(deniedRedirect);
  }

  const params = await searchParams;
  const { view: viewParam, page: pageParam } = params;
  const currentView = parseViewParam(viewParam);
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const canCreate = hasPermission(session.role, "assessments:create");
  const canCancel = hasPermission(session.role, "enrollments:cancel");

  // Get counts for all tabs (single query)
  const tabCounts = await getAssessmentTabCounts();

  // Get total count for pending enrollments
  const pendingCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.status, "pending"));
  const pendingTotalCount = Number(pendingCountResult[0]?.count ?? 0);
  const pendingTotalPages = Math.ceil(pendingTotalCount / PAGE_SIZE);

  // Get paginated pending rows (only if on pending tab)
  let pendingData: {
    enrollmentId: string;
    referenceNumber: string;
    studentName: string;
    schoolYear: string;
    gradeLevel: string;
    queuedAtLabel: string;
  }[] = [];

  if (currentView === "pending") {
    const pendingRows = await db
      .select({
        enrollmentId: enrollments.id,
        enrollmentCreatedAt: enrollments.createdAt,
        referenceNumber: students.referenceNumber,
        firstName: students.firstName,
        lastName: students.lastName,
        schoolYear: schoolYears.label,
        gradeLevel: gradeLevels.name,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
      .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
      .where(eq(enrollments.status, "pending"))
      .orderBy(desc(enrollments.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset);

    pendingData = pendingRows.map((r) => ({
      enrollmentId: r.enrollmentId,
      referenceNumber: r.referenceNumber,
      studentName: `${r.lastName}, ${r.firstName}`,
      schoolYear: r.schoolYear,
      gradeLevel: r.gradeLevel,
      queuedAtLabel: dateQueued(r.enrollmentCreatedAt),
    }));
  }

  // Get assessments list (only if not on pending tab)
  const billingFilter = viewToBillingFilter(currentView);
  const assessmentsResult =
    currentView !== "pending"
      ? await getAssessmentsList({
          page: currentPage,
          pageSize: PAGE_SIZE,
          billingFilter,
        })
      : null;

  return (
    <div className="page-container space-y-6">
      <SectionHeader
        size="md"
        accent
        title="Assessments"
        subtitle={SUBTITLES[currentView]}
      />

      <nav className="tab-nav mb-6 flex flex-wrap gap-1" aria-label="Assessment views">
        {TABS.map((tab) => {
          const count =
            tab.view === "pending"
              ? pendingTotalCount
              : tab.countKey
                ? tabCounts[tab.countKey]
                : 0;
          return (
            <Link
              key={tab.view}
              href={`${assessmentsBasePath}?view=${tab.view}`}
              className={`tab-link ${currentView === tab.view ? "tab-link-active" : ""}`}
            >
              {tab.label}
              {count > 0 ? ` (${count})` : ""}
            </Link>
          );
        })}
      </nav>

      {currentView === "pending" ? (
        <>
          <PendingAssessmentsQueue
            rows={pendingData}
            canCreate={canCreate}
            canCancel={canCancel}
            assessmentsBasePath={assessmentsBasePath}
          />
          <AssessmentsPagination
            basePath={assessmentsBasePath}
            view="pending"
            currentPage={currentPage}
            totalPages={pendingTotalPages}
            totalCount={pendingTotalCount}
            pageSize={PAGE_SIZE}
            label="enrollments"
          />
        </>
      ) : assessmentsResult ? (
        <>
          <AssessmentsTable
            assessments={assessmentsResult.data}
            assessmentsBasePath={assessmentsBasePath}
          />
          <AssessmentsPagination
            basePath={assessmentsBasePath}
            view={currentView}
            currentPage={assessmentsResult.pagination.page}
            totalPages={assessmentsResult.pagination.totalPages}
            totalCount={assessmentsResult.pagination.totalRecords}
            pageSize={PAGE_SIZE}
            label="assessments"
          />
        </>
      ) : null}
    </div>
  );
}
