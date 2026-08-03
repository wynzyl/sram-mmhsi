import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getGradeLevels } from "@/lib/queries/gradeLevels";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import {
  getStudentsForSectionAssignment,
  getSectionsWithCounts,
  SectionAssignmentTable,
} from "@/features/academics/section-assignments";

export const metadata = {
  title: "Section Assignments | SRAMS",
  description: "Assign students to sections within their grade level",
};

interface PageProps {
  searchParams: Promise<{
    schoolYearId?: string;
    gradeLevelId?: string;
    sectionStatus?: string;
  }>;
}

export default async function SectionAssignmentsPage({ searchParams }: PageProps) {
  const session = await requireSession();

  if (!hasPermission(session.role, "sections:assign")) {
    redirect("/staff/dashboard");
  }

  const params = await searchParams;

  // Get school year - default to active if not specified
  const [schoolYears, activeSchoolYear, gradeLevels] = await Promise.all([
    getSchoolYears(),
    getActiveSchoolYear(),
    getGradeLevels(),
  ]);

  const schoolYearId = params.schoolYearId || activeSchoolYear?.id;

  if (!schoolYearId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Section Assignments
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  // Get students and sections for the selected school year
  const [students, sections] = await Promise.all([
    getStudentsForSectionAssignment({
      schoolYearId,
      gradeLevelId: params.gradeLevelId,
      sectionStatus: params.sectionStatus,
    }),
    getSectionsWithCounts(schoolYearId),
  ]);

  return (
    <div className="page-container--full space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground italic">
          Section Assignments
        </h1>
        <p className="text-sm text-muted-foreground">
          Assign enrolled students to sections within their grade level
        </p>
      </div>

      {/* Card with Embedded Controls */}
      <section
        className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
        aria-labelledby="assignments-heading"
      >
        <SectionAssignmentTable
          students={students}
          sections={sections}
          schoolYears={schoolYears}
          gradeLevels={gradeLevels}
          initialSchoolYearId={schoolYearId}
          initialGradeLevelId={params.gradeLevelId}
          initialSectionStatus={params.sectionStatus}
        />
      </section>
    </div>
  );
}
