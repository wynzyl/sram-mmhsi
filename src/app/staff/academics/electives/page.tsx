import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getActiveSchoolYear } from "@/lib/queries/schoolYears";
import {
  getElectiveSubjects,
  getElectivesByStrand,
  ElectivesByStrandView,
} from "@/features/academics/electives";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Elective Subjects
          </h1>
          <p className="text-muted-foreground">
            SHS elective subjects organized by strand for {activeSchoolYear.label}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Electives</CardDescription>
            <CardTitle className="text-3xl">{allElectives.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Strands</CardDescription>
            <CardTitle className="text-3xl">{electivesByStrand.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sections Offering</CardDescription>
            <CardTitle className="text-3xl">
              {allElectives.reduce((sum, e) => sum + e.sectionOfferingCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Students Enrolled</CardDescription>
            <CardTitle className="text-3xl">
              {allElectives.reduce((sum, e) => sum + e.studentEnrollmentCount, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elective Subjects by Strand</CardTitle>
          <CardDescription>
            View elective subjects available for each SHS strand. Subjects marked with * are required (strand core) for that strand.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
