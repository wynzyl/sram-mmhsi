import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import {
  getElectiveSubjects,
  getElectivesByStrand,
  ElectivesByStrandView,
} from "@/features/academics/electives";

export const metadata = {
  title: "Elective Subjects | SRAMS",
  description: "View and manage SHS elective subjects by strand",
};

export default async function ElectivesPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "curriculums:read")) {
    redirect("/staff/dashboard");
  }

  const activeSchoolYear = await getActiveSchoolYear();

  if (!activeSchoolYear) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Elective Subjects
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  const [allElectives, electivesByStrand] = await Promise.all([
    getElectiveSubjects({ schoolYearId: activeSchoolYear.id }),
    getElectivesByStrand({ schoolYearId: activeSchoolYear.id }),
  ]);

  const sectionsOffering = allElectives.reduce((sum, e) => sum + e.sectionOfferingCount, 0);
  const studentsEnrolled = allElectives.reduce((sum, e) => sum + e.studentEnrollmentCount, 0);

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-figure">
          Elective Subjects
        </h1>
        <p className="text-sm text-muted-foreground">
          SHS elective subjects organized by strand for {activeSchoolYear.label}
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="electives-heading"
      >
        {/* Card Header with gradient effect */}
        <div className="bg-muted flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + Stats Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <h2
              id="electives-heading"
              className="font-display text-xs font-bold uppercase tracking-[0.14em] text-primary"
            >
              Electives by Strand
            </h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
              {allElectives.length} Subject{allElectives.length !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-info/10 text-info border border-info/30">
              {electivesByStrand.length} Strand{electivesByStrand.length !== 1 ? "s" : ""}
            </span>
            {sectionsOffering > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/30">
                {sectionsOffering} Section{sectionsOffering !== 1 ? "s" : ""} Offering
              </span>
            )}
            {studentsEnrolled > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/30">
                {studentsEnrolled} Enrolled
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {allElectives.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No elective subjects found for the current school year.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Elective subjects are defined in curriculums with isCore = false.
              </p>
            </div>
          ) : (
            <ElectivesByStrandView
              electivesByStrand={electivesByStrand}
              allElectives={allElectives}
            />
          )}
        </div>
      </section>
    </div>
  );
}
