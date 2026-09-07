import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getCoordinatorAssignments,
  getAvailableCoordinators,
  CoordinatorTable,
} from "@/features/academics/coordinators";
import { Card, CardContent } from "@/components/ui/card";

// Instant navigation enabled - uses Suspense for streaming

export const metadata = {
  title: "Grade Group Coordinators | SRAMS",
  description: "Manage coordinator assignments for grade group reviews",
};

/**
 * Instant navigation - full coordinators page skeleton shown while data loads.
 */
export default function CoordinatorsPage() {
  return (
    <Suspense fallback={<CoordinatorsSkeleton />}>
      <CoordinatorsContent />
    </Suspense>
  );
}

function CoordinatorsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 mt-2" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-20 ml-auto" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function CoordinatorsContent() {
  const session = await requireSession();

  if (!hasPermission(session.role, "assignments:manage")) {
    redirect("/staff/dashboard");
  }

  const schoolYears = await getSchoolYears();
  const activeSchoolYear = schoolYears.find((sy) => sy.isActive);

  const [coordinators, availableCoordinators] = await Promise.all([
    getCoordinatorAssignments(activeSchoolYear?.id),
    getAvailableCoordinators(),
  ]);

  const schoolYearOptions = schoolYears.map((sy) => ({
    id: sy.id,
    label: sy.label,
    isActive: sy.isActive,
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Grade Group Coordinators
        </h1>
        <p className="text-muted-foreground">
          Assign coordinators to review grade sheet submissions for each grade group
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <CoordinatorTable
            coordinators={coordinators}
            availableCoordinators={availableCoordinators}
            schoolYears={schoolYearOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
