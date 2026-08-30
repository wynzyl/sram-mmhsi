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
