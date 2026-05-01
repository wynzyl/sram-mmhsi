import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { eq, asc, desc } from "drizzle-orm";
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

  let prefillStudent: (typeof allStudents)[0] | null = null;
  let prefillSchoolYearId: string | null = null;
  let prefillGradeLevelId: string | null = null;

  if (studentId) {
    prefillStudent = allStudents.find((s) => s.id === studentId) ?? null;

    if (prefillStudent) {
      const latestEn = await db
        .select({
          schoolYearId: enrollments.schoolYearId,
          gradeLevelId: enrollments.gradeLevelId,
        })
        .from(enrollments)
        .where(eq(enrollments.studentId, studentId))
        .orderBy(desc(enrollments.createdAt))
        .limit(1);

      if (latestEn.length > 0) {
        prefillSchoolYearId = latestEn[0].schoolYearId;
        prefillGradeLevelId = latestEn[0].gradeLevelId;
      }
    }
  }

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Enroll Student</h1>
          <p className="page-subtitle">
            Place the student into a school year and grade at <strong>Pending</strong> until fees are
            assessed.
          </p>
        </div>
      </div>

      <NewEnrollmentForm
        students={allStudents}
        schoolYears={syRows}
        gradeLevels={glRows}
        prefillStudentId={prefillStudent?.id ?? null}
        prefillSchoolYearId={prefillSchoolYearId}
        prefillGradeLevelId={prefillGradeLevelId}
      />
    </div>
  );
}
