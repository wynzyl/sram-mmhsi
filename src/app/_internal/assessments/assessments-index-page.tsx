import Link from "next/link";
import { db } from "@/lib/db";
import { enrollments, gradeLevels, schoolYears, students } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac/permissions";
import AssessmentsTable from "@/components/finance/AssessmentsTable";
import PendingAssessmentsQueue from "@/components/assessments/PendingAssessmentsQueue";
import { SectionHeader } from "@/components/ui/editorial/SectionHeader";
import { getAssessmentsList } from "@/lib/queries/assessments";
import { Pagination } from "@/components/ui/Pagination";

const dateQueued = (d: Date) =>
  d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });

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

  const canCreate = hasPermission(session.role, "assessments:create");

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
    .orderBy(desc(enrollments.createdAt));

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
    pageSize: 25,
  });

  return (
    <div className="page-container max-w-7xl">
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
          {pendingData.length ? ` (${pendingData.length})` : ""}
        </Link>
        <Link
          href={`${assessmentsBasePath}?view=ledgers`}
          className={`tab-link ${tab === "ledgers" ? "tab-link-active" : ""}`}
        >
          Assessment ledgers
        </Link>
      </nav>

      {tab === "pending" ? (
        <PendingAssessmentsQueue
          rows={pendingData}
          canCreate={canCreate}
          assessmentsBasePath={assessmentsBasePath}
        />
      ) : (
        <>
          <AssessmentsTable assessments={assessmentsResult.data} assessmentsBasePath={assessmentsBasePath} />
          {assessmentsResult.pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={assessmentsResult.pagination.page}
                totalPages={assessmentsResult.pagination.totalPages}
                baseUrl={`${assessmentsBasePath}?view=ledgers`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
