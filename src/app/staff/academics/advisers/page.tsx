import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAdviserAssignments,
  getAvailableTeachers,
  getSectionsForAdviserAssignment,
  AdviserTable,
} from "@/features/academics/advisers";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Section Advisers | SRAMS",
  description: "Manage section adviser assignments for each school year",
};

/**
 * Instant navigation - full advisers page skeleton shown while data loads.
 */
export default function AdvisersPage() {
  return (
    <Suspense fallback={<AdvisersSkeleton />}>
      <AdvisersContent />
    </Suspense>
  );
}

function AdvisersSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-8 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function AdvisersContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "advisers:manage")) {
    redirect("/staff/dashboard");
  }

  const schoolYears = await getSchoolYears();
  const activeSchoolYear = schoolYears.find((sy) => sy.isActive);

  const [advisers, teachers, sections] = await Promise.all([
    getAdviserAssignments(activeSchoolYear?.id),
    getAvailableTeachers(),
    activeSchoolYear
      ? getSectionsForAdviserAssignment(activeSchoolYear.id)
      : Promise.resolve([]),
  ]);

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Section Advisers
        </h1>
        <p className="text-sm text-muted-foreground">
          Assign homeroom advisers to sections for grade entry management
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="advisers-heading"
      >
        {/* Table with embedded header */}
        <AdviserTable
          advisers={advisers}
          sections={sections}
          teachers={teachers}
          schoolYears={schoolYears}
        />
      </section>
    </div>
  );
}
