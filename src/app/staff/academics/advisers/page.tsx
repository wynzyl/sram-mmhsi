import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYears } from "@/lib/queries/schoolYears";
import {
  getAdviserAssignments,
  getAvailableTeachers,
  getSectionsForAdviserAssignment,
  AdviserTable,
} from "@/features/academics/advisers";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Section Advisers | SRAMS",
  description: "Manage section adviser assignments for each school year",
};

export default async function AdvisersPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Section Advisers
        </h1>
        <p className="text-muted-foreground">
          Assign homeroom advisers to sections for grade entry management
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <AdviserTable
            advisers={advisers}
            sections={sections}
            teachers={teachers}
            schoolYears={schoolYears}
          />
        </CardContent>
      </Card>
    </div>
  );
}
