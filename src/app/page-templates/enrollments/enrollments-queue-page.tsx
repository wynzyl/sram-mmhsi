import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { sections, schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  getEnrollmentQueueData,
  getEnrollmentQueueCounts,
  type TabKey,
  type ReadyToEnrollListRow,
  type PendingEnrollment,
  type AssessedEnrollment,
  type EnrolledStudent,
  type CancelledEnrollment,
} from "@/features/enrollments/enrollments-queue.queries";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import {
  EnrollmentQueueTabs,
  EnrollmentQueueHeader,
  ReadyToEnrollTableClient,
  PendingEnrollmentsTable,
  AssessedEnrollmentsTable,
  EnrolledStudentsTable,
  CancelledEnrollmentsTable,
} from "@/features/enrollments";

type EnrollmentQueuePageProps = {
  searchParams: Promise<{
    tab?: string;
    search?: string;
    gradeLevel?: string;
    page?: string;
    pageSize?: string;
  }>;
  deniedRedirect: string;
  enrollmentsBasePath: string; // e.g., "/staff/enrollments"
  staffBasePath: string; // e.g., "/staff"
};

/**
 * Get the current tab from search params (server-side version)
 */
function getCurrentTabFromParams(tab: string | undefined): TabKey {
  if (
    tab === "ready-to-enroll" ||
    tab === "pending" ||
    tab === "assessed" ||
    tab === "enrolled" ||
    tab === "cancelled"
  ) {
    return tab;
  }
  return "ready-to-enroll"; // default
}

export async function EnrollmentQueuePage(props: EnrollmentQueuePageProps) {
  const { searchParams, deniedRedirect, enrollmentsBasePath, staffBasePath } = props;

  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:read")) redirect(deniedRedirect);

  const params = await searchParams;
  const currentTab = getCurrentTabFromParams(params.tab);
  const searchQuery = params.search || "";
  const gradeLevelFilter = params.gradeLevel || "";

  // Parse pagination params with defaults
  const page = parseInt(params.page || "1", 10);
  const pageSize = parseInt(params.pageSize || "25", 10);

  const paginationParams: PaginationParams = {
    page: Math.max(1, page), // Ensure page >= 1
    pageSize: Math.min(Math.max(10, pageSize), 100), // Clamp between 10-100
  };

  // Permissions
  const canCreate = hasPermission(session.role, "enrollments:create");
  // Fetch active school year
  const [activeSchoolYear] = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  if (!activeSchoolYear) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">No Active School Year</h2>
          <p className="mt-2 text-sm text-amber-800">
            An active school year must be configured before you can manage enrollments. Please contact your
            system administrator or activate a school year in the system settings.
          </p>
        </div>
      </div>
    );
  }

  // Fetch current tab data, sections, grade levels, and tab counts in parallel
  // MEMORY OPTIMIZATION: Only fetch data for the CURRENT tab, not all 5 tabs
  // NOTE: getEnrollmentQueueCounts is already wrapped in unstable_cache (tag: 'enrollments')
  // Server-side filters (F5): search + grade filter apply across ALL pages.
  const queueFilters = {
    search: searchQuery || undefined,
    gradeLevelId:
      gradeLevelFilter && gradeLevelFilter !== "all" ? gradeLevelFilter : undefined,
  };

  const [queueData, allSections, allGradeLevels, tabCountsData] = await Promise.all([
    getEnrollmentQueueData(currentTab, paginationParams, queueFilters),
    db
      .select({ id: sections.id, name: sections.name, gradeLevelId: sections.gradeLevelId })
      .from(sections)
      .where(eq(sections.schoolYearId, activeSchoolYear.id)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .orderBy(gradeLevels.order),
    getEnrollmentQueueCounts(),
  ]);

  if (!queueData) {
    return (
      <div className="page-container">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
          <h2 className="text-lg font-semibold text-amber-900">Error Loading Queue</h2>
          <p className="mt-2 text-sm text-amber-800">
            Unable to load enrollment queue data. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  // Use cached tab counts (fallback to 0 if cache fails)
  const tabCounts = {
    readyToEnroll: tabCountsData?.readyToEnroll ?? 0,
    pending: tabCountsData?.pending ?? 0,
    assessed: tabCountsData?.assessed ?? 0,
    enrolled: tabCountsData?.enrolled ?? 0,
    cancelled: tabCountsData?.cancelled ?? 0,
  };

  // Get total count for the current tab (used in header subtitle)
  function getCurrentTabCount(tab: TabKey): number {
    switch (tab) {
      case "ready-to-enroll":
        return tabCounts.readyToEnroll;
      case "pending":
        return tabCounts.pending;
      case "assessed":
        return tabCounts.assessed;
      case "enrolled":
        return tabCounts.enrolled;
      case "cancelled":
        return tabCounts.cancelled;
      default:
        return 0;
    }
  }

  // Render current tab content with pagination
  const renderTabContent = () => {
    switch (currentTab) {
      case "ready-to-enroll":
        return (
          <ReadyToEnrollTableClient
            paginatedData={queueData as PaginatedResult<ReadyToEnrollListRow>}
            schoolYearId={activeSchoolYear.id}
            sections={allSections.map((s) => ({ id: s.id, name: s.name }))}
            gradeLevels={allGradeLevels}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
          />
        );

      case "pending":
        return (
          <PendingEnrollmentsTable
            paginatedData={queueData as PaginatedResult<PendingEnrollment>}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
            enrollmentsBasePath={enrollmentsBasePath}
            currentTab={currentTab}
          />
        );

      case "assessed":
        return (
          <AssessedEnrollmentsTable
            paginatedData={queueData as PaginatedResult<AssessedEnrollment>}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
            enrollmentsBasePath={enrollmentsBasePath}
            currentTab={currentTab}
          />
        );

      case "enrolled":
        return (
          <EnrolledStudentsTable
            paginatedData={queueData as PaginatedResult<EnrolledStudent>}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
            enrollmentsBasePath={enrollmentsBasePath}
            currentTab={currentTab}
          />
        );

      case "cancelled":
        return (
          <CancelledEnrollmentsTable
            paginatedData={queueData as PaginatedResult<CancelledEnrollment>}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
            enrollmentsBasePath={enrollmentsBasePath}
            currentTab={currentTab}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-container--full space-y-6">
      {/* Clean Page Header - Title + Subtitle Only */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Enrollment Queue
        </h1>
        <p className="text-sm text-muted-foreground">
          {activeSchoolYear.label} • {getCurrentTabCount(currentTab).toLocaleString()} Enrollment{getCurrentTabCount(currentTab) !== 1 ? "s" : ""} in this tab
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        {/* Card Header - Inline Controls */}
        <EnrollmentQueueHeader
          basePath={enrollmentsBasePath}
          gradeLevels={allGradeLevels}
          totalCount={getCurrentTabCount(currentTab)}
          canCreate={canCreate}
        />

        {/* Tabs Navigation - Inside Card */}
        <EnrollmentQueueTabs
          counts={tabCounts}
          currentTab={currentTab}
          basePath={enrollmentsBasePath}
        />

        {/* Tab Content */}
        <div>{renderTabContent()}</div>
      </section>

      {/* Legacy Link */}
      <p className="text-center text-[0.7rem] text-muted-foreground pb-2">
        Need manual entry?{" "}
        <Link
          href={`${enrollmentsBasePath}/new`}
          className="font-medium text-primary hover:underline"
        >
          Create enrollment manually
        </Link>
        . Confidential institutional data.
      </p>
    </div>
  );
}
