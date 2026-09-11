import { Suspense } from "react";
import { requireStaffSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getAllSections } from "@/features/academics/sections/sections.queries";
import {
  getDirectorsList,
  getAvailableGradingPeriods,
} from "@/features/academics/directors-list/directors-list.queries";
import {
  DirectorsListTable,
  DirectorsListFilters,
} from "@/features/academics/directors-list/components";
import { GRADING_PERIOD_LABELS } from "@/lib/constants/grading-periods";
import type { GradingPeriod } from "@/lib/constants/grading-periods";
import { Award } from "lucide-react";

// Instant navigation enabled - uses Suspense for streaming

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    gradingPeriod?: string;
    gradeLevelId?: string;
    sectionId?: string;
  }>;
}

export default function DirectorsListPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Award className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Director&apos;s List</h1>
          <p className="text-sm text-muted-foreground">
            Students with outstanding academic performance
          </p>
        </div>
      </div>

      <Suspense fallback={<DirectorsListSkeleton />}>
        <DirectorsListContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function DirectorsListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-[140px]" />
          </div>
        ))}
        <div className="flex items-end gap-2">
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Summary skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-9 w-[300px]" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function DirectorsListContent({
  searchParams,
}: {
  searchParams: Promise<{
    schoolYearId?: string;
    gradingPeriod?: string;
    gradeLevelId?: string;
    sectionId?: string;
  }>;
}) {
  const session = await requireStaffSession();

  // Check permission
  if (!hasPermission(session.role, "grades:read")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

  // Fetch reference data in parallel
  const [schoolYears, gradeLevels, activeSY, sectionsData] = await Promise.all([
    getSchoolYears(),
    getGradeLevels(),
    getActiveSchoolYear(),
    getAllSections(),
  ]);

  // Determine school year
  const schoolYearId = params.schoolYearId || activeSY?.id;
  if (!schoolYearId) {
    return (
      <div className="rounded-lg border border-border bg-warning-tint p-6 text-center">
        <p className="text-warning font-medium">No active school year found.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Please contact the administrator to configure a school year.
        </p>
      </div>
    );
  }

  // Get grading periods for this school year
  const gradingPeriods = await getAvailableGradingPeriods(schoolYearId);
  const gradingPeriod = params.gradingPeriod || gradingPeriods[0]?.value || "Q1";

  // Fetch Director's List data
  const result = await getDirectorsList({
    schoolYearId,
    gradingPeriod,
    gradeLevelId: params.gradeLevelId,
    sectionId: params.sectionId,
  });

  // Transform sections for filter dropdown
  const sections = sectionsData.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  // Transform school years for filter dropdown
  const schoolYearOptions = schoolYears.map((sy) => ({
    id: sy.id,
    label: sy.label,
    isActive: sy.isActive,
  }));

  // Transform grade levels for filter dropdown
  const gradeLevelOptions = gradeLevels.map((gl) => ({
    id: gl.id,
    name: gl.name,
  }));

  const gradingPeriodLabel = GRADING_PERIOD_LABELS[gradingPeriod as GradingPeriod] || gradingPeriod;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <DirectorsListFilters
        schoolYears={schoolYearOptions}
        gradeLevels={gradeLevelOptions}
        sections={sections}
        gradingPeriods={gradingPeriods}
        defaults={{
          schoolYearId,
          gradingPeriod,
          gradeLevelId: params.gradeLevelId,
          sectionId: params.sectionId,
        }}
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Qualifying"
          value={result.summary.totalQualifying}
        />
        <SummaryCard
          label="Elementary"
          value={
            result.summary.byGradeGroup.casa +
            result.summary.byGradeGroup.lower_elem +
            result.summary.byGradeGroup.higher_elem
          }
          subtitle="92+ GWA"
        />
        <SummaryCard
          label="Junior High"
          value={result.summary.byGradeGroup.jhs}
          subtitle="92+ GWA"
        />
        <SummaryCard
          label="Senior High"
          value={result.summary.byGradeGroup.shs}
          subtitle="90+ GWA"
        />
      </div>

      {/* Period Info */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <span className="text-sm font-medium text-foreground">
            {gradingPeriodLabel}
          </span>
          <span className="text-muted-foreground mx-2">·</span>
          <span className="text-sm text-muted-foreground">
            {result.filters.schoolYearLabel}
          </span>
          {result.filters.gradeLevelName && (
            <>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-sm text-muted-foreground">
                {result.filters.gradeLevelName}
              </span>
            </>
          )}
          {result.filters.sectionName && (
            <>
              <span className="text-muted-foreground mx-2">·</span>
              <span className="text-sm text-muted-foreground">
                {result.filters.sectionName}
              </span>
            </>
          )}
        </div>
        {result.summary.topPerformer && (
          <div className="text-sm">
            <span className="text-muted-foreground">Top GWA:</span>{" "}
            <span className="font-semibold text-primary">
              {result.summary.topPerformer.gwa.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <DirectorsListTable entries={result.entries} />
      </div>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  subtitle?: string;
}

function SummaryCard({ label, value, subtitle }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}
