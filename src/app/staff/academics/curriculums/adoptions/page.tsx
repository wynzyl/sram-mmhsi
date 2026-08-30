import { z } from "zod";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAdoptionMatrix,
  getPublishedCurriculumsForDropdown,
  getLockedGradeLevelsForSchoolYear,
} from "@/features/academics/curriculums/curriculums.queries";
import { AdoptionMatrix } from "@/features/academics/curriculums/components";

interface AdoptionsPageProps {
  searchParams: Promise<{ schoolYearId?: string }>;
}

export default async function CurriculumAdoptionsPage({
  searchParams,
}: AdoptionsPageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:adopt")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

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
