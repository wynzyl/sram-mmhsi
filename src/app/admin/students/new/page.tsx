import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { schoolYears, gradeLevels } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import StudentForm from "@/components/students/StudentForm";

export const metadata: Metadata = {
  title: "Register New Student",
};

export default async function NewStudentPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "students:create")) redirect("/admin/students");

  const [syRows, glRows] = await Promise.all([
    db
      .select({ id: schoolYears.id, label: schoolYears.label, isActive: schoolYears.isActive })
      .from(schoolYears)
      .orderBy(asc(schoolYears.startDate)),
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name, order: gradeLevels.order })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
  ]);

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Register New Student</h1>
          <p className="page-subtitle">
            Fill in the student details and assign at least one guardian.
          </p>
        </div>
      </div>

      {syRows.length === 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>No school years configured.</strong> Please ask an admin to create a school year
          before registering students.
        </div>
      )}

      {glRows.length === 0 && (
        <div className="alert alert-warning" role="alert">
          <strong>No grade levels configured.</strong> Please ask an admin to create grade levels
          before registering students.
        </div>
      )}

      <StudentForm schoolYears={syRows} gradeLevels={glRows} />
    </div>
  );
}
