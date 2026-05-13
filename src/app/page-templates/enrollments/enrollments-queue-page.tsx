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
  type ReadyToEnrollStudent,
  type PendingEnrollment,
  type AssessedEnrollment,
  type EnrolledStudent,
  type CancelledEnrollment,
} from "@/features/enrollments/enrollments-queue.queries";
import type { PaginationParams, PaginatedResult } from "@/lib/types/pagination";
import { unstable_cache } from "next/cache";
import { EnrollmentQueueTabs } from "@/features/enrollments";
import { EnrollmentGlobalFilters } from "@/features/enrollments";
import { ReadyToEnrollTableClient } from "@/features/enrollments";
import {
  PendingEnrollmentsTable,
  AssessedEnrollmentsTable,
  EnrolledStudentsTable,
  CancelledEnrollmentsTable,
} from "@/features/enrollments";
import { Button } from "@/components/ui/button";
import { RefreshCw, FileText } from "lucide-react";

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
  // canConfirm will be used for enrollment actions in table (future use)
  const _canConfirm = hasPermission(session.role, "enrollments:confirm") || canCreate;

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

  // Create cached version of counts (5-minute TTL)
  const getCachedTabCounts = unstable_cache(
    async () => getEnrollmentQueueCounts(),
    ["enrollment-queue-counts", activeSchoolYear.id],
    { revalidate: 300 } // 5 minutes
  );

  // Fetch current tab data, sections, grade levels, and tab counts in parallel
  // MEMORY OPTIMIZATION: Only fetch data for the CURRENT tab, not all 5 tabs
  const [queueData, allSections, allGradeLevels, tabCountsData] = await Promise.all([
    getEnrollmentQueueData(currentTab, paginationParams),
    db
      .select({ id: sections.id, name: sections.name, gradeLevelId: sections.gradeLevelId })
      .from(sections)
      .where(eq(sections.schoolYearId, activeSchoolYear.id)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .orderBy(gradeLevels.order),
    getCachedTabCounts(),
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

  // Render current tab content with pagination
  const renderTabContent = () => {
    switch (currentTab) {
      case "ready-to-enroll":
        return (
          <ReadyToEnrollTableClient
            paginatedData={queueData as PaginatedResult<ReadyToEnrollStudent>}
            schoolYearId={activeSchoolYear.id}
            sections={allSections.map((s) => ({ id: s.id, name: s.name }))}
            gradeLevels={allGradeLevels}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
            basePath={enrollmentsBasePath}
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
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
            Enrollment Management
          </p>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight text-charcoal">
            Enrollment Queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            List-first enrollment workflow. Students automatically appear in the queue when eligible.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <form>
            <Button variant="secondary" size="sm" type="submit" className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </form>

          {/* Manual Entry Link (for edge cases) */}
          {canCreate && (
            <Link href={`${enrollmentsBasePath}/new`}>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Manual Entry
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Global Filters */}
      <EnrollmentGlobalFilters gradeLevels={allGradeLevels} basePath={enrollmentsBasePath} />

      {/* Tabs Navigation */}
      <EnrollmentQueueTabs
        counts={tabCounts}
        currentTab={currentTab}
        basePath={enrollmentsBasePath}
      />

      {/* Tab Content */}
      <div className="mt-6">{renderTabContent()}</div>

      {/* Legacy Link */}
      <div className="mt-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
        <p className="text-xs text-[var(--color-text-muted)]">
          <strong>Note:</strong> This is the new list-first enrollment queue. If you need to manually create an
          enrollment record, use the{" "}
          <Link
            href={`${enrollmentsBasePath}/new`}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            manual entry form
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
