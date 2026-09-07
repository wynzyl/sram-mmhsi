import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import {
  getStudentsForSectionAssignment,
  getSectionsWithCounts,
  SectionAssignmentTable,
} from "@/features/academics/section-assignments";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Section Assignments | SRAMS",
  description: "Assign students to sections within their grade level",
};

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    gradeLevelId?: string;
    sectionStatus?: string;
  }>;
}

/**
 * Instant navigation - full section assignments skeleton shown while data loads.
 */
export default function SectionAssignmentsPage({ searchParams }: PageProps) {
  return (
    <Suspense fallback={<SectionAssignmentsSkeleton />}>
      <SectionAssignmentsContent searchParams={searchParams} />
    </Suspense>
  );
}

function SectionAssignmentsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-72" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function SectionAssignmentsContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:assign")) {
    redirect("/staff/dashboard");
  }

  // Get school year - default to active if not specified
  const [schoolYears, activeSchoolYear, gradeLevels] = await Promise.all([
    getSchoolYears(),
    getActiveSchoolYear(),
    getGradeLevels(),
  ]);

  const schoolYearId = params.schoolYearId || activeSchoolYear?.id;

  if (!schoolYearId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Section Assignments
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  // Get students and sections for the selected school year
  const [students, sections] = await Promise.all([
    getStudentsForSectionAssignment({
      schoolYearId,
      gradeLevelId: params.gradeLevelId,
      sectionStatus: params.sectionStatus,
    }),
    getSectionsWithCounts(schoolYearId),
  ]);

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Section Assignments
        </h1>
        <p className="text-sm text-muted-foreground">
          Assign enrolled students to sections within their grade level
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="assignments-heading"
      >
        <SectionAssignmentTable
          students={students}
          sections={sections}
          schoolYears={schoolYears}
          gradeLevels={gradeLevels}
          initialSchoolYearId={schoolYearId}
          initialGradeLevelId={params.gradeLevelId}
          initialSectionStatus={params.sectionStatus}
        />
      </section>
    </div>
  );
}
