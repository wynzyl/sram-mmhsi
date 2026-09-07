import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getSectionsBySchoolYear } from "@/features/academics/sections";
import { SectionsTable } from "@/features/academics/sections";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Section Management | SRAMS",
  description: "Manage classroom sections for each grade level and school year",
};

/**
 * Instant navigation - full sections page skeleton shown while data loads.
 */
export default function SectionsPage() {
  return (
    <Suspense fallback={<SectionsSkeleton />}>
      <SectionsContent />
    </Suspense>
  );
}

function SectionsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function SectionsContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:manage")) {
    redirect("/staff/dashboard");
  }

  const [activeSchoolYear, gradeLevels, schoolYears] = await Promise.all([
    getActiveSchoolYear(),
    getGradeLevels(),
    getSchoolYears(),
  ]);

  // Get sections for active school year only
  const sections = activeSchoolYear
    ? await getSectionsBySchoolYear(activeSchoolYear.id)
    : [];

  if (!activeSchoolYear) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Section Management
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Section Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage classroom sections for {activeSchoolYear.label}
        </p>
      </div>

      {/* Card with Table */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="sections-heading"
      >
        <SectionsTable
          sections={sections}
          gradeLevels={gradeLevels}
          schoolYears={schoolYears}
        />
      </section>
    </div>
  );
}
