import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getCoordinatorAssignments,
  getAvailableCoordinators,
  CoordinatorTable,
} from "@/features/academics/coordinators";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Grade Group Coordinators | SRAMS",
  description: "Manage coordinator assignments for grade group reviews",
};

export default async function CoordinatorsPage() {
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
