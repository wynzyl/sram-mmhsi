import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { registrations, students, schoolYears, gradeLevels } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import RegistrationsTable from "@/components/registrations/RegistrationsTable";

export const metadata: Metadata = {
  title: "Registrations",
  description: "View all student registrations.",
};

export default async function RegistrationsPage() {
  const session = await requireSession();
  if (!hasPermission(session.role, "registrations:read")) redirect("/admin/dashboard");

  const rows = await db
    .select({
      id: registrations.id,
      createdAt: registrations.createdAt,
      studentId: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
      schoolYear: schoolYears.label,
      gradeLevel: gradeLevels.name,
    })
    .from(registrations)
    .innerJoin(students, eq(registrations.studentId, students.id))
    .innerJoin(schoolYears, eq(registrations.schoolYearId, schoolYears.id))
    .innerJoin(gradeLevels, eq(registrations.gradeLevelId, gradeLevels.id))
    .orderBy(desc(registrations.createdAt))
    .limit(200);

  const tableData = rows.map((r) => ({
    id: r.id,
    studentName: `${r.lastName}, ${r.firstName}`,
    referenceNumber: r.referenceNumber,
    schoolYear: r.schoolYear,
    gradeLevel: r.gradeLevel,
    createdAt: r.createdAt,
  }));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Registrations</h1>
          <p className="page-subtitle">
            Separate applicant/registrar pipeline. New master students are created under Students;
            this list only shows rows created through the registrations workflow.
          </p>
        </div>
        {hasPermission(session.role, "students:create") && (
          <Link href="/admin/students/new" className="btn-primary" id="new-registration-btn">
            + Register Student
          </Link>
        )}
      </div>

      <RegistrationsTable registrations={tableData} />
    </div>
  );
}
