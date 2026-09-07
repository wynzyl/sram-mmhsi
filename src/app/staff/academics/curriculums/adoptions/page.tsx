import { z } from "zod";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAdoptionMatrix,
  getPublishedCurriculumsForDropdown,
  getLockedGradeLevelsForSchoolYear,
} from "@/features/academics/curriculums/curriculums.queries";
import { AdoptionMatrix } from "@/features/academics/curriculums/components";

// Instant navigation enabled - uses Suspense for streaming

interface AdoptionsPageProps {
  searchParams: Promise<{ schoolYearId?: string }>;
}

/**
 * Instant navigation - full adoptions matrix skeleton shown while data loads.
 */
export default function CurriculumAdoptionsPage({
  searchParams,
}: AdoptionsPageProps) {
  return (
    <Suspense fallback={<AdoptionsSkeleton />}>
      <AdoptionsContent searchParams={searchParams} />
    </Suspense>
  );
}

function AdoptionsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function AdoptionsContent({
  searchParams,
}: AdoptionsPageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:adopt")) {
    redirect("/staff/dashboard");
  }

  // Fetch school years for selector
  const schoolYears = await getSchoolYears();

  if (schoolYears.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-warning-tint border border-warning/25 rounded-lg p-6 text-center">
          <p className="text-warning">
            No school years configured. Please create a school year first.
          </p>
        </div>
      </div>
    );
  }

  // Validate the requested school year (reject malformed UUIDs) and fall back
  // to the active year (or the first available) so the displayed and queried
  // years always match.
  const requestedYearId = z
    .string()
    .uuid()
    .safeParse(params.schoolYearId).data;
  const activeYear = schoolYears.find((sy) => sy.isActive);
  const requestedYear = requestedYearId
    ? schoolYears.find((sy) => sy.id === requestedYearId)
    : undefined;
  const selectedSchoolYear = requestedYear ?? activeYear ?? schoolYears[0];
  const selectedYearId = selectedSchoolYear.id;

  // Fetch data in parallel
  const [matrixCells, curriculumOptions, lockedGradeLevels] = await Promise.all([
    getAdoptionMatrix(selectedYearId),
    getPublishedCurriculumsForDropdown(),
    getLockedGradeLevelsForSchoolYear(selectedYearId),
  ]);

  // Map school years for the selector
  const schoolYearOptions = schoolYears.map((sy) => ({
    id: sy.id,
    label: sy.label,
    isActive: sy.isActive,
  }));

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Curriculum Adoptions
        </h1>
        <p className="text-sm text-muted-foreground">
          Assign published curriculums to grade levels for each school year
        </p>
      </div>

      {/* Adoption Matrix */}
      <AdoptionMatrix
        matrixCells={matrixCells}
        curriculumOptions={curriculumOptions}
        schoolYears={schoolYearOptions}
        selectedSchoolYear={{
          id: selectedSchoolYear.id,
          label: selectedSchoolYear.label,
          isActive: selectedSchoolYear.isActive,
        }}
        lockedGradeLevels={lockedGradeLevels}
      />
    </div>
  );
}
