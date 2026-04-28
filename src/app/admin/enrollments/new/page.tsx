import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, schoolYears, gradeLevels, registrations } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import NewEnrollmentForm from "@/components/enrollments/NewEnrollmentForm";

export const metadata: Metadata = { title: "New Enrollment" };

interface PageProps {
  searchParams: Promise<{ studentId?: string }>;
}

export default async function NewEnrollmentPage({ searchParams }: PageProps) {
  const session = await requireSession();
  if (!hasPermission(session.role, "enrollments:create")) redirect("/admin/enrollments");

  const { studentId } = await searchParams;

  // Fetch all active students for the select
  const allStudents = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      lastName: students.lastName,
      referenceNumber: students.referenceNumber,
    })
    .from(students)
    .where(eq(students.isActive, true))
    .orderBy(asc(students.lastName), asc(students.firstName));

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

  // Pre-select student if provided via query param + fetch their latest approved registration
  let prefillStudent: typeof allStudents[0] | null = null;
  let prefillRegistrationId: string | null = null;
  let prefillSchoolYearId: string | null = null;
  let prefillGradeLevelId: string | null = null;

  if (studentId) {
    prefillStudent = allStudents.find((s) => s.id === studentId) ?? null;

    if (prefillStudent) {
      // Find latest approved registration for pre-filling
      const latestReg = await db
        .select({
          id: registrations.id,
          schoolYearId: registrations.schoolYearId,
          gradeLevelId: registrations.gradeLevelId,
        })
        .from(registrations)
        .where(
          and(
            eq(registrations.studentId, studentId),
            eq(registrations.status, "approved")
          )
        )
        .orderBy(asc(registrations.createdAt))
        .limit(1);

      if (latestReg.length > 0) {
        prefillRegistrationId = latestReg[0].id;
        prefillSchoolYearId = latestReg[0].schoolYearId;
        prefillGradeLevelId = latestReg[0].gradeLevelId;
      }
    }
  }

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Enroll Student</h1>
          <p className="page-subtitle">
            Create a new enrollment record for a registered student.
          </p>
        </div>
      </div>

      <NewEnrollmentForm
        students={allStudents}
        schoolYears={syRows}
        gradeLevels={glRows}
        prefillStudentId={prefillStudent?.id ?? null}
        prefillRegistrationId={prefillRegistrationId}
        prefillSchoolYearId={prefillSchoolYearId}
        prefillGradeLevelId={prefillGradeLevelId}
      />
    </div>
  );
}
