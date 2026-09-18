import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getPeriodsForSchoolYear } from "@/features/academics/schedules/queries";
import { PeriodsTable } from "@/features/academics/schedules/components/PeriodsTable";

export const metadata = {
  title: "Period Management | SRAMS",
  description: "Manage class period templates for each school year",
};

export default function PeriodsPage() {
  return (
    <Suspense fallback={<PeriodsSkeleton />}>
      <PeriodsContent />
    </Suspense>
  );
}

function PeriodsSkeleton() {
  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>
      <section className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <div className="bg-muted flex items-center justify-between border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16 ml-auto" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

async function PeriodsContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "schedules:manage_periods")) {
    redirect("/staff/dashboard");
  }

  const [activeSchoolYear, gradeLevels] = await Promise.all([
    getActiveSchoolYear(),
    getGradeLevels(),
  ]);

  const periods = activeSchoolYear
    ? await getPeriodsForSchoolYear(activeSchoolYear.id)
    : [];

  if (!activeSchoolYear) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Period Management
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  return (
    <div className="page-container--full space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Period Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage class period templates for {activeSchoolYear.label}
        </p>
      </div>

      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="periods-heading"
      >
        <PeriodsTable
          periods={periods}
          gradeLevels={gradeLevels}
          activeSchoolYearId={activeSchoolYear.id}
        />
      </section>
    </div>
  );
}
