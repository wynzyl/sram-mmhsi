import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getSectionsBySchoolYear } from "@/features/academics/sections";
import { SectionsTable } from "@/features/academics/sections";

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
