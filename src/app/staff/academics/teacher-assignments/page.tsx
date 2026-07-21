import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { getSchoolYears, getActiveSchoolYear } from "@/lib/queries/schoolYears";
import { getAvailableTeachers } from "@/features/academics/advisers/advisers.queries";
import {
  getAllTeacherAssignments,
  getSubjectsForAssignment,
  getSectionsForAssignment,
} from "@/features/academics/grades/grades.queries";
import { TeacherAssignmentsTable } from "@/features/academics/teacher-assignments/components/TeacherAssignmentsTable";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Teacher Assignments | SRAMS",
  description: "Manage teacher subject and section assignments for each school year",
};

export default async function TeacherAssignmentsPage() {
  const session = await requireSession();

  if (!hasPermission(session.role, "assignments:manage")) {
    redirect("/staff/dashboard");
  }

  const [schoolYears, activeSchoolYear] = await Promise.all([
    getSchoolYears(),
    getActiveSchoolYear(),
  ]);

  if (!activeSchoolYear) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-4">
          Teacher Assignments
        </h1>
        <p className="text-muted-foreground">
          No active school year found. Please configure school years first.
        </p>
      </div>
    );
  }

  const [assignments, teachers, subjects, sections] = await Promise.all([
    getAllTeacherAssignments(activeSchoolYear.id),
    getAvailableTeachers(),
    getSubjectsForAssignment(activeSchoolYear.id),
    getSectionsForAssignment(activeSchoolYear.id),
  ]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Teacher Assignments
        </h1>
        <p className="text-muted-foreground">
          Assign teachers to subjects and sections for grade encoding
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <TeacherAssignmentsTable
            assignments={assignments}
            teachers={teachers}
            subjects={subjects}
            sections={sections}
            schoolYears={schoolYears}
          />
        </CardContent>
      </Card>
    </div>
  );
}
