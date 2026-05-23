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
import { getAssessmentsList } from "@/features/assessments";

const PAGE_SIZE = 20;

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
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]";
const btnActive =
  "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)] text-[var(--color-primary)] font-semibold";
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
  view: "pending" | "ledgers";
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
      <p className="text-sm text-[var(--color-text-muted)]">
        Showing{" "}
        <span className="font-medium text-[var(--color-text)]">{start}</span> to{" "}
        <span className="font-medium text-[var(--color-text)]">{end}</span> of{" "}
        <span className="font-medium text-[var(--color-text)]">{totalCount.toLocaleString()}</span>{" "}
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
  const { view, page: pageParam } = params;
  const tab = view === "ledgers" ? "ledgers" : "pending";
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10));
  const offset = (currentPage - 1) * PAGE_SIZE;

  const canCreate = hasPermission(session.role, "assessments:create");
  const canCancel = hasPermission(session.role, "enrollments:cancel");

  // Get total count for pending enrollments
  const pendingCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(enrollments)
    .where(eq(enrollments.status, "pending"));
  const pendingTotalCount = Number(pendingCountResult[0]?.count ?? 0);
  const pendingTotalPages = Math.ceil(pendingTotalCount / PAGE_SIZE);

  // Get paginated pending rows
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

  const pendingData = pendingRows.map((r) => ({
    enrollmentId: r.enrollmentId,
    referenceNumber: r.referenceNumber,
    studentName: `${r.lastName}, ${r.firstName}`,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    queuedAtLabel: dateQueued(r.enrollmentCreatedAt),
  }));

  // Use paginated query for assessments ledgers
  const assessmentsResult = await getAssessmentsList({
    page: currentPage,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="page-container space-y-6">
      <SectionHeader
        size="md"
        accent
        title="Assessments"
        subtitle={
          tab === "pending" ? (
            <>
              <strong>Step 1:</strong> pick a student below, then complete the one-time fee assessment.
              <span className="mt-1 block text-sm text-warm-gray">
                <strong>Step 2:</strong> on the fee form, confirm catalog lines and save—the enrollment becomes{" "}
                <strong>Assessed</strong>. Use <strong>Assessment ledgers</strong> for payments and balances.
              </span>
            </>
          ) : (
            "Open a ledger to post payments, view OR history, and track outstanding balances after fee assessment."
          )
        }
      />

      <nav className="tab-nav mb-6" aria-label="Assessment views">
        <Link
          href={`${assessmentsBasePath}?view=pending`}
          className={`tab-link ${tab === "pending" ? "tab-link-active" : ""}`}
        >
          Fee assessment queue
          {pendingTotalCount > 0 ? ` (${pendingTotalCount})` : ""}
        </Link>
        <Link
          href={`${assessmentsBasePath}?view=ledgers`}
          className={`tab-link ${tab === "ledgers" ? "tab-link-active" : ""}`}
        >
          Assessment ledgers
        </Link>
      </nav>

      {tab === "pending" ? (
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
      ) : (
        <>
          <AssessmentsTable assessments={assessmentsResult.data} assessmentsBasePath={assessmentsBasePath} />
          <AssessmentsPagination
            basePath={assessmentsBasePath}
            view="ledgers"
            currentPage={assessmentsResult.pagination.page}
            totalPages={assessmentsResult.pagination.totalPages}
            totalCount={assessmentsResult.pagination.totalRecords}
            pageSize={PAGE_SIZE}
            label="assessments"
          />
        </>
      )}
    </div>
  );
}
