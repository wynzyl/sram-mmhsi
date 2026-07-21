import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getSectionsBySchoolYear } from "@/features/academics/sections";
import { SectionsTable } from "@/features/academics/sections";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Section Management | SRAMS",
  description: "Manage classroom sections for each grade level and school year",
};

export default async function SectionsPage() {
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Section Management</h1>
        <p className="text-muted-foreground">
          Manage classroom sections for {activeSchoolYear.label}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <SectionsTable
            sections={sections}
            gradeLevels={gradeLevels}
            schoolYears={schoolYears}
          />
        </CardContent>
      </Card>
    </div>
  );
}
