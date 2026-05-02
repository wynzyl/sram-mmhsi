import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { students, schoolYears, gradeLevels, enrollments } from "@/lib/db/schema";
import { eq, asc, desc, ne, and, isNull } from "drizzle-orm";
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

  const activeSyRows = await db
    .select({ id: schoolYears.id, label: schoolYears.label })
    .from(schoolYears)
    .where(and(eq(schoolYears.isActive, true), isNull(schoolYears.deletedAt)))
    .limit(1);

  const currentSchoolYear = activeSyRows[0] ?? null;

  type PriorRow = {
    studentId: string;
    gradeLevelId: string;
    gradeName: string;
    gradeOrder: number;
  };

  const [glRows, priorEnrollmentRows] = await Promise.all([
    db
      .select({ id: gradeLevels.id, name: gradeLevels.name, order: gradeLevels.order })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.order)),
    currentSchoolYear != null
      ? db
          .select({
            studentId: enrollments.studentId,
            gradeLevelId: enrollments.gradeLevelId,
            gradeName: gradeLevels.name,
            gradeOrder: gradeLevels.order,
          })
          .from(enrollments)
          .innerJoin(schoolYears, eq(enrollments.schoolYearId, schoolYears.id))
          .innerJoin(gradeLevels, eq(enrollments.gradeLevelId, gradeLevels.id))
          .where(
            and(ne(enrollments.status, "cancelled"), ne(enrollments.schoolYearId, currentSchoolYear.id))
          )
          .orderBy(desc(schoolYears.startDate))
      : Promise.resolve([] as PriorRow[]),
  ]);

  const latestPriorEnrollmentByStudent = new Map<
    string,
    { gradeLevelId: string; gradeName: string; order: number }
  >();
  for (const row of priorEnrollmentRows) {
    if (!latestPriorEnrollmentByStudent.has(row.studentId)) {
      latestPriorEnrollmentByStudent.set(row.studentId, {
        gradeLevelId: row.gradeLevelId,
        gradeName: row.gradeName,
        order: row.gradeOrder,
      });
    }
  }

  const promotionByStudentId: Record<
    string,
    {
      lastGradeLevelId: string;
      lastGradeName: string;
      nextGradeLevelId: string;
      hasNextGradeLevel: boolean;
    }
  > = {};

  for (const [sid, last] of latestPriorEnrollmentByStudent) {
    const nextOrder = last.order + 1;
    const nextGrade = glRows.find((g) => g.order === nextOrder);
    promotionByStudentId[sid] = {
      lastGradeLevelId: last.gradeLevelId,
      lastGradeName: last.gradeName,
      nextGradeLevelId: nextGrade?.id ?? last.gradeLevelId,
      hasNextGradeLevel: !!nextGrade,
    };
  }

  let prefillStudent: (typeof allStudents)[0] | null = null;

  if (studentId) {
    prefillStudent = allStudents.find((s) => s.id === studentId) ?? null;
  }

  return (
    <div className="page-container page-container-narrow">
      <div className="page-header">
        <div>
          <h1 className="page-title">Enroll Student</h1>
          <p className="page-subtitle">
            Enrollments use the <strong>current (active) school year</strong> only. Status starts at{" "}
            <strong>Pending</strong> until fees are assessed.
          </p>
        </div>
      </div>

      <NewEnrollmentForm
        students={allStudents}
        currentSchoolYear={currentSchoolYear}
        gradeLevels={glRows}
        promotionByStudentId={promotionByStudentId}
        prefillStudentId={prefillStudent?.id ?? null}
      />
    </div>
  );
}
