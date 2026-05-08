import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { sections, schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getEnrollmentQueueData } from "@/lib/queries/enrollment-queue";
import { EnrollmentQueueTabs } from "@/components/enrollments/EnrollmentQueueTabs";
import { EnrollmentGlobalFilters } from "@/components/enrollments/EnrollmentGlobalFilters";
import { ReadyToEnrollTableClient } from "@/components/enrollments/ReadyToEnrollTableClient";
import {
  PendingEnrollmentsTable,
  AssessedEnrollmentsTable,
  EnrolledStudentsTable,
  CancelledEnrollmentsTable,
} from "@/components/enrollments/EnrollmentStatusTables";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw, FileText } from "lucide-react";

type TabKey = "ready-to-enroll" | "pending" | "assessed" | "enrolled" | "cancelled";

type EnrollmentQueuePageProps = {
  searchParams: Promise<{ tab?: string; search?: string; gradeLevel?: string }>;
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

  // Permissions
  const canCreate = hasPermission(session.role, "enrollments:create");
  const canConfirm = hasPermission(session.role, "enrollments:confirm" as any) || canCreate;

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

  // Fetch enrollment queue data, sections, and grade levels in parallel
  const [queueData, allSections, allGradeLevels] = await Promise.all([
    getEnrollmentQueueData(),
    db
      .select({ id: sections.id, name: sections.name, gradeLevelId: sections.gradeLevelId })
      .from(sections)
      .where(eq(sections.schoolYearId, activeSchoolYear.id)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name })
      .from(gradeLevels)
      .orderBy(gradeLevels.order),
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

  const { readyToEnroll, pending, assessed, enrolled, cancelled } = queueData;

  // Prepare tab counts
  const tabCounts = {
    readyToEnroll: readyToEnroll.length,
    pending: pending.length,
    assessed: assessed.length,
    enrolled: enrolled.length,
    cancelled: cancelled.length,
  };

  // Render current tab content
  const renderTabContent = () => {
    switch (currentTab) {
      case "ready-to-enroll":
        return (
          <ReadyToEnrollTableClient
            students={readyToEnroll}
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
            enrollments={pending}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
          />
        );

      case "assessed":
        return (
          <AssessedEnrollmentsTable
            enrollments={assessed}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
          />
        );

      case "enrolled":
        return (
          <EnrolledStudentsTable
            students={enrolled}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
          />
        );

      case "cancelled":
        return (
          <CancelledEnrollmentsTable
            enrollments={cancelled}
            basePath={staffBasePath}
            searchQuery={searchQuery}
            gradeLevelFilter={gradeLevelFilter}
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
